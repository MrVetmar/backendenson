import { z } from 'zod';

const VALID_ASSET_TYPES = ['GOLD', 'STOCK', 'CRYPTO', 'REAL_ESTATE', 'OTHER'] as const;
const VALID_DIRECTIONS = ['UP', 'DOWN'] as const;

export const deviceIdSchema = z.string().min(16).max(128);

export const registerUserSchema = z.object({
  deviceId: deviceIdSchema,
});

export const createAccountSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

const VALID_PROPERTY_TYPES = ['apartment', 'land', 'villa', 'commercial', 'office', 'warehouse', 'other'] as const;

export const createAssetSchema = z.object({
  accountId: z.string().uuid(),
  type: z.enum(VALID_ASSET_TYPES),
  symbol: z.string().max(20).optional().nullable(),
  quantity: z.number().positive().max(1e15),
  buyPrice: z.number().positive().max(1e15),
  // Real estate specific fields (optional)
  location: z.string().max(500).optional().nullable(),
  area: z.number().positive().max(1e10).optional().nullable(),           // Square meters
  propertyType: z.enum(VALID_PROPERTY_TYPES).optional().nullable(),
  currentValuation: z.number().positive().max(1e15).optional().nullable(), // Manual current value
  rentalIncome: z.number().nonnegative().max(1e12).optional().nullable(),  // Monthly rental income
  notes: z.string().max(2000).optional().nullable(),
});

export const createNotificationSchema = z.object({
  thresholdPercent: z.number().int().min(1).max(100),
  direction: z.enum(VALID_DIRECTIONS),
});

export const portfolioAnalysisSchema = z.object({
  userId: z.string().uuid(),
});

export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type PortfolioAnalysisInput = z.infer<typeof portfolioAnalysisSchema>;
