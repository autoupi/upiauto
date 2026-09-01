# Hide Order ID from Pay Page URL

## Goal
Dashboard se QR generate karne par browser ka URL sirf `https://www.autoupi.shop/pay` dikhe — order ID URL mein na aaye. Payment logic, QR, polling — sab same rahega.

## Important clarification (security)
URL mein jo dikhta hai wo sirf ek **random 10-digit order number** hai (`9815218815`) — UPI ID, amount, ya koi personal detail URL mein nahi hoti. Public API endpoint bhi sirf QR render ke liye zaroori fields return karta hai. Fir bhi clean URL chahiye to ye possible hai.

## Changes

### 1. New clean route: `/pay` (no order ID in URL)
- `src/routes/pay.index.tsx` (ya existing structure ke hisab se `src/routes/pay.tsx`) banayenge.
- Ye page order ID ko **sessionStorage** se padhega (URL se nahi), phir wahi existing `/api/public/pay/{orderId}` endpoint se order fetch karega.
- Agar sessionStorage mein order ID nahi mila (direct open / refresh ke baad naya tab), to friendly message dikhega.
- Existing `pay.$orderId.tsx` ka poora UI/logic ek shared component mein move hoga taake dono routes same page render karein — koi duplication nahi.

### 2. Generate page update (`src/routes/_authenticated/generate.tsx`)
- Order banne ke baad: `sessionStorage.setItem("pay_order_id", orderId)` → phir `window.open("/pay", "_blank")`.
- Naye tab mein URL sirf `https://www.autoupi.shop/pay` dikhega.

### 3. Purana route `/pay/$orderId` as-is rahega
- **Kyun zaroori hai:** Merchant API integration mein customer ko `payment_url` (`/pay/{orderId}`) diya jaata hai — wo external log hain, unke paas sessionStorage nahi hoga. Isliye wo route bilkul same rahega, koi breaking change nahi.
- Sirf aapke dashboard ka generate flow clean URL use karega.

### 4. Note / limitation (transparent)
- sessionStorage tab-specific hota hai. Chrome/Edge mein `window.open` se khula naya tab sessionStorage copy kar leta hai — isliye flow kaam karega. Lekin agar user naye tab ka link copy karke **dusre browser/device** mein khole to order ID nahi milega (ye expected hai — dashboard QR aap khud ke liye generate karte ho).
- Refresh same tab mein kaam karega kyunki sessionStorage tab tak rehta hai.

## Kya change NAHI hoga
- Payment matching, unique amount logic, webhook, IMAP, midnight purge — sab untouched.
- Merchant API (`/api/public/v1/orders`) aur uska `payment_url` format — untouched.
- QR images, branding — untouched.

## Verification
- Build check + browser test: generate → naya tab `/pay` clean URL → QR render → status polling kaam kare.
- `/pay/9815218815` jaise purane links bhi ab bhi khulne chahiye.
