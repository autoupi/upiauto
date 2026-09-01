# Merchant Embedded QR Payment (No Redirect, No Popup)

Merchant ki apni website par hi "Add Wallet Balance" jaisa section rahega — amount enter karega, usi page par QR generate hoga, payment detect hote hi real-time success dikhega. Customer kabhi autoupi.shop par nahi jayega. Backend payment detection (Gmail IMAP), unique amount, webhook, daily purge — sab existing logic same rahega.

## Changes

### 1. Order Create API me `upi_uri` + QR add karo
File: `src/routes/api/public/v1/orders.ts`
- Response me naye fields:
  - `upi_uri` — encoded deep link: `upi://pay?pa=...&pn=...&am=<payable>&cu=INR&tn=<order_id>`
  - `qr_base64` — server par generate hua QR PNG (data URL), taaki merchant ko koi QR library ki zaroorat na pade
- QR ke liye `qrcode` npm package (pure JS, worker-compatible, koi native binary nahi) install hoga.
- Idempotent-replay response me bhi same fields.
- Koi existing field change/remove nahi — purana redirect flow jaisa hai waisa rahega.

### 2. Order Status API pehle se ready hai
`GET /api/public/v1/orders/{order_id}` already status return karta hai (paid/expired/pending). Embed snippet isi ko 3 second me poll karega. Isme change nahi.

### 3. Ready-made Embed Snippet (copy-paste)
File: `public/embed/panme-pay.js` — ek chhota vanilla-JS widget:
- Merchant apne page par 2 line paste karega: `<div id="panme-pay">` + `<script src="https://www.autoupi.shop/embed/panme-pay.js">` + config (api_key, amount, webhook optional)
- Widget ka flow:
  1. Amount input + "Pay" button
  2. Click par `POST /api/public/v1/orders` → QR inline render (koi popup nahi, koi redirect nahi)
  3. Har 3 second me status poll
  4. `paid` → green success state + merchant ka `onSuccess(order)` callback fire (merchant yahan wallet credit ka apna server call karega) + existing webhook bhi fire hota rahega
  5. `expired` → expire message + retry button
- 5-minute countdown timer display

### 4. Docs update
`src/routes/_authenticated/docs.tsx` me naya section: "Embedded QR (No Redirect)" — snippet ka copy-paste example, `onSuccess` callback usage, aur note ki wallet credit ka final confirmation hamesha webhook se hi karna chahiye (client callback sirf UI ke liye).

## Merchant ko kya karna hoga (integration steps)
1. Apne page par widget div + script tag paste kare (docs me ready code milega)
2. Apni API key config me de
3. Apne server par webhook endpoint rakhe jo `paid` event par wallet credit kare (ye pehle se hi supported hai)
4. Bas — QR, payment detection, success sab usi page par hoga

## Security note
- Embed me API key browser me visible hogi — ye is design ka trade-off hai (Razorpay jaise gateways me bhi public key client-side hoti hai). Status endpoint order sirf same merchant ka deta hai, koi dusra merchant data nahi dekh sakta.
- Wallet credit ka final decision hamesha server webhook se hoga, sirf browser callback se nahi — isse fake success se fraud nahi hoga.

## Kya change NAHI hoga
- Payment detection (IMAP), unique amount logic, webhooks, daily midnight purge, dashboard — sab same
- `/pay/$orderId` hosted page — same rahega (jo merchant redirect chahe use)
