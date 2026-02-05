import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createResponse, getUserFromRequest, withErrorHandler } from '@/lib/api-utils';
import { getBatchPrices } from '@/lib/price-service';
import { isPriceError, AssetTypeKey, PortfolioSummary } from '@/lib/types';

async function handler(request: NextRequest) {
  const user = await getUserFromRequest(request);

  const assets = await prisma.asset.findMany({
    where: {
      account: {
        userId: user.id,
      },
    },
  });

  if (assets.length === 0) {
    const emptyDistribution: PortfolioSummary['distribution'] = {
      GOLD: { value: 0, percent: 0 },
      STOCK: { value: 0, percent: 0 },
      CRYPTO: { value: 0, percent: 0 },
      REAL_ESTATE: { value: 0, percent: 0 },
      OTHER: { value: 0, percent: 0 },
    };

    return createResponse({
      totalValue: 0,
      totalInvested: 0,
      totalProfitLoss: 0,
      totalProfitLossPercent: 0,
      distribution: emptyDistribution,
      assetCount: 0,
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

  for (const asset of assets) {
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
  }

  const totalProfitLoss = totalValue - totalInvested;
  const totalProfitLossPercent = totalInvested > 0 
    ? Math.round((totalProfitLoss / totalInvested) * 10000) / 100 
    : 0;

  const distribution: PortfolioSummary['distribution'] = {
    GOLD: {
      value: Math.round(valueByType.GOLD * 100) / 100,
      percent: totalValue > 0 ? Math.round((valueByType.GOLD / totalValue) * 10000) / 100 : 0,
    },
    STOCK: {
      value: Math.round(valueByType.STOCK * 100) / 100,
      percent: totalValue > 0 ? Math.round((valueByType.STOCK / totalValue) * 10000) / 100 : 0,
    },
    CRYPTO: {
      value: Math.round(valueByType.CRYPTO * 100) / 100,
      percent: totalValue > 0 ? Math.round((valueByType.CRYPTO / totalValue) * 10000) / 100 : 0,
    },
    REAL_ESTATE: {
      value: Math.round(valueByType.REAL_ESTATE * 100) / 100,
      percent: totalValue > 0 ? Math.round((valueByType.REAL_ESTATE / totalValue) * 10000) / 100 : 0,
    },
    OTHER: {
      value: Math.round(valueByType.OTHER * 100) / 100,
      percent: totalValue > 0 ? Math.round((valueByType.OTHER / totalValue) * 10000) / 100 : 0,
    },
  };

  return createResponse({
    totalValue: Math.round(totalValue * 100) / 100,
    totalInvested: Math.round(totalInvested * 100) / 100,
    totalProfitLoss: Math.round(totalProfitLoss * 100) / 100,
    totalProfitLossPercent,
    distribution,
    assetCount: assets.length,
  });
}

export const GET = withErrorHandler(handler);
