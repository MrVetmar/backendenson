import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { AssetTypeKey, AIAnalysisResult } from './types';

interface PortfolioData {
  totalValue: number;
  totalInvested: number;
  profitLossPercent: number;
  assets: Array<{
    type: AssetTypeKey;
    symbol: string | null;
    quantity: number;
    buyPrice: number;
    currentPrice: number;
    value: number;
    profitLossPercent: number;
  }>;
  distribution: Record<AssetTypeKey, { value: number; percent: number }>;
}

function calculateBaseRisk(portfolio: PortfolioData): number {
  let riskScore = 50;

  const cryptoPercent = portfolio.distribution.CRYPTO?.percent || 0;
  if (cryptoPercent > 50) {
    riskScore += 30;
  } else if (cryptoPercent > 30) {
    riskScore += 20;
  } else if (cryptoPercent > 15) {
    riskScore += 10;
  }

  const stockPercent = portfolio.distribution.STOCK?.percent || 0;
  if (stockPercent > 70) {
    riskScore += 10;
  }

  const uniqueTypes = Object.values(portfolio.distribution).filter(d => d.percent > 0).length;
  if (uniqueTypes === 1) {
    riskScore += 15;
  } else if (uniqueTypes === 2) {
    riskScore += 5;
  } else if (uniqueTypes >= 4) {
    riskScore -= 10;
  }

  const uniqueSymbols = new Set(portfolio.assets.filter(a => a.symbol).map(a => a.symbol)).size;
  if (uniqueSymbols <= 2 && portfolio.assets.length > 2) {
    riskScore += 10;
  } else if (uniqueSymbols >= 5) {
    riskScore -= 5;
  }

  const maxAssetPercent = Math.max(
    ...portfolio.assets.map(a => (a.value / portfolio.totalValue) * 100)
  );
  if (maxAssetPercent > 50) {
    riskScore += 15;
  } else if (maxAssetPercent > 30) {
    riskScore += 5;
  }

  return Math.max(0, Math.min(100, riskScore));
}

function getConcentrationWarnings(portfolio: PortfolioData): string[] {
  const warnings: string[] = [];

  for (const asset of portfolio.assets) {
    const assetPercent = (asset.value / portfolio.totalValue) * 100;
    if (assetPercent > 40) {
      warnings.push(
        `${asset.symbol || asset.type} portföyünüzün %${assetPercent.toFixed(1)}'ini oluşturuyor. Bu aşırı yoğunlaşma riski taşır.`
      );
    }
  }

  const { distribution } = portfolio;
  if (distribution.CRYPTO?.percent > 50) {
    warnings.push(
      `Kripto varlıklar portföyünüzün %${distribution.CRYPTO.percent.toFixed(1)}'ini oluşturuyor. Yüksek volatilite riski.`
    );
  }

  if (distribution.REAL_ESTATE?.percent > 60) {
    warnings.push(
      `Gayrimenkul portföyünüzün %${distribution.REAL_ESTATE.percent.toFixed(1)}'ini oluşturuyor. Likidite riski bulunuyor.`
    );
  }

  const diversifiedTypes = Object.values(distribution).filter(d => d.percent > 5).length;
  if (diversifiedTypes < 2) {
    warnings.push('Portföyünüz yeterince çeşitlendirilmemiş. Farklı varlık sınıflarına yatırım yapmayı düşünün.');
  }

  return warnings;
}

function getVolatilityAlerts(portfolio: PortfolioData): string[] {
  const alerts: string[] = [];

  const highVolatilityCrypto = ['DOGE', 'SHIB', 'PEPE', 'FLOKI', 'BONK'];
  for (const asset of portfolio.assets) {
    if (asset.type === 'CRYPTO' && asset.symbol && highVolatilityCrypto.includes(asset.symbol.toUpperCase())) {
      const assetPercent = (asset.value / portfolio.totalValue) * 100;
      if (assetPercent > 5) {
        alerts.push(
          `${asset.symbol} yüksek volatiliteye sahip bir meme coin. Portföyünüzün %${assetPercent.toFixed(1)}'i bu varlıkta.`
        );
      }
    }
  }

  for (const asset of portfolio.assets) {
    if (Math.abs(asset.profitLossPercent) > 30) {
      const direction = asset.profitLossPercent > 0 ? 'kazanç' : 'kayıp';
      alerts.push(
        `${asset.symbol || asset.type}: %${Math.abs(asset.profitLossPercent).toFixed(1)} ${direction}. Pozisyonunuzu gözden geçirin.`
      );
    }
  }

  return alerts;
}

