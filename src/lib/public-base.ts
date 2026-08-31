// Public base URL of the gateway — yeh wahi domain hai jo merchants ko dikhta hai
// (docs ke examples aur API response ka `payment_url`).
//
// Vercel pe apna custom domain add karne ke baad sirf yahi ek line badalni hai:
//   export const PUBLIC_BASE_URL = "https://owndomain.com";
//
// Khali string ("") rakhne par code request ke host se khud base bana lega.
export const PUBLIC_BASE_URL: string = "https://www.panmeai.in"; // "" = auto-detect from request host.

/** Resolve the public origin for building user-facing links. */
export function resolvePublicOrigin(request: Request): string {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL.replace(/\/+$/, "");

    const fwdHost = request.headers.get("x-forwarded-host");
    if (fwdHost) {
      const proto = request.headers.get("x-forwarded-proto") ?? "https";
      return `${proto}://${fwdHost}`;
    }

    return new URL(request.url).origin;
}
