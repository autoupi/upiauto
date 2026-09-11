import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Clock, AlertCircle, Copy, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import bhimUpiUrl from "@/assets/bhim-upi-real.jpg";
import upiAppsUrl from "@/assets/upi-apps-real.jpg";




import panmeLogoUrl from "@/assets/panme-logo.jpg";

const PAYEE_NAME_FALLBACK = "Merchant";
const BHIM_UPI_LOGO = bhimUpiUrl;
const UPI_APPS = upiAppsUrl;
const CENTER_LOGO = panmeLogoUrl;

interface Order {
  order_id: string;
  requested_amount: number;
  payable_amount: number;
  status: "pending" | "paid" | "expired" | "manual_review" | "failed";
  created_at: string;
  expiry_at: string;
  paid_at: string | null;
  success_url?: string | null;
  failure_url?: string | null;
  upi_pa?: string | null;
  upi_pn?: string | null;
  brand_name?: string | null;
}

export function PayPageView({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [now, setNow] = useState(Date.now());
  const [processing, setProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastPollRef = useRef(0);
  const processingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch order via the safe public endpoint (no anon DB access).
  // Poll every 2s so we still see pending -> paid transitions without realtime.
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

     const fetchOnce = async () => {
       try {
         const res = await fetch(`/api/public/pay/${encodeURIComponent(orderId)}`);
         if (!res.ok) return;
         const next = (await res.json()) as Order;
         if (!active) return;
         setOrder((prev) => {
           if (prev?.status === "pending" && next.status === "paid") {
             if (!processingTimerRef.current) {
               setProcessing(true);
               processingTimerRef.current = setTimeout(() => {
                 processingTimerRef.current = null;
                 setProcessing(false);
                 setOrder(next);
               }, 3000);
             }
             return prev;
           }
           return next;
         });
       } catch {
         /* ignore transient network errors */
       }
     };

     const loop = async () => {
       await fetchOnce();
       if (!active) return;
       timer = setTimeout(loop, 2000);
     };
     loop();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      if (processingTimerRef.current) clearTimeout(processingTimerRef.current);
    };
  }, [orderId]);

  useEffect(() => {
    if (!order) return;
    const pa = (order.upi_pa || "").trim();
    if (!pa) {
      setQrDataUrl("");
      return;
    }
    const pn = order.upi_pn || PAYEE_NAME_FALLBACK;
    const upiUrl = `upi://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(pn)}&am=${order.payable_amount.toFixed(2)}&cu=INR&tn=${order.order_id}`;
    QRCode.toDataURL(upiUrl, {
      width: 960,
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: "#000000", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [order?.order_id, order?.payable_amount, order?.upi_pa]);

  useEffect(() => {
    const tick = setInterval(() => {
      setNow(Date.now());
      if (order?.status === "pending" && Date.now() - lastPollRef.current > 1500) {
        lastPollRef.current = Date.now();
        fetch(`/api/public/payments/poll?order_id=${encodeURIComponent(orderId)}`, { method: "POST" }).catch(() => {});
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [order?.status, orderId]);

  // Block right-click and devtools shortcuts on the payment page to reduce casual tampering / inspection.
  useEffect(() => {
    const blockContext = (e: MouseEvent) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(k)) ||
        (e.metaKey && e.altKey && ["i", "j", "c"].includes(k)) ||
        (e.ctrlKey && k === "u") ||
        (e.metaKey && k === "u") ||
        (e.ctrlKey && k === "s") ||
        (e.metaKey && k === "s")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("contextmenu", blockContext);
    document.addEventListener("keydown", blockKeys, true);
    const prevSelect = document.body.style.userSelect;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    const prevBodyHeight = document.body.style.height;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const prevHtmlHeight = document.documentElement.style.height;
    document.body.style.userSelect = "none";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.body.style.height = "100dvh";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    document.documentElement.style.height = "100dvh";
    return () => {
      document.removeEventListener("contextmenu", blockContext);
      document.removeEventListener("keydown", blockKeys, true);
      document.body.style.userSelect = prevSelect;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
      document.body.style.height = prevBodyHeight;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
      document.documentElement.style.height = prevHtmlHeight;
    };
  }, []);

  const expiryMs = order ? new Date(order.expiry_at).getTime() : 0;
  const remaining = Math.max(0, expiryMs - now);
  const mm = String(Math.floor(remaining / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");

  // When the timer hits 0 on a still-pending order, briefly show the same
  // "Processing Payment…" overlay before flipping to expired — looks polished
  // and gives the poller one last chance to confirm an in-flight payment.
  const [expireProcessing, setExpireProcessing] = useState(false);
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (order?.status === "pending" && remaining === 0 && !processing && !expireProcessing) {
      setExpireProcessing(true);
      if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
      expireTimerRef.current = setTimeout(() => setExpireProcessing(false), 3000);
    }
    return () => {
      // no-op; cleanup handled on unmount below
    };
  }, [order?.status, remaining, processing, expireProcessing]);
  useEffect(() => () => {
    if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
  }, []);

  const showProcessing = processing || expireProcessing;




  const effectiveStatus = useMemo(() => {
    if (!order) return "pending";
    if (order.status === "pending" && remaining === 0 && !showProcessing) return "expired";
    return order.status;
  }, [order, remaining, showProcessing]);

  // Auto-redirect back to merchant after terminal state with a visible 3s countdown.
  const [redirectIn, setRedirectIn] = useState<number | null>(null);
  useEffect(() => {
    if (!order) return;
    if (showProcessing) {
      setRedirectIn(null);
      return;
    }
    let target: string | null = null;
    if (effectiveStatus === "paid" && order.success_url) {
      target = `${order.success_url}${order.success_url.includes("?") ? "&" : "?"}order_id=${order.order_id}&status=paid`;
    } else if ((effectiveStatus === "expired" || effectiveStatus === "failed") && order.failure_url) {
      target = `${order.failure_url}${order.failure_url.includes("?") ? "&" : "?"}order_id=${order.order_id}&status=${effectiveStatus}`;
    }
    if (!target) {
      setRedirectIn(null);
      return;
    }
    setRedirectIn(3);
    const iv = setInterval(() => {
      setRedirectIn((s) => (s !== null && s > 0 ? s - 1 : s));
    }, 1000);
    const t = setTimeout(() => {
      window.location.href = target!;
    }, 3000);
    return () => {
      clearInterval(iv);
      clearTimeout(t);
    };
  }, [effectiveStatus, showProcessing, order?.success_url, order?.failure_url, order?.order_id]);

  if (!order) {
    return (
      <main className="fixed inset-0 h-[100dvh] w-[100dvw] overflow-hidden overscroll-none flex items-center justify-center p-3 sm:p-4" style={{ background: "#f5f5f5", touchAction: "none" }}>
        <div className="relative w-full max-w-[320px] sm:max-w-[340px]">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.08)] overflow-hidden">
            <div className="flex flex-col items-center pt-5 pb-2.5 px-5">
               <Skeleton className="h-10 w-32 rounded-md" />
            </div>
            <div className="text-center px-5 pb-3">
               <Skeleton className="h-6 w-40 rounded-md mx-auto" />
               <Skeleton className="h-4 w-20 rounded-md mx-auto mt-2" />
            </div>
            <div className="border-t border-gray-200 grid grid-cols-2">
               <div className="px-5 py-3.5 border-r border-gray-200"><Skeleton className="h-5 w-24 rounded-md" /></div>
               <div className="px-5 py-3.5 flex items-center justify-center"><Skeleton className="h-6 w-20 rounded-md" /></div>
            </div>
            <div className="border-t border-gray-200 px-5 py-4 flex items-center justify-center">
               <Skeleton className="w-[170px] h-[170px] rounded-md" />
            </div>
            <div className="px-5 pb-4 flex items-center justify-center">
               <Skeleton className="h-6 w-48 rounded-md" />
            </div>
            <div className="border-t border-gray-200 px-5 py-3.5 flex items-center justify-between">
               <Skeleton className="h-5 w-24 rounded-md" />
               <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  const showQrCard = effectiveStatus === "pending";

  return (
    <main className="fixed inset-0 h-[100dvh] w-[100dvw] overflow-hidden overscroll-none flex items-center justify-center p-3 sm:p-4" style={{ background: "#f5f5f5", touchAction: "none" }}>
      <div className="relative w-full max-w-[320px] sm:max-w-[340px]">
        {showQrCard && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.08)] overflow-hidden">
            {/* BHIM|UPI header */}
            <div className="flex flex-col items-center pt-5 pb-2.5 px-5">
              <img src={BHIM_UPI_LOGO} alt="BHIM UPI" className="w-[190px] sm:w-[205px] object-contain" />
            </div>

              {/* Merchant name + Transfer to */}
              <div className="text-center px-5 pb-3">
                <div className="text-[20px] sm:text-[22px] font-bold text-[#1a2b4a] leading-tight">{order.brand_name?.trim() || "Panme Shop"}</div>
                <div className="text-sm text-gray-400 mt-1">Transfer to</div>
              </div>

              {/* Total Amount row */}
              <div className="border-t border-gray-200 grid grid-cols-2">
                <div className="px-5 py-3.5 border-r border-gray-200">
                  <div className="text-sm font-semibold text-[#1a2b4a]">Total Amount</div>
                </div>




                <div className="px-5 py-3.5 flex items-center justify-center">
                  <div className="text-[20px] sm:text-[22px] font-bold text-[#1a2b4a]">₹{order.payable_amount.toFixed(2)}</div>
                </div>
              </div>

            {/* QR */}
            <div className="border-t border-gray-200 px-5 py-4 flex items-center justify-center">
              <div className="relative w-[185px] h-[185px] sm:w-[195px] sm:h-[195px] flex items-center justify-center">
                {qrDataUrl && (
                   <img
                     src={qrDataUrl}
                     alt="UPI QR"
                     className={`w-full h-full transition-all duration-300 ${showProcessing ? "opacity-50 blur-[2px]" : "opacity-100"}`}
                   />
                )}
                {qrDataUrl && !showProcessing && (
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[8px] bg-white p-[3px] shadow-sm">
                        <img src={CENTER_LOGO} alt="Logo" className="w-full h-full object-contain rounded-[6px]" />
                     </div>
                   </div>
                )}
                {showProcessing && (
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm shadow-md rounded-full px-3 py-1.5 text-primary font-semibold text-xs">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Processing Payment…</span>
                     </div>
                   </div>
                )}
              </div>
            </div>

              {/* Payment app icons */}
              <div className="px-5 pb-4 flex items-center justify-center">
                <img src={UPI_APPS} alt="Supported UPI apps" className="w-[225px] sm:w-[240px] object-contain" />
              </div>

             {/* Footer bar */}
             <div className="border-t border-gray-200 px-5 py-3.5 flex items-center justify-between">
               <div className="text-sm text-gray-500">
                  Expire in <span className="font-semibold text-[#1a2b4a] tabular-nums">{mm}:{ss}</span>
               </div>
               <button
                  type="button"
                  onClick={(e) => e.preventDefault()}
                  className="px-5 py-1.5 rounded-md bg-pink-100 text-pink-500 text-sm font-medium hover:bg-pink-200 transition cursor-pointer"
               >
                  Cancel
               </button>
             </div>
           </div>
         )}

        {effectiveStatus === "paid" && (
          <div className="overflow-hidden rounded-3xl shadow-[0_8px_30px_-10px_rgba(0,0,0,0.18)] animate-scale-in">
            {/* Green hero (compact, PC-friendly) */}
            <div className="bg-[#2e7d3a] px-6 pt-8 pb-16 text-center relative">
              <div className="mx-auto w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg animate-scale-in">
                <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="#2e7d3a" strokeWidth="3" strokeLinecap="round"
strokeLinejoin="round">
                  <path d="M4 12.5l5 5L20 6.5" style={{ strokeDasharray: 40, strokeDashoffset: 40, animation: "tick-draw 0.6s ease-out 0.2s forwards" }} />
                </svg>
              </div>
              <h2 className="mt-4 text-white text-xl md:text-2xl font-bold tracking-tight">Payment successful!</h2>
              <p className="mt-1.5 text-white/90 text-sm">Redirecting back to merchant's website...</p>
              <style>{`@keyframes tick-draw { to { stroke-dashoffset: 0; } } @keyframes copy-pop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }`}</style>
            </div>



              {/* White card overlapping */}
              <div className="bg-white -mt-10 mx-4 rounded-2xl shadow-[0_4px_20px_-6px_rgba(0,0,0,0.12)] p-4 relative z-10">

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#f5a623] flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"
strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                    <path d="M3 6h18" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-neutral-800 truncate">{order.order_id}</div>
                  <div className="text-xl font-bold text-neutral-900 mt-1">₹{order.payable_amount.toFixed(2)}</div>
                </div>
              </div>
            </div>

              {/* Order ID strip with working copy */}
              <div className="bg-white px-6 py-4 border-t border-neutral-100 flex items-center justify-between">




                <div className="min-w-0 pr-3">
                  <div className="text-sm font-semibold text-neutral-800">Order ID</div>
                  <div className="text-xs text-neutral-500 mt-0.5 font-mono truncate">{order.order_id}</div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(order.order_id);
                    } catch {
                      const ta = document.createElement("textarea");
                      ta.value = order.order_id;
                      document.body.appendChild(ta);
                      ta.select();
                      try { document.execCommand("copy"); } catch {}
                      document.body.removeChild(ta);
                    }
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className={`p-2 rounded-lg transition-colors ${copied ? "text-[#2e7d3a] bg-[#e7f4ea]" : "text-[#6b3fa0] hover:bg-neutral-50"}`}
                  aria-label="Copy order ID"
                >
                  {copied ? (
                    <Check className="w-5 h-5" style={{ animation: "copy-pop 0.35s ease-out" }} />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>

             {redirectIn !== null && order.success_url && (
               <div className="bg-white px-6 pb-5 text-center text-xs text-neutral-500">
                  Redirecting in <span className="font-semibold text-[#2e7d3a] tabular-nums">{redirectIn}</span>s…
               </div>
             )}
           </div>
         )}

         {effectiveStatus === "expired" && (
           <div className="bg-white rounded-3xl border border-[#ECECEC] shadow-[0_2px_16px_-4px_rgba(0,0,0,0.08)] p-6 text-center">
             <AlertCircle className="w-14 h-14 text-neutral-400 mx-auto mb-3" />
             <div className="text-xl font-semibold text-neutral-800">Payment Link Expired</div>
             {redirectIn !== null && order.failure_url ? (
               <div className="mt-5 text-sm text-neutral-600">
                  Redirecting in <span className="font-semibold text-primary tabular-nums">{redirectIn}</span>s…
               </div>
             ) : (
               <Button asChild variant="outline" className="mt-5 w-full">
                  <a href="/">New Payment</a>
               </Button>
             )}
           </div>
         )}

          {effectiveStatus === "manual_review" && (
            <div className="bg-white rounded-3xl border-2 border-neutral-200 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.15)] p-6 text-center">
               <XCircle className="w-14 h-14 text-yellow-600 mx-auto mb-3" />
               <div className="text-xl font-semibold text-neutral-800">Under Manual Review</div>
               <p className="mt-2 text-sm text-neutral-500">
                 Multiple orders shared this amount. Our team will verify your payment shortly.
               </p>
               <Button asChild className="mt-5 w-full">
                 <a href="/">New Payment</a>
               </Button>
            </div>
          )}
        </div>
      </main>
    );
}
