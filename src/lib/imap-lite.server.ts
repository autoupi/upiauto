// Minimal IMAP client that works on BOTH runtimes:
// - Cloudflare Workers / Lovable preview -> `cloudflare:sockets` (TCP + implicit TLS)
// - Node (Vercel, local dev)               -> `node:tls`
// imapflow cannot be used on Workers: it needs Node's raw net/tls, which is a stub
// there, so every login dies with "Unexpected close".

export interface RawImapMessage {
  seq: number;
  /** Full RFC822 source of the message. */
  source: string;
}

interface Conn {
  write(data: string): Promise<void>;
  /** Reads the next chunk as a latin1 (byte-exact) string, or null on EOF. */
  read(): Promise<string | null>;
  close(): Promise<void>;
}

async function openConn(host: string, port: number): Promise<Conn> {
  // Cloudflare Workers
  try {
    const spec = "cloudflare" + ":sockets";
    const mod: any = await import(/* @vite-ignore */ spec);
    if (mod?.connect) {
      const socket = mod.connect({ hostname: host, port }, { secureTransport: "on", allowHalfOpen: false });
      const writer = socket.writable.getWriter();
      const reader = socket.readable.getReader();
      const enc = new TextEncoder();
      return {
        async write(data) { await writer.write(enc.encode(data)); },
        async read() {
          const { value, done } = await reader.read();
          if (done || !value) return null;
          let s = "";
          const bytes = value as Uint8Array;
          for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
          return s;
        },
        async close() { try { await socket.close(); } catch { /* ignore */ } },
      };
    }
  } catch { /* not a Workers runtime */ }

    // Node
    const tls: any = await import("node:tls");
    const socket: any = await new Promise((resolve, reject) => {
      const s = tls.connect({ host, port, servername: host }, () => resolve(s));
      s.once("error", reject);
    });
    socket.setEncoding("latin1");
    const queue: string[] = [];
    let ended = false;
    let notify: (() => void) | null = null;
    socket.on("data", (c: string) => { queue.push(c); notify?.(); });
    socket.on("end", () => { ended = true; notify?.(); });
    socket.on("close", () => { ended = true; notify?.(); });
    socket.on("error", () => { ended = true; notify?.(); });
    return {
      write: (data) => new Promise((res, rej) => socket.write(data, (e: Error) => (e ? rej(e) : res()))),
      async read() {
        while (!queue.length && !ended) {
          await new Promise<void>((r) => { notify = r; });
          notify = null;
        }
        return queue.shift() ?? null;
      },
      async close() { try { socket.destroy(); } catch { /* ignore */ } },
    };
}

/** IMAP protocol reader: understands CRLF lines and {n} literals. */
class ImapSession {
  private buf = "";
  private tagN = 0;
  constructor(private conn: Conn) {}

    private async pull(): Promise<void> {
      const chunk = await this.conn.read();
      if (chunk === null) throw new Error("Unexpected close by mail server");
      this.buf += chunk;
    }

    private async line(): Promise<string> {
      for (;;) {
        const i = this.buf.indexOf("\r\n");
        if (i >= 0) {
          const l = this.buf.slice(0, i);
          this.buf = this.buf.slice(i + 2);
          return l;




            }
            await this.pull();
        }
    }

    private async bytes(n: number): Promise<string> {
      while (this.buf.length < n) await this.pull();
      const out = this.buf.slice(0, n);
      this.buf = this.buf.slice(n);
      return out;
    }

    async greeting(): Promise<void> {
      const l = await this.line();
      if (!/^\* (OK|PREAUTH)/i.test(l)) throw new Error(`IMAP server refused connection: ${l}`);
    }

    /** Sends a command and returns every response line/literal until the tagged reply. */
    async cmd(command: string): Promise<string[]> {
      const tag = `a${++this.tagN}`;
      await this.conn.write(`${tag} ${command}\r\n`);
      const out: string[] = [];
      for (;;) {
        let l = await this.line();
        // Inline literals: `... {123}` -> next 123 bytes are payload.
        for (;;) {
          const m = /\{(\d+)\}$/.exec(l);
          if (!m) break;
          const payload = await this.bytes(Number(m[1]));
          l = l.slice(0, m.index) + payload + (await this.line());
        }
        if (l.startsWith(`${tag} `)) {
          const rest = l.slice(tag.length + 1);
          if (/^OK/i.test(rest)) return out;
          throw new Error(rest.replace(/^(NO|BAD)\s*/i, "") || "IMAP command failed");
        }
        out.push(l);
      }
    }

    async close(): Promise<void> {
      try { await this.cmd("LOGOUT"); } catch { /* ignore */ }
      await this.conn.close();
    }
}

function quote(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function login(host: string, port: number, user: string, pass: string): Promise<ImapSession> {
  const session = new ImapSession(await openConn(host, port));
  await session.greeting();
  try {
    await session.cmd(`LOGIN ${quote(user)} ${quote(pass)}`);
  } catch (e) {
    await session.close();
    const msg = e instanceof Error ? e.message : String(e);
    if (/auth|credential|invalid|login|password/i.test(msg)) {
      throw new Error("Login failed — email or App Password is incorrect (IMAP must be enabled in Gmail).");
    }
    throw new Error(msg);
  }
  return session;
}

/** Never let a stuck socket hang the request (UI showed "connecting…" forever). */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** Log in and open INBOX — used by the Settings connect/status check. */
export async function imapVerify(host: string, port: number, user: string, pass: string): Promise<void> {
  await withTimeout((async () => {
    const session = await login(host, port, user, pass);
    try {
      await session.cmd("SELECT INBOX");
    } finally {
      await session.close();
    }
  })(), 20_000, "IMAP login");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Fetch full sources of INBOX messages received since `since`, newest first. */
export async function imapFetchSince(opts: {
  host: string;
  port: number;
  user: string;
  pass: string;




  since: Date;
  max: number;
}): Promise<RawImapMessage[]> {
  const session = await login(opts.host, opts.port, opts.user, opts.pass);
  try {
    await session.cmd("SELECT INBOX");
    const d = opts.since;
    const dateStr = `${String(d.getUTCDate()).padStart(2, "0")}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
    const searchLines = await session.cmd(`SEARCH SINCE ${dateStr}`);
    const seqs = searchLines
      .filter((l) => /^\* SEARCH/i.test(l))
      .flatMap((l) => l.replace(/^\* SEARCH/i, "").trim().split(/\s+/))
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => b - a)
      .slice(0, opts.max);

      const out: RawImapMessage[] = [];
      for (const seq of seqs) {
        try {
          const lines = await session.cmd(`FETCH ${seq} (BODY.PEEK[])`);
          // Literal payloads were already inlined by cmd(); the message source is the
          // longest chunk we got back.
          const source = lines.reduce((a, b) => (b.length > a.length ? b : a), "");
          out.push({ seq, source });
        } catch { /* skip unreadable message */ }
      }
      return out;
    } finally {
      await session.close();
    }
}
