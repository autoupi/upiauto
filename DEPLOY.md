# AutoUPI — One-Click Vercel Deployment

Live domain: **https://www.autoupi.shop**

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

> **`LOVABLE_CRON_SECRET` is NOT required.** It is not used by the app code at
> all (the cron endpoints are public and idempotent). You do not need to set it
> on Vercel — the app has zero Lovable dependency at runtime.

Set them for **Production, Preview and Development**, then redeploy once.

## 3. Custom domain

Vercel → Project → Settings → **Domains** → add `autoupi.shop` and `www.autoupi.shop`.
The app's public base URL is hardcoded in `src/lib/public-base.ts` as
`https://www.autoupi.shop`, so `payment_url` in API responses always points to your domain.

## 4. Cron jobs (every minute) — Hobby plan setup

Vercel **Hobby (free)** accounts only allow cron jobs that run **once per day**,
so per-minute crons are NOT declared in `vercel.json` (they would block the deploy
with "Hobby accounts are limited to daily cron jobs").

Instead, use a free external cron service — it takes 2 minutes:

1. Go to **https://cron-job.org** → create a free account.
2. Create **Cron Job #1**:
   - URL: `https://www.autoupi.shop/api/public/payments/poll`
   - Schedule: **every minute** (`* * * * *`)
   - Request method: `GET`
3. Create **Cron Job #2**:
   - URL: `https://autoupi.shop/api/public/v1/internal/dispatch-webhooks`
   - Schedule: **every minute** (`* * * * *`)
   - Request method: `GET`

| Path | Purpose |
| --- | --- |
| `/api/public/payments/poll` | reads Gmail inbox, matches payments |
| `/api/public/v1/internal/dispatch-webhooks` | retries merchant webhooks |

Both handlers are public and idempotent, so external calls are safe and extra
calls are harmless.

> On a Vercel **Pro** plan you can instead add the two crons back to
> `vercel.json` with `"schedule": "* * * * *"` and skip cron-job.org.

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
