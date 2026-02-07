import { NormalizedPrice, PriceResult, AssetTypeKey } from './types';
import { ExternalApiError } from './errors';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const GOLDAPI_BASE = 'https://www.goldapi.io/api';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

const CRYPTO_ID_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  SOL: 'solana',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  SHIB: 'shiba-inu',
  LTC: 'litecoin',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  UNI: 'uniswap',
  ATOM: 'cosmos',
};

const GOLD_SYMBOL_MAP: Record<string, string> = {
  XAU: 'XAU',
  GOLD: 'XAU',
  XAG: 'XAG',
  SILVER: 'XAG',
};

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getCryptoPrice(symbol: string): Promise<PriceResult> {
  const normalizedSymbol = symbol.toUpperCase();
  const coinId = CRYPTO_ID_MAP[normalizedSymbol] || normalizedSymbol.toLowerCase();

  console.log('CRYPTO PRICE FETCH START:', { symbol: normalizedSymbol, coinId });

  try {
    const response = await fetchWithTimeout(
      `${COINGECKO_BASE}/simple/price?ids=${coinId}&vs_currencies=usd&include_last_updated_at=true`
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API returned ${response.status}`);
    }

    const data = await response.json();
    console.log('CRYPTO API RESPONSE:', { coinId, data: data[coinId] || 'NOT_FOUND' });

    if (!data[coinId]) {
      console.log('CRYPTO PRICE ERROR: No data for', normalizedSymbol);
      return {
        symbol: normalizedSymbol,
        error: `Price data not found for ${normalizedSymbol}`,
        source: 'coingecko',
      };
    }

    return {
      symbol: normalizedSymbol,
      price: data[coinId].usd,
      currency: 'USD',
      source: 'coingecko',
      timestamp: new Date(data[coinId].last_updated_at * 1000),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log('CRYPTO PRICE EXCEPTION:', { symbol: normalizedSymbol, error: message });
    return {
      symbol: normalizedSymbol,
      error: message,
      source: 'coingecko',
    };
  }
}

export async function getGoldPrice(symbol: string): Promise<PriceResult> {
  const normalizedSymbol = GOLD_SYMBOL_MAP[symbol.toUpperCase()] || 'XAU';
  const apiKey = process.env.GOLDAPI_KEY;

  console.log('GOLD PRICE FETCH START:', { symbol: normalizedSymbol, apiKey: apiKey ? 'SET' : 'MISSING' });

  if (!apiKey) {
    console.log('GOLD PRICE ERROR: API key not configured');
    return {
      symbol: normalizedSymbol,
      error: 'GoldAPI key not configured',
      source: 'goldapi',
    };
  }

  try {
    const response = await fetchWithTimeout(
      `${GOLDAPI_BASE}/${normalizedSymbol}/USD`,
      {
        headers: {
          'x-access-token': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GoldAPI returned ${response.status}`);
    }

    const data = await response.json();
    console.log('GOLD API RESPONSE:', { symbol: normalizedSymbol, price: data.price, error: data.error });

    if (data.error) {
      console.log('GOLD PRICE ERROR:', data.error);
      return {
        symbol: normalizedSymbol,
        error: data.error,
        source: 'goldapi',
      };
    }

    return {
      symbol: normalizedSymbol,
      price: data.price,
      currency: 'USD',
      source: 'goldapi',
      timestamp: new Date(data.timestamp * 1000),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log('GOLD PRICE EXCEPTION:', { symbol: normalizedSymbol, error: message });
    return {
      symbol: normalizedSymbol,
      error: message,
      source: 'goldapi',
    };
  }
}

export async function getStockPrice(symbol: string): Promise<PriceResult> {
  const normalizedSymbol = symbol.toUpperCase();
  const apiKey = process.env.FINNHUB_API_KEY;

  console.log('STOCK PRICE FETCH START:', { symbol: normalizedSymbol, apiKey: apiKey ? 'SET' : 'MISSING' });

  if (!apiKey) {
    console.log('STOCK PRICE ERROR: API key not configured');
    return {
      symbol: normalizedSymbol,
      error: 'Finnhub API key not configured',
      source: 'finnhub',
    };
  }

  try {
    const response = await fetchWithTimeout(
      `${FINNHUB_BASE}/quote?symbol=${normalizedSymbol}&token=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Finnhub API returned ${response.status}`);
    }

    const data = await response.json();
    console.log('STOCK API RESPONSE:', { symbol: normalizedSymbol, currentPrice: data.c, data });

    if (!data.c || data.c === 0) {
      console.log('STOCK PRICE ERROR: No data for', normalizedSymbol);
      return {
        symbol: normalizedSymbol,
        error: `No price data available for ${normalizedSymbol}`,
        source: 'finnhub',
      };
    }

    return {
      symbol: normalizedSymbol,
      price: data.c,
      currency: 'USD',
      source: 'finnhub',
      timestamp: new Date(data.t * 1000),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log('STOCK PRICE EXCEPTION:', { symbol: normalizedSymbol, error: message });
    return {
      symbol: normalizedSymbol,
      error: message,
      source: 'finnhub',
    };
  }
}

