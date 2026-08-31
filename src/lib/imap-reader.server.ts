// Gmail reading via IMAP + App Password (no OAuth, no connector, no Google Cloud project).
//
// Uses the runtime-agnostic client in ./imap-lite.server (Cloudflare sockets on the
// Lovable/Workers runtime, node:tls on Vercel/Node). imapflow is NOT used because it
// needs Node's raw net/tls, which does not exist on Workers ("Unexpected close").
//
// Required env (server only):
//    GMAIL_IMAP_USER      -> the Gmail address that receives the UPI credit alerts
//    GMAIL_APP_PASSWORD   -> 16-char Google App Password (Google Account > Security > App passwords)
// Optional:
//    GMAIL_IMAP_HOST (default imap.gmail.com)
//    GMAIL_IMAP_PORT (default 993)
export interface InboxMessage {
   /** Stable unique id per email (RFC822 Message-ID header). Used as the dedupe/lock key. */
   id: string;
   subject: string;
   from: string;
   /** Plain-text-ish body snippet (first ~4KB, HTML stripped). Amount often lives here, not in the subject. */
   body: string;
   /** ms epoch — equivalent of Gmail's internalDate. */
   internalDate: number;
}



function imapHost() {
  return process.env["GMAIL_IMAP_HOST"] || "imap.gmail.com";
}
function imapPort() {
  return Number(process.env["GMAIL_IMAP_PORT"] || 993);
}

function latin1ToUtf8(s: string): string {
  try {
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return s;
  }
}

function b64decode(s: string): string {
  try {
    return atob(s.replace(/[^A-Za-z0-9+/=]/g, ""));
  } catch {
    return "";
  }
}

/** RFC 2047 encoded-word decode for headers (Subject/From). */
function decodeWords(input: string): string {
  return input.replace(/=\?[^?]+\?([bBqQ])\?([^?]*)\?=/g, (_m, enc: string, text: string) => {
    const raw = enc.toLowerCase() === "b"
      ? b64decode(text)
      : text.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_x, h) => String.fromCharCode(parseInt(h, 16)));




      return latin1ToUtf8(raw);
    });
}

function parseSource(source: string): { headers: Record<string, string>; body: string } {
  const sep = source.search(/\r?\n\r?\n/);
  const headerBlock = (sep >= 0 ? source.slice(0, sep) : source).replace(/\r?\n[ \t]+/g, " ");
  const rest = sep >= 0 ? source.slice(sep).replace(/^\r?\n\r?\n/, "") : "";
  const headers: Record<string, string> = {};
  for (const line of headerBlock.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }

    // Multipart: decode each part according to its own transfer encoding.
    const boundary = /boundary="?([^";\r\n]+)"?/i.exec(headers["content-type"] ?? "")?.[1];
    const chunks: string[] = [];
    const decodePart = (partHeaders: string, partBody: string) => {
      const cte = /content-transfer-encoding:\s*([\w-]+)/i.exec(partHeaders)?.[1]?.toLowerCase();
      if (cte === "base64") return latin1ToUtf8(b64decode(partBody));
      return latin1ToUtf8(partBody);
    };
    if (boundary) {
      for (const part of rest.split(`--${boundary}`)) {
        const s = part.search(/\r?\n\r?\n/);
        if (s < 0) continue;
        chunks.push(decodePart(part.slice(0, s), part.slice(s).replace(/^\r?\n\r?\n/, "")));
      }
    } else {
      chunks.push(decodePart(headerBlock, rest));
    }
    return { headers, body: chunks.join(" ") };
}

function htmlToText(input: string): string {
  // Light quoted-printable decode: soft line breaks + =XX escapes.
  const decoded = input
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));
  return decoded
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#8377;|&rupee;/gi, "₹")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetch recent messages from the monitored inbox.
 * Same selection rules as the old Gmail API query:
 *    (from:<sender> OR ...) newer_than:<minutes>m   with maxResults cap.
 */
export async function fetchRecentMessages(opts: {
   senders: string[];
   withinMinutes: number;
   maxResults: number;
   /** Per-merchant credentials (dashboard). Falls back to env vars when omitted. */
   user?: string;
   pass?: string;
}): Promise<InboxMessage[]> {
   const user = opts.user || process.env["GMAIL_IMAP_USER"];
   const pass = opts.pass || process.env["GMAIL_APP_PASSWORD"];
   if (!user || !pass) {
     throw new Error("Gmail IMAP not configured (GMAIL_IMAP_USER / GMAIL_APP_PASSWORD)");
   }

    const { imapFetchSince } = await import("@/lib/imap-lite.server");
    const since = new Date(Date.now() - opts.withinMinutes * 60_000);
    const raw = await imapFetchSince({
      host: imapHost(),
      port: imapPort(),
      user,
      pass,
      since,
      max: Math.max(opts.maxResults * 4, 20),
    });

    const out: InboxMessage[] = [];
    for (const msg of raw) {
      const { headers, body: rawBody } = parseSource(msg.source);
      const from = decodeWords(headers["from"] ?? "");
      const fromLower = from.toLowerCase();
      if (!opts.senders.some((s) => fromLower.includes(s.toLowerCase()))) continue;

     const internalDate = new Date(headers["date"] ?? Date.now()).getTime();
     if (!Number.isFinite(internalDate) || internalDate < since.valueOf()) continue;

     out.push({
       id: (headers["message-id"] ?? "").replace(/[<>]/g, "") || `seq-${msg.seq}@${user}`,
       subject: decodeWords(headers["subject"] ?? ""),
       from,




          body: htmlToText(rawBody).slice(0, 4000),
          internalDate,
        });
    }

    // Newest first, capped like maxResults.
    return out.sort((a, b) => b.internalDate - a.internalDate).slice(0, opts.maxResults);
}

/**
  * Live connection check: log in with the given App Password and open INBOX.
  * Throws a human-readable error when the credentials are wrong/revoked.
  */
export async function verifyImapLogin(user: string, pass: string): Promise<{ ok: true }> {
   const { imapVerify } = await import("@/lib/imap-lite.server");
   try {
     await imapVerify(imapHost(), imapPort(), user, pass);
   } catch (e) {
     const msg = e instanceof Error ? e.message : String(e);
     if (/auth|credential|invalid|login|password/i.test(msg)) {
       throw new Error("Login failed — email or App Password is incorrect (IMAP must be enabled).");
     }
     throw new Error(msg);
   }
   return { ok: true };
}
