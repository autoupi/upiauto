import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { listMyOrders } from "@/lib/history.functions";
import { supabase } from "@/integrations/supabase/client";
import { History as HistoryIcon, CheckCircle2, Clock, XCircle, AlertCircle, Search, X, RefreshCw, Landmark, Maximize2, Minimize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import phonepeUrl from "@/assets/phonepe.png";
import applePaySoundUrl from "@/assets/applepay.mp3";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "AutoUPI | History" }] }),
  component: HistoryPage,
});

type Order = {
   order_id: string;
   requested_amount: number;
   payable_amount: number;
   status: string;
   created_at: string;
   paid_at: string | null;
   expiry_at: string;
   payer_email: string | null;
   payer_name: string | null;
};

const STATUS_MAP: Record<string, { cls: string; icon: any; label: string; accent: string }> = {
   paid: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2, label: "Paid", accent: "bg-emerald-500" },
   pending: { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock, label: "Pending", accent: "bg-amber-400" },
   expired: { cls: "bg-zinc-100 text-zinc-600 border-zinc-200", icon: AlertCircle, label: "Expired", accent: "bg-zinc-300" },
   failed: { cls: "bg-rose-50 text-rose-700 border-rose-200", icon: XCircle, label: "Failed", accent: "bg-rose-500" },
   manual_review: { cls: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: AlertCircle, label: "Review", accent: "bg-yellow-400" },
};

function statusBadge(status: string) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.pending;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${s.cls}`}>
      <Icon className="w-3.5 h-3.5" /> {s.label}
    </span>
  );
}

function useNowTick(enabled: boolean) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setN((n) => (n + 1) % 1_000_000), 1000);
    return () => clearInterval(id);
  }, [enabled]);
}

function formatElapsed(sec: number) {
  if (sec < 0) sec = 0;
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

function PendingTimer({ startIso }: { startIso: string }) {
  const start = useMemo(() => new Date(startIso).getTime(), [startIso]);
  const sec = Math.max(0, Math.floor((Date.now() - start) / 1000));
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold tabular-nums">
      <Clock className="w-3 h-3" />
      {formatElapsed(sec)}
    </span>
  );
}

function elapsedSeconds(startIso: string, endIso: string | null) {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();




    return Math.max(0, Math.floor((end - start) / 1000));
}

function TimeTaken({ o }: { o: Order }) {
  const isPending = o.status === "pending";
  const start = useMemo(() => o.created_at, [o.created_at]);
  const end = useMemo(() => {
    if (o.status === "paid") return o.paid_at;
    if (o.status === "expired") return o.expiry_at;
    return null;
  }, [o.status, o.paid_at, o.expiry_at]);

    const [sec, setSec] = useState(() => elapsedSeconds(start, end));
    useEffect(() => {
      if (!isPending) {
        setSec(elapsedSeconds(start, end));
        return;
      }
      setSec(elapsedSeconds(start, null));
      const id = setInterval(() => setSec(elapsedSeconds(start, null)), 1000);
      return () => clearInterval(id);
    }, [start, end, isPending]);

    const isPaid = o.status === "paid";
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold tabular-nums ${
          isPaid
            ? "bg-emerald-50 border-emerald-200 text-emerald-600"
            : "bg-zinc-50 border-zinc-200 text-zinc-500"
        }`}
      >
        {isPaid ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
        {formatElapsed(sec)}
      </span>
    );
}

type Provider = "phonepe" | "paytm" | "other";
function detectProvider(o: Order): Provider {
  const hay = `${o.payer_email ?? ""} ${o.payer_name ?? ""}`.toLowerCase();
  if (hay.includes("phonepe")) return "phonepe";
  if (hay.includes("paytm")) return "paytm";
  return "other";
}

function ProviderChip({ p }: { p: Provider }) {
  if (p === "phonepe") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#5F259F]/10 border border-[#5F259F]/20">
        <img src={phonepeUrl} alt="PhonePe" className="w-4 h-4" />
        <span className="text-[11px] font-semibold text-[#5F259F]">PhonePe</span>
      </span>
    );
  }
  if (p === "paytm") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#00BAF2]/10 border border-[#00BAF2]/20">
        <span className="w-4 h-4 rounded-sm bg-[#00BAF2] text-white text-[8px] font-bold flex items-center justify-center">P</span>
        <span className="text-[11px] font-semibold text-[#013e79]">Paytm</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-100 border border-zinc-200">
      <Landmark className="w-3.5 h-3.5 text-zinc-500" />
      <span className="text-[11px] font-semibold text-zinc-600">Other</span>
    </span>
  );
}

