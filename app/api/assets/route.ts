import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAssetSchema } from '@/lib/validations';
import { createResponse, getUserFromRequest, withErrorHandler } from '@/lib/api-utils';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { getAssetPrice, getBatchPrices } from '@/lib/price-service';
import { isPriceError, AssetTypeKey, PortfolioAsset } from '@/lib/types';

async function postHandler(request: NextRequest) {
  const user = await getUserFromRequest(request);
  const body = await request.json();

  const parseResult = createAssetSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors[0].message);
  }

  const { accountId, type, symbol, quantity, buyPrice } = parseResult.data;

  const account = await prisma.account.findFirst({
    where: {
      id: accountId,
      userId: user.id,
    },
  });

  if (!account) {
    throw new NotFoundError('Account');
  }

  const asset = await prisma.asset.create({
    data: {
      accountId,
      type,
      symbol: symbol || null,
      quantity,
      buyPrice,
    },
    select: {
      id: true,
      accountId: true,
      type: true,
      symbol: true,
      quantity: true,
      buyPrice: true,
      createdAt: true,
    },
  });

  return createResponse({
    ...asset,
    quantity: Number(asset.quantity),
    buyPrice: Number(asset.buyPrice),
  }, 201);
}

async function getHandler(request: NextRequest) {
  const user = await getUserFromRequest(request);

  const assets = await prisma.asset.findMany({
    where: {
      account: {
        userId: user.id,
      },
    },
    include: {
      account: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (assets.length === 0) {
    return createResponse([]);
  }

  const priceInputs = assets.map(a => ({
    type: a.type as AssetTypeKey,
    symbol: a.symbol,
  }));

  const priceMap = await getBatchPrices(priceInputs);

  const enrichedAssets: PortfolioAsset[] = assets.map(asset => {
    const key = `${asset.type}:${asset.symbol || 'null'}`;
    const priceResult = priceMap.get(key);
    
    const quantity = Number(asset.quantity);
    const buyPrice = Number(asset.buyPrice);
    const totalInvested = quantity * buyPrice;
    
    let currentPrice = buyPrice;
    let priceError: string | null = null;

    if (priceResult) {
      if (isPriceError(priceResult)) {
        priceError = priceResult.error;
      } else {
        currentPrice = priceResult.price;
      }
    }

    const totalValue = quantity * currentPrice;
    const profitLoss = totalValue - totalInvested;
    const profitLossPercent = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

    return {
      id: asset.id,
      accountId: asset.accountId,
      accountName: asset.account.name,
      type: asset.type as AssetTypeKey,
      symbol: asset.symbol,
      quantity,
      buyPrice,
      currentPrice,
      totalInvested,
      totalValue,
      profitLoss,
      profitLossPercent: Math.round(profitLossPercent * 100) / 100,
      priceError,
      createdAt: asset.createdAt,
    };
  });

  return createResponse(enrichedAssets);
}

export const POST = withErrorHandler(postHandler);
export const GET = withErrorHandler(getHandler);
