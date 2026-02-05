# Varlık Takip Backend API

Mobil bütçe uygulaması için profesyonel, ölçeklenebilir "Yatırımlar & Varlıklar" backend servisi.

## Teknolojiler

- **Framework:** Next.js 14 (App Router, API-only)
- **Dil:** TypeScript (strict mode)
- **Veritabanı:** PostgreSQL (Supabase/Neon)
- **ORM:** Prisma
- **AI:** Vercel AI SDK + Google Gemini
- **Deploy:** Vercel Serverless

## Kurulum

### 1. Bağımlılıkları Yükle

```bash
npm install
```

### 2. Environment Değişkenlerini Ayarla

`env.template` dosyasını `.env` olarak kopyalayın ve değerleri doldurun:

```bash
cp env.template .env
```

**Gerekli Environment Değişkenleri:**

| Değişken | Açıklama | Nereden Alınır |
|----------|----------|----------------|
| `DATABASE_URL` | PostgreSQL bağlantı URL'i | [Supabase](https://supabase.com) veya [Neon](https://neon.tech) |
| `GOLDAPI_KEY` | Altın fiyatları API key | [GoldAPI.io](https://goldapi.io) |
| `FINNHUB_API_KEY` | Hisse senedi fiyatları | [Finnhub.io](https://finnhub.io) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini AI API key | [Google AI Studio](https://aistudio.google.com) |
| `CRON_SECRET` | Cron job güvenlik anahtarı | Rastgele string oluşturun |

### 3. Veritabanını Hazırla

```bash
npx prisma db push
```

### 4. Geliştirme Sunucusunu Başlat

```bash
npm run dev
```

## Vercel'e Deploy

### 1. Vercel CLI

```bash
npm i -g vercel
vercel login
vercel
```

### 2. Environment Değişkenleri

Vercel Dashboard > Project Settings > Environment Variables kısmından tüm değişkenleri ekleyin.

### 3. Cron Job

`vercel.json` dosyasındaki cron ayarı otomatik olarak aktif olacaktır:
- Her 30 dakikada bir fiyat güncelleme
- Bildirim eşiklerini kontrol etme

## API Endpoint'leri

### Kimlik Doğrulama

Tüm isteklerde (register hariç) `x-device-id` header'ı zorunludur.

### Kullanıcı İşlemleri

#### Kayıt / Giriş
```http
POST /api/users/register
Content-Type: application/json

{
  "deviceId": "unique-device-identifier-min-16-chars"
}
```

**Yanıt:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "deviceId": "...",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "accounts": [],
    "isNew": true
  }
}
```

### Hesap İşlemleri

#### Hesap Oluştur
```http
POST /api/accounts
x-device-id: your-device-id
Content-Type: application/json

{
  "name": "Ana Portföy"
}
```

### Varlık İşlemleri

#### Varlık Ekle
```http
POST /api/assets
x-device-id: your-device-id
Content-Type: application/json

{
  "accountId": "account-uuid",
  "type": "CRYPTO",
  "symbol": "BTC",
  "quantity": 0.5,
  "buyPrice": 42000
}
```

**Desteklenen Varlık Tipleri:**
- `GOLD` - Altın (XAU, XAG)
- `STOCK` - Hisse senedi (AAPL, TSLA, vb.)
- `CRYPTO` - Kripto para (BTC, ETH, vb.)
- `REAL_ESTATE` - Gayrimenkul
- `OTHER` - Diğer

#### Tüm Varlıkları Listele
```http
GET /api/assets
x-device-id: your-device-id
```

**Yanıt:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "CRYPTO",
      "symbol": "BTC",
      "quantity": 0.5,
      "buyPrice": 42000,
      "currentPrice": 45000,
      "totalValue": 22500,
      "profitLoss": 1500,
      "profitLossPercent": 7.14
    }
  ]
}
```

#### Bildirim Kuralı Ekle
```http
POST /api/assets/{assetId}/notification
x-device-id: your-device-id
Content-Type: application/json

{
  "thresholdPercent": 10,
  "direction": "UP"
}
```

### Portföy İşlemleri

#### Portföy Özeti
```http
GET /api/portfolio/summary
x-device-id: your-device-id
```

**Yanıt:**
```json
{
  "success": true,
  "data": {
    "totalValue": 50000,
    "totalInvested": 45000,
    "totalProfitLoss": 5000,
    "totalProfitLossPercent": 11.11,
    "distribution": {
      "CRYPTO": { "value": 25000, "percent": 50 },
      "GOLD": { "value": 15000, "percent": 30 },
      "STOCK": { "value": 10000, "percent": 20 }
    }
  }
}
```

### AI Analiz

#### Portföy Analizi
```http
POST /api/ai/portfolio-analysis
x-device-id: your-device-id
Content-Type: application/json

{
  "userId": "user-uuid"
}
```

**Yanıt:**
```json
{
  "success": true,
  "data": {
    "riskScore": 65,
    "concentrationWarnings": [
      "BTC portföyünüzün %50'sini oluşturuyor. Aşırı yoğunlaşma riski."
    ],
    "recommendations": [
      "Kripto oranınızı %30'a düşürün",
      "Altın pozisyonu ekleyerek çeşitlendirin"
    ],
    "volatilityAlerts": [
      "DOGE yüksek volatiliteye sahip"
    ],
    "summary": "Portföyünüz yüksek riskli..."
  }
}
```

### Sistem Endpoint'leri

#### Sağlık Kontrolü
```http
GET /api/health
```

#### Cron Job (Manuel Tetikleme)
```http
GET /api/cron/update-prices
Authorization: Bearer {CRON_SECRET}
```

## Proje Yapısı

```
├── app/
│   ├── api/
│   │   ├── users/register/route.ts
│   │   ├── accounts/route.ts
│   │   ├── assets/
│   │   │   ├── route.ts
│   │   │   └── [id]/notification/route.ts
│   │   ├── portfolio/summary/route.ts
│   │   ├── ai/portfolio-analysis/route.ts
│   │   ├── cron/update-prices/route.ts
│   │   └── health/route.ts
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── prisma.ts          # Prisma client
│   ├── types.ts           # TypeScript types
│   ├── errors.ts          # Custom error classes
│   ├── validations.ts     # Zod schemas
│   ├── api-utils.ts       # API utilities
│   ├── price-service.ts   # External price APIs
│   └── ai-service.ts      # Gemini AI integration
├── prisma/
│   └── schema.prisma      # Database schema
├── middleware.ts          # CORS & security headers
├── vercel.json           # Cron job config
└── package.json
```

## Fiyat Kaynakları

| Varlık Tipi | Kaynak | API Key |
|-------------|--------|---------|
| Kripto | CoinGecko | Gerekmez |
| Altın | GoldAPI.io | Gerekli |
| Hisse | Finnhub | Gerekli |

## Güvenlik

- Tüm endpoint'ler `x-device-id` header kontrolü yapar
- Rate limiting (100 istek/dakika/cihaz)
- Input validation (Zod)
- CORS koruması
- Security headers (XSS, CSRF, Clickjacking)

## Hata Kodları

| Kod | HTTP | Açıklama |
|-----|------|----------|
| `VALIDATION_ERROR` | 400 | Geçersiz input |
| `UNAUTHORIZED` | 401 | x-device-id eksik/geçersiz |
| `NOT_FOUND` | 404 | Kaynak bulunamadı |
| `RATE_LIMIT_EXCEEDED` | 429 | Çok fazla istek |
| `EXTERNAL_API_ERROR` | 502 | Dış API hatası |
| `INTERNAL_ERROR` | 500 | Sunucu hatası |

## Lisans

MIT
