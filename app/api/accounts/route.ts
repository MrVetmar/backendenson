import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAccountSchema } from '@/lib/validations';
import { createResponse, createErrorResponse, getUserFromRequest, withErrorHandler } from '@/lib/api-utils';
import { ValidationError } from '@/lib/errors';

async function handler(request: NextRequest) {
  const user = await getUserFromRequest(request);
  const body = await request.json();

  const parseResult = createAccountSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors[0].message);
  }

  const { name } = parseResult.data;

  const account = await prisma.account.create({
    data: {
      userId: user.id,
      name,
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
    },
  });

  return createResponse(account, 201);
}

export const POST = withErrorHandler(handler);
