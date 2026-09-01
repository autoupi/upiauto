import { createFileRoute } from "@tanstack/react-router";
import { PayPageView } from "@/components/PayPageView";

export const Route = createFileRoute("/pay/$orderId")({
  head: () => ({
    meta: [
      { title: "AutoUPI | Scan and Pay" },
      { name: "description", content: "Scan the UPI QR to complete your payment." },
    ],
  }),
  component: PayPage,
});

function PayPage() {
  const { orderId } = Route.useParams();
  return <PayPageView orderId={orderId} />;
}
