export type AssetTypeKey = 'GOLD' | 'STOCK' | 'CRYPTO' | 'REAL_ESTATE' | 'OTHER';

export interface NormalizedPrice {
  symbol: string;
  price: number;
  currency: string;
  source: string;
  timestamp: Date;
}

export interface PriceError {
  symbol: string;
  error: string;
  source: string;
}

export type PriceResult = NormalizedPrice | PriceError;

export function isPriceError(result: PriceResult): result is PriceError {
  return 'error' in result;
}

export interface PortfolioAsset {
  id: string;
  type: AssetTypeKey;
  symbol: string | null;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  totalValue: number;
  profitLoss: number;
  profitLossPercent: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  distribution: Record<AssetTypeKey, { value: number; percent: number }>;
}

export interface AIAnalysisResult {
  riskScore: number;
  concentrationWarnings: string[];
  recommendations: string[];
  volatilityAlerts: string[];
  summary: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}
