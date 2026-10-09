import { useEffect, useState, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  CheckCircle2,
  ChefHat,
  Package,
  Bike,
  MapPin,
  Phone,
  Share2,
  Copy,
  AlertCircle,
  RefreshCw,
  Utensils,
  ArrowLeft,
  Store,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api/client";
import { ORDERS } from "@/lib/api/endpoints";
import { TrackMap, RESTAURANT } from "@/components/kennedy/TrackMap";

export const Route = createFileRoute("/track/$code")({
  head: ({ params }) => {
    const code = params.code || "";
    return {
      meta: [
        { title: `Track Order #${code} — Kennedy Moon Grill` },
        { name: "description", content: `Real-time public live tracking for order #${code}` },
      ],
    };
  },
  component: PublicTrackPage,
});

type TrackedOrder = {
  id: number;
  order_code: string;
  status: "pending" | "confirmed" | "kitchen" | "packed" | "onway" | "delivered" | "cancelled";
  order_type: "delivery" | "takeaway" | "dine_in";
  source: "web" | "whatsapp" | "pos" | "voice";
  created_at: string | null;
  eta_minutes: number;
  restaurant_name: string;
  branch_name: string;
  customer_name: string;
  masked_phone: string;
  masked_address: string;
  subtotal: string;
  delivery_fee: string;
  discount: string;
  total: string;
  payment_method: string;
  payment_status: string;
  rider: {
    name: string;
    phone: string;
    bike: string;
    lat: number | null;
    lng: number | null;
  } | null;
  items: {
    id: number;
    name: string;
    size: string | null;
    quantity: number;
    price: string;
    total: string;
  }[];
  timeline: {
    status: string;
    note: string;
    created_at: string | null;
  }[];
};

const STAGES = [
  { key: "confirmed", label: "Confirmed", desc: "Order accepted by kitchen", icon: CheckCircle2 },
  { key: "kitchen", label: "Cooking", desc: "Chef is preparing your meal", icon: ChefHat },
  { key: "packed", label: "Packed", desc: "Freshly packed & sealed", icon: Package },
  { key: "onway", label: "On the Way", desc: "Rider is heading to you", icon: Bike },
  { key: "delivered", label: "Delivered", desc: "Enjoy your warm meal!", icon: MapPin },
] as const;

function getStageIndex(status: string): number {
  switch (status) {
    case "pending":
    case "confirmed":
      return 0;
    case "kitchen":
      return 1;
    case "packed":
      return 2;
    case "onway":
      return 3;
    case "delivered":
      return 4;
    default:
      return 0;
  }
}

export function PublicTrackPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchOrder = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const endpoint = ORDERS.byCode(code);
      const res = await api.get<TrackedOrder>(endpoint);
      if (res) {
        setOrder(res);
        setError(null);
        setLastRefreshed(new Date());
      }
    } catch (err: any) {
      if (err?.status === 404 || err?.statusCode === 404) {
        setError(`Order #${code} was not found. Please check your order code.`);
      } else {
        setError(err?.message || "Failed to load order status. Retrying...");
      }
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  // Smart Adaptive Polling:
  // Once an order is delivered or cancelled, polling stops COMPLETELY (0 requests).
  // While active, polls every 8s and automatically pauses when browser tab is hidden.
  useEffect(() => {
    fetchOrder();

    const isTerminal = order?.status === "delivered" || order?.status === "cancelled";
    if (isTerminal) {
      // Order reached final state — no further status transitions possible. Stop all network polling.
      return;
    }

    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (interval === null) {
        interval = setInterval(() => {
          fetchOrder();
        }, 8000);
      }
    };
    const stop = () => {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.hidden) {
        stop();
      } else {
        fetchOrder();
        start();
      }
    };

    if (typeof document === "undefined" || !document.hidden) {
      start();
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [code, order?.status]);

  const currentStage = useMemo(() => getStageIndex(order?.status || ""), [order?.status]);
  const isCancelled = order?.status === "cancelled";

  const handleCopyCode = () => {
    if (order?.order_code) {
      navigator.clipboard.writeText(order.order_code);
      toast.success("Order code copied to clipboard!");
    }
  };

  const handleShareWhatsApp = () => {
    if (!order) return;
    const url = window.location.href;
    const text = `Assalam-o-Alaikum! Follow our order #${order.order_code} live here:\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  if (loading && !order) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full mb-4"
        />
        <h2 className="text-xl font-bold tracking-tight text-foreground">Locating Order #{code}...</h2>
        <p className="text-sm text-muted-foreground mt-1">Connecting to Moon Grill kitchen feed</p>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Order Not Found</h2>
        <p className="text-muted-foreground max-w-md mt-2 mb-6">{error}</p>
        <div className="flex gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition shadow-sm"
          >
            <Store className="w-4 h-4" /> Go to Menu
          </Link>
          <button
            onClick={() => fetchOrder(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-medium transition"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/60 px-4 py-3 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-foreground font-bold hover:opacity-80 transition">
            <ArrowLeft className="w-5 h-5" />
            <span>Store</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold uppercase tracking-wider">
              {order?.order_type || "Delivery"}
            </span>
            <button
              onClick={() => fetchOrder(true)}
              disabled={isRefreshing}
              className="p-2 rounded-lg border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground transition disabled:opacity-50"
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* Main Status Hero Card */}
        <section className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-foreground">
                  Order #{order?.order_code}
                </h1>
                <button
                  onClick={handleCopyCode}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition"
                  title="Copy Code"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {order?.restaurant_name} • {order?.branch_name}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleShareWhatsApp}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" /> Share on WhatsApp
              </button>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Estimated Time</div>
                <div className="text-lg font-black text-primary">
                  {order?.status === "delivered" ? "Delivered" : `${order?.eta_minutes || 30} mins`}
                </div>
              </div>
            </div>
          </div>

          {/* Stepper Progress */}
          {isCancelled ? (
            <div className="mt-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-3">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <div>
                <div className="font-bold">Order Cancelled</div>
                <div className="text-xs opacity-90">This ticket was cancelled. Any advance payment will be settled.</div>
              </div>
            </div>
          ) : (
            <div className="mt-8">
              <div className="relative">
                {/* Connecting Line */}
                <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 bg-muted rounded-full" />
                <div
                  className="absolute top-1/2 left-0 -translate-y-1/2 h-1 bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${(currentStage / (STAGES.length - 1)) * 100}%` }}
                />

                {/* Steps Nodes */}
                <div className="relative flex justify-between">
                  {STAGES.map((stage, idx) => {
                    const isDone = idx < currentStage;
                    const isCurrent = idx === currentStage;
                    const Icon = stage.icon;

                    return (
                      <div key={stage.key} className="flex flex-col items-center text-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 z-10 ${
                            isCurrent
                              ? "bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110 shadow-md"
                              : isDone
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <span
                          className={`mt-2 text-xs font-semibold max-w-[70px] truncate ${
                            isCurrent ? "text-primary font-bold" : isDone ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {stage.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Current Active Step Banner */}
              <div className="mt-6 p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                  </span>
                  <div>
                    <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                      {STAGES[currentStage]?.label}:
                    </span>{" "}
                    <span className="text-xs text-muted-foreground">{STAGES[currentStage]?.desc}</span>
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Updated {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Live Rider / Map section (Active when status is onway or rider assigned) */}
        {order?.rider && (
          <section className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Bike className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{order.rider.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {order.rider.bike} • {order.rider.phone ? `Phone: ${order.rider.phone}` : "Assigned Rider"}
                  </p>
                </div>
              </div>
              {order.rider.phone && (
                <a
                  href={`tel:${order.rider.phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition"
                >
                  <Phone className="w-3.5 h-3.5 text-primary" /> Call Rider
                </a>
              )}
            </div>

            {/* If coordinates exist or during onway status, render map preview */}
            {order.status === "onway" && (
              <div className="rounded-xl overflow-hidden border border-border h-64 relative">
                <TrackMap
                  riderName={order.rider.name}
                  target={
                    order.rider.lat && order.rider.lng
                      ? { lat: order.rider.lat, lng: order.rider.lng }
                      : { lat: RESTAURANT.lat + 0.008, lng: RESTAURANT.lng + 0.006 }
                  }
                  targetLabel={order.masked_address || "Delivery Location"}
                  rideStarted={order.status === "onway"}
                />
              </div>
            )}
          </section>
        )}

        {/* Order Details & Receipt */}
        <section className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <Utensils className="w-4 h-4 text-primary" /> Order Items ({order?.items.length || 0})
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase">
              {order?.payment_method} • {order?.payment_status}
            </span>
          </div>

          <div className="divide-y divide-border/60">
            {order?.items.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <span className="font-semibold text-foreground">
                    {item.quantity}x {item.name}
                  </span>
                  {item.size && (
                    <span className="ml-2 text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                      {item.size}
                    </span>
                  )}
                </div>
                <span className="font-medium text-foreground">Rs. {Number(item.total).toLocaleString()}</span>
              </div>
            ))}
          </div>

          {/* Pricing Totals */}
          <div className="bg-muted/30 rounded-xl p-4 space-y-2 border border-border/60 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>Rs. {Number(order?.subtotal || 0).toLocaleString()}</span>
            </div>
            {Number(order?.delivery_fee || 0) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery Fee</span>
                <span>Rs. {Number(order?.delivery_fee).toLocaleString()}</span>
              </div>
            )}
            {Number(order?.discount || 0) > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Discount</span>
                <span>- Rs. {Number(order?.discount).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-foreground pt-2 border-t border-border/60">
              <span>Total Amount</span>
              <span className="text-primary">Rs. {Number(order?.total || 0).toLocaleString()}</span>
            </div>
          </div>

          {/* Delivery & Customer Info (Safe Masked) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-foreground">Drop-off Area:</span>
                <p>{order?.masked_address}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-foreground">Contact (Protected):</span>
                <p>{order?.masked_phone} ({order?.customer_name})</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
