import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PayPageView } from "@/components/PayPageView";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

const STORAGE_KEY = "pay_order_id";

export const Route = createFileRoute("/pay/")({
  head: () => ({
    meta: [
      { title: "AutoUPI | Scan and Pay" },
      { name: "description", content: "Scan the UPI QR to complete your payment." },
    ],
  }),
  component: PayCleanPage,
});

// Clean URL (/pay) — order ID comes from sessionStorage instead of the URL.
// Set by the dashboard Generate page right before opening this tab.
function PayCleanPage() {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const id = sessionStorage.getItem(STORAGE_KEY);
    setOrderId(id && /^\d{10}$/.test(id) ? id : null);
    setChecked(true);
  }, []);

  if (!checked) return null;

  if (!orderId) {
    return (
      <main className="fixed inset-0 h-[100dvh] w-[100dvw] flex items-center justify-center p-4" style={{ background: "#f5f5f5" }}>
        <div className="bg-white rounded-3xl border border-[#ECECEC] shadow-[0_2px_16px_-4px_rgba(0,0,0,0.08)] p-6 text-center max-w-[340px] w-full">
          <AlertCircle className="w-14 h-14 text-neutral-400 mx-auto mb-3" />
          <div className="text-xl font-semibold text-neutral-800">No Active Payment</div>
          <p className="mt-2 text-sm text-neutral-500">
            Generate a new QR from the dashboard to start a payment.
          </p>
          <Button asChild className="mt-5 w-full">
            <Link to="/generate">Go to Dashboard</Link>
          </Button>
        </div>
      </main>
    );
  }

  return <PayPageView orderId={orderId} />;
}
