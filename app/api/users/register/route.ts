import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { registerUserSchema } from '@/lib/validations';
import { createResponse, createErrorResponse, withErrorHandler } from '@/lib/api-utils';
import { ValidationError } from '@/lib/errors';

async function handler(request: NextRequest) {
  const body = await request.json();

  const parseResult = registerUserSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors[0].message);
  }

  const { deviceId } = parseResult.data;

  const existingUser = await prisma.user.findUnique({
    where: { deviceId },
    include: {
      accounts: {
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      },
    },
  });

  if (existingUser) {
    return createResponse({
      id: existingUser.id,
      deviceId: existingUser.deviceId,
      createdAt: existingUser.createdAt,
      accounts: existingUser.accounts,
      isNew: false,
    });
  }

  const newUser = await prisma.user.create({
    data: { deviceId },
    include: {
      accounts: {
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      },
    },
  });

  return createResponse(
    {
      id: newUser.id,
      deviceId: newUser.deviceId,
      createdAt: newUser.createdAt,
      accounts: newUser.accounts,
      isNew: true,
    },
    201
  );
}

export const POST = withErrorHandler(handler);