export async function analyzePortfolio(portfolio: PortfolioData): Promise<AIAnalysisResult> {
  const baseRiskScore = calculateBaseRisk(portfolio);
  const concentrationWarnings = getConcentrationWarnings(portfolio);
  const volatilityAlerts = getVolatilityAlerts(portfolio);

  const prompt = `Sen profesyonel bir finans danışmanısın. Aşağıdaki portföy verilerini analiz et ve YALNIZCA JSON formatında yanıt ver.

PORTFÖY VERİLERİ:
- Toplam Değer: $${portfolio.totalValue.toFixed(2)}
- Toplam Yatırım: $${portfolio.totalInvested.toFixed(2)}
- Kar/Zarar: %${portfolio.profitLossPercent.toFixed(2)}

VARLIK DAĞILIMI:
${Object.entries(portfolio.distribution)
  .filter(([, data]) => data.percent > 0)
  .map(([type, data]) => `- ${type}: $${data.value.toFixed(2)} (%${data.percent.toFixed(1)})`)
  .join('\n')}

VARLIKLAR:
${portfolio.assets.map(a => 
  `- ${a.symbol || a.type}: ${a.quantity} adet, Alış: $${a.buyPrice.toFixed(2)}, Güncel: $${a.currentPrice.toFixed(2)}, K/Z: %${a.profitLossPercent.toFixed(2)}`
).join('\n')}

ÖN HESAPLAMALAR:
- Hesaplanan Risk Skoru: ${baseRiskScore}/100
- Tespit Edilen Yoğunlaşma Uyarıları: ${concentrationWarnings.length > 0 ? concentrationWarnings.join('; ') : 'Yok'}
- Tespit Edilen Volatilite Uyarıları: ${volatilityAlerts.length > 0 ? volatilityAlerts.join('; ') : 'Yok'}

GÖREV:
1. Risk skorunu doğrula veya gerekirse ayarla (0-100 arası, 100 = en riskli)
2. En az 2 adet uygulanabilir yatırım önerisi ver (genel geçer değil, portföye özel)
3. Kısa bir özet yaz

YANIT FORMATI (SADECE JSON):
{
  "riskScore": <number>,
  "recommendations": ["öneri1", "öneri2", ...],
  "summary": "özet metin"
}`;

  try {
    const model = google('gemini-1.5-flash');
    const { text } = await generateText({
      model: model as Parameters<typeof generateText>[0]['model'],
      prompt,
      maxTokens: 1000,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid AI response format');
    }

    const aiResponse = JSON.parse(jsonMatch[0]) as {
      riskScore: number;
      recommendations: string[];
      summary: string;
    };

    return {
      riskScore: Math.max(0, Math.min(100, aiResponse.riskScore || baseRiskScore)),
      concentrationWarnings,
      recommendations: aiResponse.recommendations || [],
      volatilityAlerts,
      summary: aiResponse.summary || 'Portföy analizi tamamlandı.',
    };
  } catch (error) {
    console.error('AI analysis error:', error);

    return {
      riskScore: baseRiskScore,
      concentrationWarnings,
      recommendations: generateFallbackRecommendations(portfolio),
      volatilityAlerts,
      summary: 'AI analizi şu an kullanılamıyor. Temel metrikler hesaplandı.',
    };
  }
}

function generateFallbackRecommendations(portfolio: PortfolioData): string[] {
  const recommendations: string[] = [];
  const { distribution } = portfolio;

  const diversifiedTypes = Object.values(distribution).filter(d => d.percent > 5).length;
  if (diversifiedTypes < 3) {
    recommendations.push('Portföyünüzü en az 3 farklı varlık sınıfına yayarak çeşitlendirin.');
  }

  if (distribution.CRYPTO?.percent > 30) {
    recommendations.push('Kripto varlık oranınızı %20-30 seviyesine düşürmeyi ve farkı altın veya hisse senedine aktarmayı düşünün.');
  }

  if (distribution.GOLD?.percent < 10 && portfolio.totalValue > 1000) {
    recommendations.push('Portföyünüzün %5-10\'unu altına ayırarak enflasyona karşı koruma sağlayın.');
  }

  if (distribution.STOCK?.percent < 20) {
    recommendations.push('Hisse senedi yatırımlarınızı artırarak uzun vadeli büyüme potansiyeli ekleyin.');
  }

  if (portfolio.profitLossPercent > 50) {
    recommendations.push('Önemli karınız var. Karın bir kısmını realize etmeyi ve portföyü yeniden dengelemeyi düşünün.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Portföyünüz iyi dengelenmiş görünüyor. Mevcut stratejiyi sürdürün.');
  }

  return recommendations;
}
