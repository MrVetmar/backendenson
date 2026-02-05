import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBatchPrices } from '@/lib/price-service';
import { isPriceError, AssetTypeKey } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const logs: string[] = [];

  try {
    logs.push(`[${new Date().toISOString()}] Price update cron started`);

    const assets = await prisma.asset.findMany({
      where: {
        type: {
          in: ['CRYPTO', 'GOLD', 'STOCK'],
        },
      },
      include: {
        notificationRules: {
          where: {
            triggered: false,
          },
        },
      },
    });

    if (assets.length === 0) {
      logs.push('No assets to update');
      return NextResponse.json({ success: true, logs, duration: Date.now() - startTime });
    }

    logs.push(`Found ${assets.length} assets to update`);

    const uniqueAssets = new Map<string, { type: AssetTypeKey; symbol: string | null }>();
    for (const asset of assets) {
      const key = `${asset.type}:${asset.symbol || 'null'}`;
      if (!uniqueAssets.has(key)) {
        uniqueAssets.set(key, { type: asset.type as AssetTypeKey, symbol: asset.symbol });
      }
    }

    const priceMap = await getBatchPrices(Array.from(uniqueAssets.values()));

    logs.push(`Fetched ${priceMap.size} prices`);

    const priceHistoryRecords: Array<{
      assetId: string;
      price: number;
    }> = [];

    const notificationsTriggered: Array<{
      assetId: string;
      symbol: string | null;
      ruleId: string;
      direction: string;
      thresholdPercent: number;
      actualPercent: number;
    }> = [];

    for (const asset of assets) {
      const key = `${asset.type}:${asset.symbol || 'null'}`;
      const priceResult = priceMap.get(key);

      if (!priceResult || isPriceError(priceResult)) {
        continue;
      }

      const currentPrice = priceResult.price;
      
      priceHistoryRecords.push({
        assetId: asset.id,
        price: currentPrice,
      });

      const buyPrice = Number(asset.buyPrice);
      const priceChangePercent = ((currentPrice - buyPrice) / buyPrice) * 100;

      for (const rule of asset.notificationRules) {
        const shouldTrigger =
          (rule.direction === 'UP' && priceChangePercent >= rule.thresholdPercent) ||
          (rule.direction === 'DOWN' && priceChangePercent <= -rule.thresholdPercent);

        if (shouldTrigger) {
          notificationsTriggered.push({
            assetId: asset.id,
            symbol: asset.symbol,
            ruleId: rule.id,
            direction: rule.direction,
            thresholdPercent: rule.thresholdPercent,
            actualPercent: Math.round(priceChangePercent * 100) / 100,
          });
        }
      }
    }

    if (priceHistoryRecords.length > 0) {
      await prisma.assetPriceHistory.createMany({
        data: priceHistoryRecords.map(record => ({
          assetId: record.assetId,
          price: record.price,
        })),
      });
      logs.push(`Created ${priceHistoryRecords.length} price history records`);
    }

    if (notificationsTriggered.length > 0) {
      const ruleIds = notificationsTriggered.map(n => n.ruleId);
      
      await prisma.notificationRule.updateMany({
        where: {
          id: { in: ruleIds },
        },
        data: {
          triggered: true,
          lastTriggeredAt: new Date(),
        },
      });

      for (const notification of notificationsTriggered) {
        logs.push(
          `[NOTIFICATION] ${notification.symbol || 'Asset'}: ` +
          `${notification.direction} ${notification.thresholdPercent}% threshold hit. ` +
          `Actual: ${notification.actualPercent}%`
        );
      }

      logs.push(`Triggered ${notificationsTriggered.length} notifications`);
    }

    const duration = Date.now() - startTime;
    logs.push(`[${new Date().toISOString()}] Price update completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      stats: {
        assetsProcessed: assets.length,
        pricesUpdated: priceHistoryRecords.length,
        notificationsTriggered: notificationsTriggered.length,
      },
      notifications: notificationsTriggered,
      logs,
      duration,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logs.push(`[ERROR] ${errorMessage}`);
    console.error('Cron job error:', error);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        logs,
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
