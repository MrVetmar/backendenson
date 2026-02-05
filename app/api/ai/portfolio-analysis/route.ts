import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { portfolioAnalysisSchema } from '@/lib/validations';
import { createResponse, getUserFromRequest, withErrorHandler } from '@/lib/api-utils';
import { ValidationError } from '@/lib/errors';
import { getBatchPrices } from '@/lib/price-service';
import { isPriceError, AssetTypeKey } from '@/lib/types';
import { analyzePortfolio } from '@/lib/ai-service';

async function handler(request: NextRequest) {
  const user = await getUserFromRequest(request);
  const body = await request.json();

  const parseResult = portfolioAnalysisSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors[0].message);
  }

  if (parseResult.data.userId !== user.id) {
    throw new ValidationError('User ID mismatch');
  }

  const assets = await prisma.asset.findMany({
    where: {
      account: {
        userId: user.id,
      },
    },
  });

  if (assets.length === 0) {
    return createResponse({
      riskScore: 0,
      concentrationWarnings: [],
      recommendations: ['Henüz varlık eklememişsiniz. Portföy oluşturmak için varlık ekleyin.'],
      volatilityAlerts: [],
      summary: 'Portföyünüzde henüz varlık bulunmuyor.',
    });
  }

  const priceInputs = assets.map(a => ({
    type: a.type as AssetTypeKey,
    symbol: a.symbol,
  }));

  const priceMap = await getBatchPrices(priceInputs);

  let totalValue = 0;
  let totalInvested = 0;
  const valueByType: Record<AssetTypeKey, number> = {
    GOLD: 0,
    STOCK: 0,
    CRYPTO: 0,
    REAL_ESTATE: 0,
    OTHER: 0,
  };

  const enrichedAssets = assets.map(asset => {
    const quantity = Number(asset.quantity);
    const buyPrice = Number(asset.buyPrice);
    const invested = quantity * buyPrice;
    totalInvested += invested;

    const key = `${asset.type}:${asset.symbol || 'null'}`;
    const priceResult = priceMap.get(key);

    let currentPrice = buyPrice;
    if (priceResult && !isPriceError(priceResult)) {
      currentPrice = priceResult.price;
    }

    const value = quantity * currentPrice;
    totalValue += value;
    valueByType[asset.type as AssetTypeKey] += value;

    const profitLoss = value - invested;
    const profitLossPercent = invested > 0 ? (profitLoss / invested) * 100 : 0;

    return {
      type: asset.type as AssetTypeKey,
      symbol: asset.symbol,
      quantity,
      buyPrice,
      currentPrice,
      value,
      profitLossPercent,
    };
  });

  const totalProfitLoss = totalValue - totalInvested;
  const totalProfitLossPercent = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

  const distribution: Record<AssetTypeKey, { value: number; percent: number }> = {
    GOLD: {
      value: valueByType.GOLD,
      percent: totalValue > 0 ? (valueByType.GOLD / totalValue) * 100 : 0,
    },
    STOCK: {
      value: valueByType.STOCK,
      percent: totalValue > 0 ? (valueByType.STOCK / totalValue) * 100 : 0,
    },
    CRYPTO: {
      value: valueByType.CRYPTO,
      percent: totalValue > 0 ? (valueByType.CRYPTO / totalValue) * 100 : 0,
    },
    REAL_ESTATE: {
      value: valueByType.REAL_ESTATE,
      percent: totalValue > 0 ? (valueByType.REAL_ESTATE / totalValue) * 100 : 0,
    },
    OTHER: {
      value: valueByType.OTHER,
      percent: totalValue > 0 ? (valueByType.OTHER / totalValue) * 100 : 0,
    },
  };

  const analysisResult = await analyzePortfolio({
    totalValue,
    totalInvested,
    profitLossPercent: totalProfitLossPercent,
    assets: enrichedAssets,
    distribution,
  });

  return createResponse({
    ...analysisResult,
    portfolioMetrics: {
      totalValue: Math.round(totalValue * 100) / 100,
      totalInvested: Math.round(totalInvested * 100) / 100,
      profitLossPercent: Math.round(totalProfitLossPercent * 100) / 100,
      assetCount: assets.length,
    },
  });
}

export const POST = withErrorHandler(handler);
