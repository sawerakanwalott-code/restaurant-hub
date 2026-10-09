import { useEffect, useState, useRef, useMemo } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  CheckCircle2,
  Clock,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Wifi,
  WifiOff,
  ShoppingBag,
  UtensilsCrossed,
  Bike,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  ChevronRight,
  LogOut,
  Layers,
  ChefHat,
  Bell,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { api, API_BASE_URL, tokens, getWsUrl } from "@/lib/api/client";
import { ADMIN, ORDERS } from "@/lib/api/endpoints";
import { readAccount, signOut } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { KITCHEN_ROLES } from "@/lib/roles";

export const Route = createFileRoute("/kitchen")({
  beforeLoad: requireRole(KITCHEN_ROLES),
  head: () => ({
    meta: [
      { title: "Kitchen KDS — Moon Grill Live Board" },
      { name: "description", content: "Real-time hands-free kitchen display system with Roman Urdu controls." },
    ],
  }),
  component: KitchenKDSPage,
});

export type KdsItem = {
  id?: number;
  dish_name: string;
  size?: string;
  qty: number;
  unit_price?: number | string;
};

export type KdsOrder = {
  id: string | number;
  order_code: string;
  order_type: "delivery" | "takeaway" | "dine_in";
  source: "web" | "whatsapp" | "pos" | "voice";
  dish_name: string;
  size: string;
  qty: number;
  order_items?: KdsItem[];
  status: "pending" | "confirmed" | "kitchen" | "packed" | "onway" | "delivered" | "cancelled";
  priority: "normal" | "rush" | "vip";
  created_at: string;
  updated_at?: string;
  address?: any;
  notes?: string;
};

/* ------------------------------------------------------------------ Web Audio Chime */

function playKitchenChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Resonant three-tone bell chime (D5 -> A5 -> D6)
    const tones = [587.33, 880.0, 1174.66];
    tones.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0, now + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.35, now + idx * 0.12 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.65);
    });
  } catch {
    // Ignore audio errors if blocked by browser policy
  }
}

/* ------------------------------------------------------------------ Elapsed Timer */

function formatElapsed(createdAt: string): { label: string; minutes: number; urgency: "normal" | "warning" | "danger" } {
  const createdMs = new Date(createdAt).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - createdMs) / 1000));
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  const label = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  if (mins >= 25) return { label, minutes: mins, urgency: "danger" };
  if (mins >= 15) return { label, minutes: mins, urgency: "warning" };
  return { label, minutes: mins, urgency: "normal" };
}

/* ------------------------------------------------------------------ Component */

