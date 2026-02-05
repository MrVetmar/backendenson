import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNotificationSchema } from '@/lib/validations';
import { createResponse, getUserFromRequest, withErrorHandler } from '@/lib/api-utils';
import { ValidationError, NotFoundError } from '@/lib/errors';

async function handler(
  request: NextRequest,
  context?: { params: Record<string, string> }
) {
  const user = await getUserFromRequest(request);
  const assetId = context?.params?.id;
  
  if (!assetId) {
    throw new ValidationError('Asset ID is required');
  }
  
  const body = await request.json();

  const parseResult = createNotificationSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors[0].message);
  }

  const { thresholdPercent, direction } = parseResult.data;

  const asset = await prisma.asset.findFirst({
    where: {
      id: assetId,
      account: {
        userId: user.id,
      },
    },
  });

  if (!asset) {
    throw new NotFoundError('Asset');
  }

  const notification = await prisma.notificationRule.create({
    data: {
      assetId,
      thresholdPercent,
      direction,
    },
    select: {
      id: true,
      assetId: true,
      thresholdPercent: true,
      direction: true,
      triggered: true,
    },
  });

  return createResponse(notification, 201);
}

export const POST = withErrorHandler(handler);
