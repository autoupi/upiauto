import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";




import { getMyApiKey, acknowledgeRevealedKey, rotateMyApiKey } from "@/lib/user-keys.functions";
import { Copy, KeyRound, FileText, ShieldAlert, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { swalSuccess } from "@/lib/swal";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/api-keys")({
  head: () => ({ meta: [{ title: "AutoUPI | API Keys" }] }),
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const fetchKey = useServerFn(getMyApiKey);
  const ack = useServerFn(acknowledgeRevealedKey);
  const rotate = useServerFn(rotateMyApiKey);
  const [info, setInfo] = useState<{ prefix: string; webhookSecret: string; apiKeyPlain: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);

  async function handleRotate() {
    setRotating(true);
    try {
      const r = await rotate();
      setInfo((prev) => (prev ? { ...prev, prefix: r.prefix, apiKeyPlain: r.apiKeyPlain } : prev));
      swalSuccess("New API key generated — copy it now");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRotating(false);
    }
  }

  useEffect(() => {
    fetchKey().then((d) => setInfo(d)).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  }, []);

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    swalSuccess(`${label} copied`);
  }

  async function dismissReveal() {
    await ack();
    setInfo((prev) => (prev ? { ...prev, apiKeyPlain: null } : prev));
    swalSuccess("Acknowledged");
  }

  if (loading) return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3"><Skeleton className="w-10 h-10 rounded-lg" /><Skeleton className="h-8 w-64 rounded-md" /></div>
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
  if (!info) return <div className="text-center text-red-600">Could not load keys</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0d4a3a]/10 flex items-center justify-center">
             <KeyRound className="w-5 h-5 text-[#0d4a3a]" />
          </div>
          <h1 className="text-2xl font-bold text-[#0d1b2a]">Your API Credentials</h1>
        </div>
        <a href="/docs" target="_blank" rel="noopener" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-
[#0d4a3a]/30 text-[#0d4a3a] font-medium hover:bg-[#0d4a3a] hover:text-white transition">
          <FileText className="w-4 h-4" /> View Documentation
        </a>
      </div>

      {info.apiKeyPlain && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 text-amber-700 font-semibold mb-2">
            <ShieldAlert className="w-5 h-5" /> Save your API key — it will not be shown again
          </div>
          <Field label="API Key (plaintext)" value={info.apiKeyPlain} onCopy={() => copy(info.apiKeyPlain!, "API key")} mono />
          <button onClick={dismissReveal} className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0d4a3a] text-white font-medium
hover:bg-[#0a3d30]">
            <CheckCircle2 className="w-4 h-4" /> I've saved it
          </button>
        </div>
      )}

       <div className="bg-white rounded-2xl shadow-xl border border-black/5 p-6 space-y-4">
         <Field label="API Key prefix" value={info.prefix + "…"} onCopy={() => copy(info.prefix, "Prefix")} mono />
         <Field label="Webhook Secret" value={info.webhookSecret} onCopy={() => copy(info.webhookSecret, "Webhook secret")} mono />

         <div className="pt-4 border-t border-gray-100">
           <div className="flex items-start justify-between gap-4">




              <div>
                <div className="font-semibold text-[#0d1b2a] flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Regenerate API key
                </div>
                <div className="text-xs text-gray-500 mt-1 max-w-md">
                  If your key is leaked or compromised, regenerate it. The old key will stop working immediately and cannot be used to create new
orders.
               </div>
             </div>
             <AlertDialog>
               <AlertDialogTrigger asChild>
                 <button disabled={rotating} className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white font-medium
hover:bg-red-700 disabled:opacity-60">
                   <RefreshCw className={`w-4 h-4 ${rotating ? "animate-spin" : ""}`} /> Regenerate
                 </button>
               </AlertDialogTrigger>
               <AlertDialogContent>
                 <AlertDialogHeader>
                   <AlertDialogTitle>Regenerate API key?</AlertDialogTitle>
                   <AlertDialogDescription>
                     Your current API key will be invalidated immediately. Any site or service still using the old key will start failing until you
update it with the new one. This cannot be undone.
                   </AlertDialogDescription>
                 </AlertDialogHeader>
                 <AlertDialogFooter>
                   <AlertDialogCancel>Cancel</AlertDialogCancel>
                   <AlertDialogAction onClick={handleRotate} className="bg-red-600 hover:bg-red-700">
                     Yes, regenerate
                   </AlertDialogAction>
                 </AlertDialogFooter>
               </AlertDialogContent>
             </AlertDialog>
          </div>
        </div>
      </div>

        <div className="bg-white/70 rounded-2xl border border-black/5 p-5 text-sm text-gray-600">
          Use these credentials to integrate your site. See the{" "}
          <a href="/docs" target="_blank" rel="noopener" className="text-[#0d4a3a] underline font-medium">full documentation</a>{" "}
          — no login needed.
        </div>
      </div>
    );
}

function Field({ label, value, onCopy, mono }: { label: string; value: string; onCopy: () => void; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500 font-medium mb-1.5">{label}</div>
      <div className="flex gap-2">
        <code className={`flex-1 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm break-all ${mono ? "font-mono" : ""}`}>{value}
</code>
        <button onClick={onCopy} className="px-3 rounded-lg border border-gray-200 hover:bg-[#0d4a3a] hover:text-white hover:border-[#0d4a3a]
transition" title="Copy">
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
