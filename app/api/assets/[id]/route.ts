import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createResponse, getUserFromRequest, withErrorHandler } from '@/lib/api-utils';
import { NotFoundError } from '@/lib/errors';

// GET single asset by ID
async function getHandler(request: NextRequest, context?: { params: Record<string, string> }) {
    const user = await getUserFromRequest(request);
    const id = context?.params?.id;

    if (!id) {
        throw new NotFoundError('Asset');
    }

    const asset = await prisma.asset.findFirst({
        where: {
            id,
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
    });

    if (!asset) {
        throw new NotFoundError('Asset');
    }

    return createResponse({
        id: asset.id,
        accountId: asset.accountId,
        accountName: asset.account.name,
        type: asset.type,
        symbol: asset.symbol,
        quantity: Number(asset.quantity),
        buyPrice: Number(asset.buyPrice),
        createdAt: asset.createdAt,
        // Real estate fields
        ...(asset.type === 'REAL_ESTATE' && {
            location: asset.location,
            area: asset.area ? Number(asset.area) : null,
            propertyType: asset.propertyType,
            currentValuation: asset.currentValuation ? Number(asset.currentValuation) : null,
            rentalIncome: asset.rentalIncome ? Number(asset.rentalIncome) : null,
            notes: asset.notes,
        }),
    });
}

// DELETE asset by ID
async function deleteHandler(request: NextRequest, context?: { params: Record<string, string> }) {
    const user = await getUserFromRequest(request);
    const id = context?.params?.id;

    if (!id) {
        throw new NotFoundError('Asset');
    }

    // First check if asset exists and belongs to user
    const asset = await prisma.asset.findFirst({
        where: {
            id,
            account: {
                userId: user.id,
            },
        },
    });

    if (!asset) {
        throw new NotFoundError('Asset');
    }

    // Delete the asset
    await prisma.asset.delete({
        where: {
            id,
        },
    });

    return createResponse({
        success: true,
        message: 'Asset deleted successfully',
        deletedId: id,
    });
}

export const GET = withErrorHandler(getHandler);
export const DELETE = withErrorHandler(deleteHandler);