function HistoryPage() {
  const list = useServerFn(listMyOrders);
  const qc = useQueryClient();
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => list(),
    refetchOnWindowFocus: true,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
  });

    const merchantId = data?.merchantId ?? null;

    useEffect(() => {
      if (!merchantId) return;
      const channel = supabase
        .channel(`orders-${merchantId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders", filter: `merchant_id=eq.${merchantId}` },
          () => {
            qc.invalidateQueries({ queryKey: ["my-orders"] });
          },




      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchantId, qc]);

  // Fullscreen toggle
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {}
  };

  // Success chime — uploaded Apple Pay sound, full volume, once per payment
  const seenStatusesRef = useRef<Map<string, string> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const audio = new Audio(applePaySoundUrl);
    audio.volume = 1.0;
    audio.preload = "auto";
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, []);
  const playChime = () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      audio.volume = 1.0;
      const p = audio.play();
      p?.catch?.(() => {});
    } catch {}
  };



  const orders = (data?.orders ?? []) as Order[];

  const hasPending = useMemo(() => orders.some((o) => o.status === "pending"), [orders]);
  useNowTick(hasPending);

  // Diff order statuses; chime once per pending→paid transition
  useEffect(() => {
    if (!orders.length && !seenStatusesRef.current) return;
    if (seenStatusesRef.current === null) {
      const m = new Map<string, string>();
      for (const o of orders) m.set(o.order_id, o.status);
      seenStatusesRef.current = m;
      return;
    }
    const prev = seenStatusesRef.current;
    let newlyPaid = 0;
    for (const o of orders) {
      const before = prev.get(o.order_id);
      if (o.status === "paid" && before && before !== "paid") newlyPaid++;
      prev.set(o.order_id, o.status);
    }
    if (newlyPaid > 0) playChime();
  }, [orders]);

  // Today's received (paid) total — live
  const todayPaidTotal = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();
    return orders
      .filter((o) => o.status === "paid" && o.paid_at && new Date(o.paid_at).getTime() >= startMs)
      .reduce((s, o) => s + Number(o.payable_amount || 0), 0);
  }, [orders]);

  // Count-up tween for the total
  const [displayTotal, setDisplayTotal] = useState(0);
  const prevTotalRef = useRef(0);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const from = prevTotalRef.current;
    const to = todayPaidTotal;
    if (from === to) return;
    if (to > from) {




      setPulse(true);
      const t = setTimeout(() => setPulse(false), 900);
      // cleanup handled below
      const duration = 600;
      const startTs = performance.now();
      let raf = 0;
      const tick = (now: number) => {
        const p = Math.min(1, (now - startTs) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setDisplayTotal(from + (to - from) * eased);
        if (p < 1) raf = requestAnimationFrame(tick);
        else prevTotalRef.current = to;
      };
      raf = requestAnimationFrame(tick);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(t);
      };
    } else {
      setDisplayTotal(to);
      prevTotalRef.current = to;
    }
  }, [todayPaidTotal]);

  const [search, setSearch] = useState("");
  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const amt = Number(o.payable_amount).toFixed(2);
      const amtPlain = String(Number(o.payable_amount));
      return (
        o.order_id.toLowerCase().includes(q) ||
        (o.status ?? "").toLowerCase().includes(q) ||
        (STATUS_MAP[o.status]?.label.toLowerCase() ?? "").includes(q) ||
        amt.includes(q) ||
        amtPlain.includes(q) ||
        (o.payer_email ?? "").toLowerCase().includes(q) ||
        (o.payer_name ?? "").toLowerCase().includes(q) ||
        detectProvider(o).includes(q)
      );
    });
  }, [orders, search]);

  const hasQuery = search.trim().length > 0;

  return (
    <div
      ref={containerRef}
      className={
        isFullscreen
          ? "fixed inset-0 z-50 bg-white p-2 sm:p-4 flex flex-col h-screen overflow-hidden"
          : "max-w-6xl mx-auto px-2 sm:px-0 flex flex-col h-[calc(100vh-4rem)]"
      }
    >
      {/* Sticky top */}
      <div className="sticky top-0 z-20 bg-white/85 backdrop-blur-md pb-3">
        {/* Header card */}
        <div className="relative mt-1 mb-3 overflow-hidden rounded-2xl border border-black/5 bg-gradient-to-br from-[#0d4a3a] via-[#0f5a45] to-[#127a5b] text-white shadow-sm">
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 0, transparent 40%), radial-gradient(circle at 80% 80%, white 0, transparent 35%)" }} />
          <div className="relative px-3 sm:px-5 py-3 sm:py-4 flex flex-col gap-3">
            {/* Row 1: title + action buttons */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20">
                <HistoryIcon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold tracking-tight truncate">Payment History</h1>
                <p className="text-[11px] sm:text-sm text-white/80 flex items-center gap-1.5 sm:gap-2 mt-0.5">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300"></span>
                  </span>
                  <span className="truncate">Live updates enabled</span>
                </p>
              </div>
              <button
                onClick={() => qc.invalidateQueries({ queryKey: ["my-orders"] })}
                className="shrink-0 inline-flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-xs font-semibold ring-1 ring-white/20 transition"
                aria-label="Refresh"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={toggleFullscreen}
                className="shrink-0 inline-flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-xs font-semibold ring-1 ring-white/20 transition"
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}




                    title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{isFullscreen ? "Exit" : "Fullscreen"}</span>
                </button>
              </div>

            {/* Row 2: today's received + order count */}
            <div className="flex items-stretch gap-2 sm:gap-3">
               <div
                 className={`flex-1 min-w-0 flex flex-col px-3 py-2 rounded-xl bg-white/10 ring-1 transition-all ${pulse ? "ring-emerald-300/80shadow-[0_0_20px_rgba(110,231,183,0.55)]" : "ring-white/20"}`}
                 title="Total received today"
               >
                 <span className="text-[10px] uppercase tracking-wider text-white/70 font-semibold leading-none">Today's Received</span>
                 <span className="mt-1 text-xl sm:text-2xl font-bold text-white tabular-nums leading-none truncate">
                   ₹{displayTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                 </span>
               </div>
               <div className="shrink-0 flex flex-col items-end justify-center px-3 py-2 rounded-xl bg-white/10 ring-1 ring-white/20">
                 <span className="text-[10px] uppercase tracking-wider text-white/70 font-semibold leading-none">Orders</span>
                 <span className="mt-1 text-base sm:text-lg font-bold tabular-nums leading-none">{orders.length}</span>
               </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
             type="text"
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             placeholder="Search provider, email, order, amount…"
             className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-black/10 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0d4a3a]/30 focus:border-[#0d4a3a]/40 transition"
          />
          {hasQuery && (
             <button
               onClick={() => setSearch("")}
               className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition"
               aria-label="Clear search"
             >
               <X className="w-4 h-4" />
             </button>
          )}
        </div>
        {hasQuery && (
          <div className="mt-2 text-xs text-zinc-500 px-1">
             {filteredOrders.length} {filteredOrders.length === 1 ? "result" : "results"}
          </div>
        )}
      </div>

      {/* Scrollable list */}
      <div className="flex-1 min-h-0 overflow-auto bg-white rounded-2xl shadow-sm border border-black/5 mt-1">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div
                 key={i}
                 className="h-14 rounded-xl bg-gradient-to-r from-zinc-100 via-zinc-50 to-zinc-100 bg-[length:200%_100%] animate-
[shimmer_1.4s_linear_infinite]"
              />
            ))}
            <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="m-4 p-10 text-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50">
            <div className="mx-auto w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-sm border border-zinc-100 mb-3">
              <HistoryIcon className="w-6 h-6 text-zinc-400" />
            </div>
            <p className="text-sm text-zinc-600 font-medium">
              {orders.length === 0 ? "No payments yet" : "No orders match your search"}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {orders.length === 0 ? "Generate a QR to get started." : "Try a different keyword."}
            </p>
          </div>
        ) : (
          <div>
            {/* Sticky column header — desktop only */}
            <div className="hidden sm:grid sticky top-0 z-10 grid-cols-12 gap-3 px-5 py-2.5 bg-zinc-50/95 backdrop-blur text-[11px] uppercase tracking-wider text-zinc-500 font-semibold border-b border-black/5">
              <div className="col-span-2">Provider</div>
              <div className="col-span-2">Email</div>
              <div className="col-span-2">Order ID</div>
              <div className="col-span-1">Amount</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Date &amp; Time</div>
              <div className="col-span-1">Time</div>
            </div>
            <div className="divide-y divide-black/5">




                <AnimatePresence initial={false}>
                  {filteredOrders.map((o) => {
                    const s = STATUS_MAP[o.status] ?? STATUS_MAP.pending;
                    const p = detectProvider(o);
                    const dt = new Date(o.paid_at ?? o.created_at);
                    return (
                      <motion.div
                        key={o.order_id}
                        layout
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="relative hover:bg-zinc-50/70 transition-colors group"
                      >
                        <span className={`absolute left-0 top-2 bottom-2 w-1 rounded-r ${s.accent} opacity-70 group-hover:opacity-100 transition`} />

                         {/* Mobile card */}
                         <div className="sm:hidden pl-3 pr-3 py-3 flex flex-col gap-2">
                           <div className="flex items-center justify-between gap-2 min-w-0">
                             <ProviderChip p={p} />
                             <span className="font-bold text-[#0d4a3a] tabular-nums text-base shrink-0">
                               ₹{Number(o.payable_amount).toFixed(2)}
                             </span>
                           </div>
                           <div className="text-xs text-zinc-700 truncate" title={o.payer_email ?? ""}>
                             {o.payer_email || <span className="text-zinc-400">No email</span>}
                           </div>
                           <div className="flex items-center justify-between gap-2 min-w-0">
                             <div className="font-mono text-[10px] text-zinc-500 truncate" title={o.order_id}>
                               {o.order_id}
                             </div>
                             {statusBadge(o.status)}
                           </div>
                           <div className="flex items-center justify-between gap-2">
                             <div className="text-[10px] text-zinc-500 tabular-nums">
                               {dt.toLocaleDateString()} · {dt.toLocaleTimeString()}
                             </div>
                             {o.status === "pending" && <PendingTimer startIso={o.created_at} />}
                           </div>
                           <div className="flex items-center justify-between gap-2">
                             <span className="text-[10px] text-zinc-500 font-medium">Time taken</span>
                             <TimeTaken o={o} />
                           </div>
                         </div>

                         {/* Desktop row */}
                         <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-3 items-center">
                           <div className="col-span-2">
                             <ProviderChip p={p} />
                           </div>
                           <div className="col-span-2 min-w-0">
                             <div className="text-xs text-zinc-700 truncate" title={o.payer_email ?? ""}>
                               {o.payer_email || <span className="text-zinc-400">—</span>}
                             </div>
                           </div>
                           <div className="col-span-2 min-w-0">
                             <div className="font-mono text-[11px] text-zinc-800 truncate" title={o.order_id}>{o.order_id}</div>
                           </div>
                           <div className="col-span-1 font-semibold text-[#0d4a3a] tabular-nums text-sm">
                             ₹{Number(o.payable_amount).toFixed(2)}
                           </div>
                           <div className="col-span-2">{statusBadge(o.status)}</div>
                           <div className="col-span-2 text-[11px] text-zinc-600 leading-tight">
                             <div className="font-medium text-zinc-700">{dt.toLocaleDateString()}</div>
                             <div className="flex items-center gap-2">
                               <span className="text-zinc-500 tabular-nums">{dt.toLocaleTimeString()}</span>
                               {o.status === "pending" && <PendingTimer startIso={o.created_at} />}
                             </div>
                           </div>
                           <div className="col-span-1">
                             <TimeTaken o={o} />
                           </div>
                         </div>
                       </motion.div>
                     );
                   })}
                 </AnimatePresence>
               </div>
            </div>
          )}
        </div>
      </div>
    );
}