export async function getAssetPrice(type: AssetTypeKey, symbol: string | null): Promise<PriceResult> {
  switch (type) {
    case 'CRYPTO':
      if (!symbol) {
        return { symbol: 'UNKNOWN', error: 'Symbol required for crypto', source: 'system' };
      }
      return getCryptoPrice(symbol);

    case 'GOLD':
      return getGoldPrice(symbol || 'XAU');

    case 'STOCK':
      if (!symbol) {
        return { symbol: 'UNKNOWN', error: 'Symbol required for stock', source: 'system' };
      }
      return getStockPrice(symbol);

    case 'REAL_ESTATE':
    case 'OTHER':
      return {
        symbol: symbol || 'CUSTOM',
        error: 'Manual valuation required - no live price available',
        source: 'system',
      };

    default:
      return {
        symbol: symbol || 'UNKNOWN',
        error: `Unsupported asset type: ${type}`,
        source: 'system',
      };
  }
}

export async function getBatchPrices(
  assets: Array<{ type: AssetTypeKey; symbol: string | null }>
): Promise<Map<string, PriceResult>> {
  const results = new Map<string, PriceResult>();
  const cryptoSymbols: string[] = [];
  const stockSymbols: string[] = [];
  const goldSymbols: string[] = [];

  for (const asset of assets) {
    const key = `${asset.type}:${asset.symbol || 'null'}`;
    if (results.has(key)) continue;

    switch (asset.type) {
      case 'CRYPTO':
        if (asset.symbol) cryptoSymbols.push(asset.symbol);
        break;
      case 'STOCK':
        if (asset.symbol) stockSymbols.push(asset.symbol);
        break;
      case 'GOLD':
        goldSymbols.push(asset.symbol || 'XAU');
        break;
      default:
        results.set(key, {
          symbol: asset.symbol || 'CUSTOM',
          error: 'Manual valuation required',
          source: 'system',
        });
    }
  }

  const promises: Promise<void>[] = [];

  if (cryptoSymbols.length > 0) {
    promises.push(
      (async () => {
        const uniqueSymbols = Array.from(new Set(cryptoSymbols));
        const coinIds = uniqueSymbols.map(s => CRYPTO_ID_MAP[s.toUpperCase()] || s.toLowerCase());

        try {
          const response = await fetchWithTimeout(
            `${COINGECKO_BASE}/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd&include_last_updated_at=true`
          );

          if (response.ok) {
            const data = await response.json();

            for (const symbol of uniqueSymbols) {
              const coinId = CRYPTO_ID_MAP[symbol.toUpperCase()] || symbol.toLowerCase();
              const key = `CRYPTO:${symbol}`;

              if (data[coinId]) {
                results.set(key, {
                  symbol: symbol.toUpperCase(),
                  price: data[coinId].usd,
                  currency: 'USD',
                  source: 'coingecko',
                  timestamp: new Date(data[coinId].last_updated_at * 1000),
                });
              } else {
                results.set(key, {
                  symbol: symbol.toUpperCase(),
                  error: 'Price not found',
                  source: 'coingecko',
                });
              }
            }
          }
        } catch (error) {
          for (const symbol of uniqueSymbols) {
            const key = `CRYPTO:${symbol}`;
            results.set(key, {
              symbol: symbol.toUpperCase(),
              error: error instanceof Error ? error.message : 'Unknown error',
              source: 'coingecko',
            });
          }
        }
      })()
    );
  }

  for (const symbol of Array.from(new Set(stockSymbols))) {
    promises.push(
      (async () => {
        const result = await getStockPrice(symbol);
        results.set(`STOCK:${symbol}`, result);
      })()
    );
  }

  for (const symbol of Array.from(new Set(goldSymbols))) {
    promises.push(
      (async () => {
        const result = await getGoldPrice(symbol);
        results.set(`GOLD:${symbol}`, result);
      })()
    );
  }

  await Promise.all(promises);

  return results;
}
