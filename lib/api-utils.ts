import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AppError, UnauthorizedError, RateLimitError } from '@/lib/errors';
import { ApiResponse } from '@/lib/types';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 100;

export function createResponse<T>(data: T, status: number = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    { success: true, data },
    { status }
  );
}

export function createErrorResponse(error: AppError | Error): NextResponse<ApiResponse> {
  const isAppError = error instanceof AppError;
  const statusCode = isAppError ? error.statusCode : 500;
  const code = isAppError ? error.code : 'INTERNAL_ERROR';
  const message = isAppError && error.isOperational ? error.message : 'An unexpected error occurred';

  if (!isAppError) {
    console.error('Unhandled error:', error);
  }

  return NextResponse.json(
    {
      success: false,
      error: message,
      code,
    },
    { status: statusCode }
  );
}

export async function getUserFromRequest(request: NextRequest): Promise<{ id: string; deviceId: string }> {
  const deviceId = request.headers.get('x-device-id');

  if (!deviceId) {
    throw new UnauthorizedError('x-device-id header is required');
  }

  const user = await prisma.user.findUnique({
    where: { deviceId },
    select: { id: true, deviceId: true },
  });

  if (!user) {
    throw new UnauthorizedError('User not found. Please register first.');
  }

  return user;
}

export function checkRateLimit(identifier: string): void {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return;
  }

  record.count++;

  if (record.count > RATE_LIMIT_MAX) {
    throw new RateLimitError();
  }
}

export function withErrorHandler(
  handler: (request: NextRequest, context?: { params: Record<string, string> }) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: { params: Record<string, string> }): Promise<NextResponse> => {
    try {
      const deviceId = request.headers.get('x-device-id') || request.ip || 'anonymous';
      checkRateLimit(deviceId);

      return await handler(request, context);
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error : new Error('Unknown error'));
    }
  };
}
