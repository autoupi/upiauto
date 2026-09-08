import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, updateMyProfile } from "@/lib/user-keys.functions";
import {
  getMyEmailAccount,
  connectMyEmailAccount,
  checkMyEmailAccount,
  disconnectMyEmailAccount,
  type EmailAccountStatus,
} from "@/lib/email-account.functions";
import { Settings as SettingsIcon, Mail } from "lucide-react";

import { toast } from "sonner";
import { swalSuccess } from "@/lib/swal";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "AutoUPI | Settings" }] }),
  component: SettingsPage,
});

const DEMO_EMAIL = "demo@gmail.com";
const DEMO_UPI = "Q168071078@ybl";

function SettingsPage() {
  const get = useServerFn(getMyProfile);
  const save = useServerFn(updateMyProfile);

  const [displayName, setName] = useState("");
  const [upiId, setUpi] = useState("");
  const [payeeName, setPayee] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isDemo = email.trim().toLowerCase() === DEMO_EMAIL;

  useEffect(() => {
    get()
      .then((p) => {
        setName(p.display_name ?? "");
        const userEmail = p.email ?? "";
        setEmail(userEmail);
        if (userEmail.trim().toLowerCase() === DEMO_EMAIL) {
          setUpi(DEMO_UPI);
        } else {
          setUpi(p.upi_id ?? "");
        }
        setPayee(p.payee_name ?? "");
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await save({ data: { display_name: displayName, upi_id: isDemo ? DEMO_UPI : upiId, payee_name: payeeName } });
      swalSuccess("Settings saved successfully");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header banner — matches Payment History style */}
      <div className="rounded-2xl bg-gradient-to-r from-[#0d4a3a] to-[#1b6e54] shadow-xl p-6 flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
             <SettingsIcon className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
             <h1 className="text-2xl sm:text-3xl font-bold text-white truncate">Settings</h1>
             <p className="text-sm text-emerald-100/90 flex items-center gap-1.5 mt-0.5">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 inline-block" />
               Account settings
             </p>
          </div>
        </div>
        <span className="hidden sm:inline-flex px-3 py-1 rounded-full bg-white/10 text-white text-xs font-medium border border-white/20">
          {email || "—"}
        </span>
      </div>

       {loading ? (
         <div className="grid lg:grid-cols-2 gap-6">
           {[0, 1, 2].map((i) => (
             <div key={i} className="bg-white rounded-2xl shadow-xl border border-black/5 p-8 space-y-3">
                <Skeleton className="h-7 w-48 rounded-md" />
                <Skeleton className="h-32 w-full rounded-lg" />
             </div>
           ))}
         </div>
       ) : (
         <div className="grid gap-6 items-start">
           {/* Account Settings card */}
           <div className="bg-white rounded-2xl shadow-xl border border-black/5 p-8">
             <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-[#0d4a3a]/10 flex items-center justify-center">
                  <SettingsIcon className="w-5 h-5 text-[#0d4a3a]" />
                </div>
                <h2 className="text-xl font-bold text-[#0d1b2a]">Account Settings</h2>
             </div>

            <form onSubmit={submit} className="space-y-4">
              <Row label="Email (read-only)">
                <input value={email} disabled className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-500" />
              </Row>
              <Row label="Display name">
                <input value={displayName} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#0d4a3a] outline-none" />
              </Row>
              <Row label={isDemo ? "UPI ID (pre-configured · locked)" : "UPI ID (your receiving VPA)"}>
                {isDemo ? (
                  <input
                    value={DEMO_UPI}
                    disabled
                    readOnly
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 font-mono"
                  />
                ) : (
                  <input value={upiId} onChange={(e) => setUpi(e.target.value)} placeholder="yourname@bank" className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#0d4a3a] outline-none font-mono" />
                )}
              </Row>
              <Row label="Payee name (shown to payer)">
                <input value={payeeName} onChange={(e) => setPayee(e.target.value)} placeholder="Your Business Name" className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#0d4a3a] outline-none" />
              </Row>

              <button type="submit" disabled={saving} className="w-full py-3.5 rounded-lg bg-[#0d4a3a] hover:bg-[#0a3d30] text-white font-bold tracking-wide transition disabled:opacity-60">
                 {saving ? "Saving…" : "SAVE CHANGES"}
              </button>
            </form>
          </div>

           <EmailInboxCard isDemo={isDemo} />

          </div>
        )}
      </div>
    );
}

function EmailInboxCard({ isDemo }: { isDemo: boolean }) {
  const load = useServerFn(getMyEmailAccount);
  const connect = useServerFn(connectMyEmailAccount);
  const check = useServerFn(checkMyEmailAccount);
  const disconnect = useServerFn(disconnectMyEmailAccount);

    const [state, setState] = useState<EmailAccountStatus | null>(null);
    const [inboxEmail, setInboxEmail] = useState("");
    const [appPassword, setAppPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [checking, setChecking] = useState(false);

    useEffect(() => {
      let alive = true;
      load()
        .then((s) => {
          if (!alive) return;
          setState(s);
          setInboxEmail(s.email_address ?? "");
        })
        .catch((e: any) => toast.error(e.message));

      // Real-time status: re-verify the IMAP login periodically.
      const tick = async () => {
        try {
          const s = await check();
          if (alive && s.email_address) setState(s);
        } catch { /* transient */ }
      };
      const id = setInterval(tick, 30_000);
      return () => { alive = false; clearInterval(id); };
    }, []);

    const connected = state?.status === "connected";

    async function onConnect(e: React.FormEvent) {
      e.preventDefault();
      setBusy(true);
      try {
        const s = await connect({ data: { email: inboxEmail.trim(), app_password: appPassword } });
        setState(s);
        setAppPassword("");
        swalSuccess("Email connected successfully");
      } catch (err: any) {
        toast.error(err.message);
        setState((prev) => prev ? { ...prev, status: "disconnected", last_error: err.message } : prev);
      } finally {
        setBusy(false);
      }
    }

    async function onCheck() {
      setChecking(true);
      try {
        const s = await check();
        setState(s);
        if (s.status === "connected") swalSuccess("Email is connected");
        else toast.error(s.last_error ?? "Email is disconnected");
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setChecking(false);
      }
    }

    async function onDisconnect() {
      if (isDemo) return;
      setBusy(true);
      try {
        const s = await disconnect();
        setState(s);
        setAppPassword("");
        swalSuccess("Email disconnected");
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setBusy(false);
      }
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-black/5 p-8">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0d4a3a]/10 flex items-center justify-center">
             <Mail className="w-5 h-5 text-[#0d4a3a]" />
          </div>
          <h2 className="text-xl font-bold text-[#0d1b2a]">Payment Email (App Password)</h2>
        </div>
        <span
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${
             connected
               ? "bg-emerald-50 text-emerald-700 border-emerald-200"
               : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>


       {isDemo && (
         <div className="mb-4 rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-700">
           This is a demo account. The inbox connection is pre-configured and cannot be disconnected.
         </div>
       )}

       <form onSubmit={onConnect} className="space-y-4">
         <Row label="Inbox email">
           <input
              type="email"
              value={inboxEmail}
              onChange={(e) => setInboxEmail(e.target.value)}
              placeholder="youremail@gmail.com"
              disabled={isDemo}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#0d4a3a] outline-none font-mono disabled:bg-gray-50 disabled:text-gray-500"
           />
         </Row>
         <Row label="App Password (16 characters)">
           <input
              type="password"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              placeholder={connected ? "•••••••••••••••• (saved)" : "abcd efgh ijkl mnop"}
              disabled={isDemo}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#0d4a3a] outline-none font-mono disabled:bg-gray-50 disabled:text-gray-500"
           />
         </Row>

         {state?.last_error && !connected ? (
           <p className="text-sm text-red-600">{state.last_error}</p>
         ) : null}
         {state?.last_checked_at ? (
           <p className="text-xs text-gray-500">
             Last checked: {new Date(state.last_checked_at).toLocaleString()}
           </p>
         ) : null}

         <div className="flex flex-col sm:flex-row gap-3">
           <button
             type="submit"
             disabled={busy || isDemo || !inboxEmail.trim() || appPassword.trim().length < 8}
             className="flex-1 py-3.5 rounded-lg bg-[#0d4a3a] hover:bg-[#0a3d30] text-white font-bold tracking-wide transition disabled:opacity-60"
           >
             {busy ? "Connecting…" : connected ? "UPDATE & RECONNECT" : "CONNECT EMAIL"}
           </button>
           <button
             type="button"
             onClick={onCheck}
             disabled={checking || !state?.email_address}
             className="py-3.5 px-5 rounded-lg border border-[#0d4a3a] text-[#0d4a3a] font-bold tracking-wide transition disabled:opacity-60"
           >
             {checking ? "Checking…" : "CHECK STATUS"}
           </button>
           {state?.email_address ? (
             <button
               type="button"
               onClick={onDisconnect}
               disabled={busy || isDemo}
               className="py-3.5 px-5 rounded-lg border border-red-300 text-red-600 font-bold tracking-wide transition disabled:opacity-60"
             >
               DISCONNECT
             </button>
           ) : null}
          </div>
        </form>
      </div>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}
