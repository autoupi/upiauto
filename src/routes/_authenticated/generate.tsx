import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createOrder } from "@/lib/orders.functions";
import { toast } from "sonner";
import { swalSuccess } from "@/lib/swal";
import { QrCode } from "lucide-react";

export const Route = createFileRoute("/_authenticated/generate")({
  head: () => ({ meta: [{ title: "AutoUPI | Generate QR Code" }] }),
  component: GeneratePage,
});

function GeneratePage() {
  const create = useServerFn(createOrder);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

    async function submit(e: React.FormEvent) {
      e.preventDefault();
      const n = parseFloat(amount);
      if (!n || n <= 0) return toast.error("Enter a valid amount");
      setLoading(true);
      try {
        const res = (await create({ data: { amount: n } })) as unknown as { order: { order_id: string } };
        const orderId = res.order.order_id;
        window.open(`/pay/${orderId}`, "_blank", "noopener,noreferrer");
        swalSuccess("QR generated successfully");
        setAmount("");
      } catch (err: any) {
        toast.error(err.message ?? "Failed to create order");
      } finally {
        setLoading(false);
      }
    }

    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-black/5 p-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-lg bg-[#0d4a3a]/10 flex items-center justify-center">
               <QrCode className="w-5 h-5 text-[#0d4a3a]" />
            </div>
            <h1 className="text-2xl font-bold text-[#0d1b2a]">Generate Payment QR</h1>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Enter the amount — the QR will open in a new tab.
          </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Amount (₹)</label>
            <input
              type="number" step="0.01" min="1" required autoFocus
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full text-lg px-4 py-3 rounded-lg border border-gray-300 focus:border-[#0d4a3a] focus:ring-2 focus:ring-[#0d4a3a]/20
outline-none"
            />
          </div>




          <button type="submit" disabled={loading} className="w-full py-3.5 rounded-lg bg-[#0d4a3a] hover:bg-[#0a3d30] text-white font-bold tracking-
wide transition disabled:opacity-60">
             {loading ? "Generating…" : "GENERATE QR"}
          </button>
        </form>
      </div>
    </div>
  );
}