export function KitchenKDSPage() {
  const router = useRouter();
  const account = readAccount();

  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [processingId, setProcessingId] = useState<string | number | null>(null);
  const [showPending, setShowPending] = useState(false);

  // Live timer tick every second for urgency calculation
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch active kitchen orders
  const loadOrders = async (silent = false) => {
    if (!tokens.access()) return;
    if (!silent) setLoading(true);
    try {
      const data = await api.get<KdsOrder[]>(
        `${ADMIN.orders}?status=pending,confirmed,kitchen,packed&limit=100`
      );
      if (Array.isArray(data)) {
        setOrders(data);
      }
      setLastRefreshed(new Date());
    } catch (err: any) {
      if (!silent) {
        toast.error("Orders load karne mein masla hua.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // WebSocket Connection for real-time kitchen stream
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let isDisposed = false;

    function connect() {
      if (isDisposed) return;
      const token = tokens.access();
      if (!token) return;

      const wsUrl = getWsUrl("/ws/kitchen/", token);

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (isDisposed) return;
          setIsWsConnected(true);
        };

        ws.onmessage = (event) => {
          if (isDisposed) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === "order.created") {
              if (soundEnabled) playKitchenChime();
              toast.info(`Naya Order Aaya: #${data.order_code || data.order_id}`);
              loadOrders(true);
            } else if (data.type === "order.status_changed" || data.type === "order.update") {
              loadOrders(true);
            }
          } catch {
            // Ignore non-json
          }
        };

        ws.onclose = () => {
          if (isDisposed) return;
          setIsWsConnected(false);
          reconnectTimeout = setTimeout(connect, 4000);
        };

        ws.onerror = () => {
          if (isDisposed) return;
          setIsWsConnected(false);
        };
      } catch {
        setIsWsConnected(false);
        reconnectTimeout = setTimeout(connect, 5000);
      }
    }

    connect();

    // Lightweight fallback heartbeat polling (every 40s if WS is alive, 15s if disconnected)
    const pollInterval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (!tokens.access()) {
        clearInterval(pollInterval);
        return;
      }
      loadOrders(true);
    }, isWsConnected ? 40000 : 15000);

    const onVis = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        loadOrders(true);
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }

    return () => {
      isDisposed = true;
      clearInterval(pollInterval);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
    };
  }, [soundEnabled, isWsConnected]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Status transition handlers
  const handleAdvanceStatus = async (orderId: string | number, nextStatus: "confirmed" | "kitchen" | "packed", actionLabel: string) => {
    setProcessingId(orderId);
    try {
      await api.patch(ORDERS.status(orderId), {
        status: nextStatus,
        note: `Kitchen action: ${actionLabel}`,
      });
      toast.success(`Order #${orderId} update hogaya: ${nextStatus.toUpperCase()}`);
      // Optimistic update
      setOrders((prev) =>
        prev.map((o) => (String(o.id) === String(orderId) ? { ...o, status: nextStatus } : o))
      );
    } catch (err: any) {
      toast.error(err?.message || "Status change karne mein masla hua.");
      loadOrders(true);
    } finally {
      setProcessingId(null);
    }
  };

  // Split into Kanban lanes
  const pendingOrders = useMemo(() => orders.filter((o) => o.status === "pending"), [orders]);
  const confirmedOrders = useMemo(() => orders.filter((o) => o.status === "confirmed"), [orders]);
  const cookingOrders = useMemo(() => orders.filter((o) => o.status === "kitchen"), [orders]);
  const packedOrders = useMemo(() => orders.filter((o) => o.status === "packed"), [orders]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* ── TOP BAR ── */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-2.5 flex items-center justify-between shrink-0 shadow-lg z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <ChefHat className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-black tracking-tight text-white uppercase">
                Moon Grill Kitchen KDS
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-widest">
                Live
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-medium">
              Chef: <span className="text-zinc-200 font-semibold">{account?.name || "Kitchen Station"}</span>
            </p>
          </div>
        </div>

        {/* Center: Live Order Stats Counter */}
        <div className="hidden lg:flex items-center gap-6 bg-zinc-950/80 px-4 py-1.5 rounded-xl border border-zinc-800">
          <div className="text-center">
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">New</p>
            <p className="text-base font-black text-sky-400">{confirmedOrders.length}</p>
          </div>
          <div className="w-px h-6 bg-zinc-800" />
          <div className="text-center">
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Cooking</p>
            <p className="text-base font-black text-amber-400">{cookingOrders.length}</p>
          </div>
          <div className="w-px h-6 bg-zinc-800" />
          <div className="text-center">
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Packed</p>
            <p className="text-base font-black text-emerald-400">{packedOrders.length}</p>
          </div>
          {pendingOrders.length > 0 && (
            <>
              <div className="w-px h-6 bg-zinc-800" />
              <button
                onClick={() => setShowPending(!showPending)}
                className={`text-center px-2 py-0.5 rounded-lg border transition ${
                  showPending ? "bg-rose-500/20 border-rose-500/50" : "bg-zinc-800 border-zinc-700 hover:border-zinc-500"
                }`}
              >
                <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Pending</p>
                <p className="text-base font-black text-rose-300">{pendingOrders.length}</p>
              </button>
            </>
          )}
        </div>

        {/* Right: Controls & Status */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* WebSocket Status Pill */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              isWsConnected
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
            }`}
            title={isWsConnected ? "WebSocket Connected" : "Connecting / Fallback Polling Active"}
          >
            {isWsConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isWsConnected ? "Live WS" : "Syncing"}</span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playKitchenChime();
            }}
            className={`p-2 rounded-xl border transition ${
              soundEnabled
                ? "bg-zinc-800 border-zinc-700 text-amber-400 hover:bg-zinc-700"
                : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800"
            }`}
            title={soundEnabled ? "Sound Alert ON (Click to Mute)" : "Sound Alert MUTED (Click to Enable)"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => loadOrders()}
            className="p-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition"
            title="Refresh Orders"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Return to Admin / Exit */}
          <Link
            to="/admin"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700 transition"
          >
            Console
          </Link>
        </div>
      </header>

      {/* ── OPTIONAL PENDING BANNER ── */}
      {showPending && pendingOrders.length > 0 && (
        <div className="bg-rose-950/40 border-b border-rose-800/60 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-black uppercase text-rose-300 tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Awaiting Counter Confirmation ({pendingOrders.length})
            </h2>
            <button
              onClick={() => setShowPending(false)}
              className="text-xs text-rose-400 hover:text-rose-200 underline font-semibold"
            >
              Hide
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {pendingOrders.map((order) => (
              <div
                key={order.id}
                className="bg-zinc-900/90 border border-rose-700/50 rounded-xl p-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-white text-sm">#{order.order_code}</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      {order.order_type}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-zinc-200 mt-1">{order.dish_name}</p>
                </div>
                <button
                  disabled={processingId === order.id}
                  onClick={() => handleAdvanceStatus(order.id, "confirmed", "Confirm Order")}
                  className="mt-3 w-full py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition"
                >
                  Confirm & Cook
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3-LANE KANBAN BOARD ── */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 p-3 md:p-4 overflow-hidden">
        {/* LANE 1: NAYA ORDER / CONFIRMED */}
        <section className="bg-zinc-900/60 border border-sky-950/60 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
          <div className="bg-sky-950/40 border-b border-sky-800/40 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-sky-400 animate-pulse" />
              <h2 className="text-sm font-black text-sky-200 uppercase tracking-wider">
                Naya Order (Confirmed)
              </h2>
            </div>
            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
              {confirmedOrders.length}
            </span>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-3">
            {confirmedOrders.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-zinc-600 text-xs">
                <ChefHat className="w-8 h-8 mb-2 stroke-1" />
                <p>Koi naya order nahi hai</p>
              </div>
            ) : (
              confirmedOrders.map((order) => (
                <KdsTicketCard
                  key={order.id}
                  order={order}
                  processing={processingId === order.id}
                  actionLabel="Cooking Shuru"
                  actionUrdu="Choolhay Pe Rakhain"
                  actionColor="bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white"
                  onAction={() => handleAdvanceStatus(order.id, "kitchen", "Cooking Shuru")}
                />
              ))
            )}
          </div>
        </section>

        {/* LANE 2: CHOOLHAY PE / IN KITCHEN */}
        <section className="bg-zinc-900/60 border border-amber-950/60 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
          <div className="bg-amber-950/40 border-b border-amber-800/40 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400 animate-bounce" />
              <h2 className="text-sm font-black text-amber-200 uppercase tracking-wider">
                Choolhay Pe (Cooking)
              </h2>
            </div>
            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {cookingOrders.length}
            </span>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-3">
            {cookingOrders.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-zinc-600 text-xs">
                <Flame className="w-8 h-8 mb-2 stroke-1" />
                <p>Koi order cook nahi ho raha</p>
              </div>
            ) : (
              cookingOrders.map((order) => (
                <KdsTicketCard
                  key={order.id}
                  order={order}
                  processing={processingId === order.id}
                  actionLabel="Pack Ho Gaya"
                  actionUrdu="Ready / Hot Box"
                  actionColor="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white"
                  onAction={() => handleAdvanceStatus(order.id, "packed", "Pack Ho Gaya")}
                />
              ))
            )}
          </div>
        </section>

        {/* LANE 3: READY / PACKED */}
        <section className="bg-zinc-900/60 border border-emerald-950/60 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
          <div className="bg-emerald-950/40 border-b border-emerald-800/40 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-black text-emerald-200 uppercase tracking-wider">
                Ready (Pack Ho Gaya)
              </h2>
            </div>
            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {packedOrders.length}
            </span>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-3">
            {packedOrders.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-zinc-600 text-xs">
                <CheckCircle2 className="w-8 h-8 mb-2 stroke-1" />
                <p>Hot box khaali hai</p>
              </div>
            ) : (
              packedOrders.map((order) => (
                <KdsTicketCard
                  key={order.id}
                  order={order}
                  processing={processingId === order.id}
                  isPackedLane={true}
                  actionLabel="Rider Dispatch / Counter Pickup"
                  actionUrdu="Ready For Handover"
                  actionColor="bg-zinc-800 text-emerald-300 border border-emerald-700/50 cursor-default"
                  onAction={() => {}}
                />
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ Ticket Card */

type KdsTicketCardProps = {
  order: KdsOrder;
  processing: boolean;
  actionLabel: string;
  actionUrdu: string;
  actionColor: string;
  isPackedLane?: boolean;
  onAction: () => void;
};

function KdsTicketCard({
  order,
  processing,
  actionLabel,
  actionUrdu,
  actionColor,
  isPackedLane = false,
  onAction,
}: KdsTicketCardProps) {
  const elapsed = formatElapsed(order.created_at);

  const urgencyStyles = {
    normal: "bg-zinc-800/80 text-zinc-300 border-zinc-700",
    warning: "bg-amber-950/80 text-amber-300 border-amber-600 animate-pulse font-bold",
    danger: "bg-rose-950 text-rose-300 border-rose-600 animate-pulse font-black shadow-lg shadow-rose-900/40",
  }[elapsed.urgency];

  // Order type badge
  const orderTypeBadge = {
    takeaway: { label: "Takeaway", icon: ShoppingBag, color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
    dine_in: { label: "Dine-In", icon: UtensilsCrossed, color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
    delivery: { label: "Delivery", icon: Bike, color: "bg-teal-500/20 text-teal-300 border-teal-500/30" },
  }[order.order_type || "delivery"];

  const OrderTypeIcon = orderTypeBadge.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-xl border bg-zinc-900 p-3.5 shadow-xl flex flex-col justify-between transition-all ${
        elapsed.urgency === "danger"
          ? "border-rose-600/80 ring-2 ring-rose-500/20"
          : elapsed.urgency === "warning"
          ? "border-amber-600/70"
          : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      <div>
        {/* Ticket Header */}
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-black tracking-tight text-white">
              #{order.order_code}
            </span>
            {order.priority === "rush" && (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                RUSH
              </span>
            )}
            {order.priority === "vip" && (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                VIP
              </span>
            )}
          </div>

          {/* Running Timer */}
          <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs border ${urgencyStyles}`}>
            <Clock className="w-3.5 h-3.5" />
            <span className="font-mono">{elapsed.label}</span>
          </div>
        </div>

        {/* Order Channel & Destination */}
        <div className="flex items-center justify-between py-2 text-xs">
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-semibold ${orderTypeBadge.color}`}>
            <OrderTypeIcon className="w-3.5 h-3.5" />
            <span>{orderTypeBadge.label}</span>
          </div>

          <div className="text-right text-[11px] text-zinc-400 font-medium">
            {order.order_type === "dine_in" ? (
              <span className="text-purple-300 font-bold">
                Table: {typeof order.address === "string" ? order.address : "Counter Table"}
              </span>
            ) : order.order_type === "takeaway" ? (
              <span className="text-indigo-300 font-bold">Counter Pickup</span>
            ) : (
              <span className="truncate max-w-[140px] block">
                {typeof order.address === "string" ? order.address : "Narowal Town"}
              </span>
            )}
          </div>
        </div>

        {/* Items List */}
        <div className="my-2 py-2 border-y border-zinc-800/60 space-y-2">
          {order.order_items && order.order_items.length > 0 ? (
            order.order_items.map((item, idx) => (
              <div key={idx} className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-300 font-mono font-black text-xs flex items-center justify-center border border-amber-500/30 shrink-0">
                    {item.qty}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-zinc-100 leading-tight">
                      {item.dish_name}
                    </p>
                    {item.size && item.size !== "Regular" && (
                      <span className="text-[10px] text-zinc-400 font-medium bg-zinc-800 px-1.5 py-0.2 rounded">
                        {item.size}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-300 font-mono font-black text-xs flex items-center justify-center border border-amber-500/30 shrink-0">
                {order.qty || 1}
              </span>
              <div>
                <p className="text-xs font-bold text-zinc-100 leading-tight">{order.dish_name}</p>
                {order.size && (
                  <span className="text-[10px] text-zinc-400 font-medium bg-zinc-800 px-1.5 py-0.2 rounded">
                    {order.size}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {order.notes && (
          <div className="p-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800 text-[11px] text-amber-300/90 font-medium mb-2">
            ⚠️ Note: {order.notes}
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="pt-2">
        {isPackedLane ? (
          <div className="w-full py-2 px-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-400 flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Hot Box Ready
            </span>
            <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
              {order.order_type === "delivery" ? "Awaiting Rider" : "Awaiting Guest"}
            </span>
          </div>
        ) : (
          <button
            disabled={processing}
            onClick={onAction}
            className={`w-full py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition active:scale-[0.98] disabled:opacity-50 ${actionColor}`}
          >
            {processing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{actionLabel}</span>
                <span className="text-[10px] opacity-80 font-normal">({actionUrdu})</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}
