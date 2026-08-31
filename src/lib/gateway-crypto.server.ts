import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

export function generateApiKey() {
  // public format: lk_live_<random32>
  const raw = randomBytes(24).toString("hex");
  return `lk_live_${raw}`;
}

export function generateWebhookSecret() {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function signWebhook(secret: string, body: string) {
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return { header: `t=${t},v1=${v1}`, t, v1 };
}

export function safeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}
