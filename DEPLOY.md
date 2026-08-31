# AutoUPI — One-Click Vercel Deployment

Live domain: **https://autoupi.shop**

## 1. Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Push this repo to GitHub (Lovable → GitHub sync works too).
2. Vercel → **Add New → Project → Import** this repo.
3. Framework preset: **Other** (already configured in `vercel.json`).
   - Install: `npm install`
   - Build: `BUILD_TARGET=vercel NITRO_PRESET=vercel npm run build`
4. Paste the environment variables below → **Deploy**. Done.

## 2. Environment variables (copy from `.env.example`)

| Key | Where used |
| --- | --- |
| `SUPABASE_URL` | server |
| `SUPABASE_ANON_KEY` | server |
| `SUPABASE_SERVICE_ROLE_KEY` | server only (never in browser) |
| `VITE_SUPABASE_URL` | browser |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser |
| `VITE_SUPABASE_PROJECT_ID` | browser |
| `LOVABLE_CRON_SECRET` | internal cron endpoints |

Set them for **Production, Preview and Development**, then redeploy once.

## 3. Custom domain

Vercel → Project → Settings → **Domains** → add `autoupi.shop` and `www.autoupi.shop`.
The app's public base URL is hardcoded in `src/lib/public-base.ts` as
`https://autoupi.shop`, so `payment_url` in API responses always points to your domain.

## 4. Cron jobs (already configured in `vercel.json`)

| Path | Schedule (UTC) | Purpose |
| --- | --- | --- |
| `/api/public/payments/poll` | every minute | reads Gmail inbox, matches payments |
| `/api/public/v1/internal/dispatch-webhooks` | every minute | retries merchant webhooks |

Vercel Cron calls them on schedule automatically — no extra setup needed.
Both handlers are idempotent, so extra calls are harmless.

## 5. Daily data purge (12:00 AM IST)

A Supabase `pg_cron` job (`30 18 * * *` UTC = 00:00 IST) runs `purge_daily_data()`
and permanently deletes rows from:

- `orders`
- `payment_history`
- `processed_emails`
- `webhook_deliveries`

**Never deleted:** merchant accounts, API keys, webhook secrets, profiles,
UPI settings, connected Gmail accounts. So the gateway keeps working exactly
the same the next morning — only the previous day's transaction records are gone.
Merchants must keep their own copy of order/payment records on their side
(the webhook already gives them everything they need).
