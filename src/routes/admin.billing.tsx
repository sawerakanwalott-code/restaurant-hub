import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Banknote,
  Wallet,
  ReceiptText,
  RefreshCw,
  ChevronDown,
  Loader2,
  BadgeAlert,
  CheckCircle2,
  AlertTriangle,
  FileBarChart2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { Panel } from "@/components/admin/bits";

export const Route = createFileRoute("/admin/billing")({
  ssr: false,
  component: AdminBillingPage,
});

type SubscriptionData = {
  id: number;
  status: string;
  plan: { name: string; price_pkr: string; max_branches: number; max_staff: number };
  trial_ends_at: string | null;
  current_period_end: string | null;
  next_billing_date: string | null;
  days_remaining_trial: number | null;
};

type ZReport = {
  date: string;
  tenant: string | null;
  gross_sales: string;
  order_count: number;
  avg_ticket: string;
  delivery_fees_collected: string;
  payment_split: { cod: string; jazzcash: string; easypaisa: string; card: string };
  cancelled: { count: number; value: string };
  status_breakdown: Record<string, number>;
};

const STATUS_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  trialing: { label: "Trial", icon: <CalendarDays className="w-4 h-4" />, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  active:   { label: "Active", icon: <CheckCircle2 className="w-4 h-4" />, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  past_due: { label: "Past Due", icon: <AlertTriangle className="w-4 h-4" />, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  cancelled: { label: "Cancelled", icon: <BadgeAlert className="w-4 h-4" />, color: "text-red-400 bg-red-500/10 border-red-500/20" },
};

function fmt(val: string | number) {
  return `Rs ${Number(val).toLocaleString("en-PK")}`;
}

function ZReportCard({ report }: { report: ZReport }) {
  const split = report.payment_split;
  const totalSplit = Number(split.cod) + Number(split.jazzcash) + Number(split.easypaisa) + Number(split.card);

  const bar = (val: string, label: string, color: string) => {
    const pct = totalSplit > 0 ? (Number(val) / totalSplit) * 100 : 0;
    return (
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-[#7a6e5e]">{label}</span>
          <span className="text-white font-mono">{fmt(val)}</span>
        </div>
        <div className="h-1.5 bg-[#2a2620] rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Gross Sales", value: fmt(report.gross_sales), icon: <TrendingUp className="w-5 h-5 text-emerald-400" />, sub: `${report.order_count} orders` },
          { label: "Avg. Ticket", value: fmt(report.avg_ticket), icon: <ShoppingBag className="w-5 h-5 text-purple-400" />, sub: "per order" },
          { label: "Delivery Fees", value: fmt(report.delivery_fees_collected), icon: <Banknote className="w-5 h-5 text-amber-400" />, sub: "collected" },
          { label: "Cancelled", value: fmt(report.cancelled.value), icon: <TrendingDown className="w-5 h-5 text-red-400" />, sub: `${report.cancelled.count} orders` },
        ].map(kpi => (
          <Panel key={kpi.label} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#7a6e5e] font-bold uppercase tracking-wider">{kpi.label}</span>
              {kpi.icon}
            </div>
            <p className="text-xl font-black text-white font-mono">{kpi.value}</p>
            <p className="text-[10px] text-[#7a6e5e] mt-0.5">{kpi.sub}</p>
          </Panel>
        ))}
      </div>

      {/* Payment split */}
      <Panel className="p-5">
        <div className="flex items-center gap-2 mb-5">
          <Wallet className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">Payment Split</h3>
        </div>
        <div className="space-y-3">
          {bar(split.cod, "Cash (COD)", "bg-amber-400")}
          {bar(split.jazzcash, "JazzCash", "bg-red-400")}
          {bar(split.easypaisa, "Easypaisa", "bg-green-400")}
          {bar(split.card, "Card", "bg-blue-400")}
        </div>
      </Panel>

      {/* Order status breakdown */}
      {Object.keys(report.status_breakdown).length > 0 && (
        <Panel className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileBarChart2 className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white">Status Breakdown</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(report.status_breakdown).map(([st, cnt]) => (
              <div key={st} className="bg-[#0e0d0b] rounded-xl p-3 border border-[#2a2620] text-center">
                <p className="text-xl font-black text-white">{cnt}</p>
                <p className="text-[10px] text-[#7a6e5e] capitalize mt-0.5">{st.replace("_", " ")}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function AdminBillingPage() {
  const [sub, setSub] = useState<SubscriptionData | null>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [zReport, setZReport] = useState<ZReport | null>(null);
  const [zDate, setZDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [zLoading, setZLoading] = useState(false);

  const fetchSub = useCallback(async () => {
    setSubLoading(true);
    try {
      const data = await api.get<SubscriptionData>("/billing/subscription/");
      setSub(data);
    } catch {
      toast.error("Subscription info load nahi hui.");
    } finally {
      setSubLoading(false);
    }
  }, []);

  const fetchZReport = useCallback(async (date: string) => {
    setZLoading(true);
    try {
      const data = await api.get<ZReport>(`/orders/zreport/?date=${date}`);
      setZReport(data);
    } catch {
      toast.error("Z-Report load nahi hua.");
    } finally {
      setZLoading(false);
    }
  }, []);

  useEffect(() => { fetchSub(); fetchZReport(zDate); }, [fetchSub, fetchZReport, zDate]);

  const statusMeta = sub ? STATUS_META[sub.status] ?? STATUS_META["active"] : null;

  const daysDiff = (dateStr: string | null) => {
    if (!dateStr) return null;
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
    return diff;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">

      {/* ── Subscription Card ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-2">
        <span className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
          <CreditCard className="w-6 h-6" />
        </span>
        <div>
          <h1 className="text-2xl font-black text-white">Billing & Subscription</h1>
          <p className="text-sm text-[#7a6e5e]">Plan details aur end-of-day Z-Report.</p>
        </div>
      </div>

      {subLoading ? (
        <Panel className="p-8 flex items-center justify-center text-[#7a6e5e] gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
          <span>Loading subscription...</span>
        </Panel>
      ) : sub ? (
        <Panel className="p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-black text-white">{sub.plan.name}</h2>
                {statusMeta && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${statusMeta.color}`}>
                    {statusMeta.icon}{statusMeta.label}
                  </span>
                )}
              </div>
              <p className="text-2xl font-black text-amber-400 font-mono">
                {fmt(sub.plan.price_pkr)}<span className="text-sm text-[#7a6e5e] font-normal">/month</span>
              </p>
              <div className="flex gap-6 mt-3 text-sm text-[#a09484]">
                <span>Up to <b className="text-white">{sub.plan.max_branches}</b> branches</span>
                <span>Up to <b className="text-white">{sub.plan.max_staff}</b> staff</span>
              </div>
            </div>
            <div className="text-right">
              {sub.status === "trialing" && sub.days_remaining_trial !== null && (
                <div className="text-sm">
                  <p className="text-[#7a6e5e]">Trial ends in</p>
                  <p className="text-3xl font-black text-blue-400">{sub.days_remaining_trial}<span className="text-sm"> days</span></p>
                </div>
              )}
              {sub.current_period_end && sub.status === "active" && (
                <div className="text-sm">
                  <p className="text-[#7a6e5e]">Renews in</p>
                  <p className="text-3xl font-black text-emerald-400">{daysDiff(sub.current_period_end)}<span className="text-sm"> days</span></p>
                  <p className="text-[10px] text-[#7a6e5e] mt-0.5">{new Date(sub.current_period_end).toLocaleDateString("en-PK")}</p>
                </div>
              )}
            </div>
          </div>

          {/* JazzCash Renewal Instructions */}
          <div className="mt-5 bg-[#0e0d0b] border border-[#2a2620] rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <ReceiptText className="w-4 h-4 text-red-400" />
              <p className="text-sm font-bold text-white">JazzCash Renewal Instructions</p>
            </div>
            <p className="text-sm text-[#a09484]">
              JazzCash se payment karein → transaction ID admin ko bhejein → subscription extend ho jaegi.
            </p>
            <div className="flex items-center gap-4 mt-2">
              <div className="text-xs">
                <span className="text-[#7a6e5e]">Till ID: </span>
                <span className="font-mono font-bold text-white">00293847</span>
              </div>
              <div className="text-xs">
                <span className="text-[#7a6e5e]">Account: </span>
                <span className="font-mono font-bold text-white">Kennedy Moon Grill SaaS</span>
              </div>
            </div>
          </div>
        </Panel>
      ) : (
        <Panel className="p-8 text-center text-[#7a6e5e]">
          <p>Subscription info load nahi hui. Backend se connection check karein.</p>
        </Panel>
      )}

      {/* ── Z-Report ────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <FileBarChart2 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-black text-white">End-of-Day Z-Report</h2>
              <p className="text-xs text-[#7a6e5e]">Roz ka financial snapshot — gross sales, cash vs wallet, cancellations.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={zDate}
              onChange={e => setZDate(e.target.value)}
              className="bg-[#0e0d0b] border border-[#2a2620] text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
            />
            <button
              onClick={() => fetchZReport(zDate)}
              disabled={zLoading}
              className="p-2 rounded-xl bg-[#1a1815] border border-[#2e2a24] text-[#a09484] hover:text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${zLoading ? "animate-spin text-emerald-400" : ""}`} />
            </button>
          </div>
        </div>

        {zLoading ? (
          <div className="flex items-center justify-center py-16 text-[#7a6e5e] gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            <span>Z-Report load ho raha hai...</span>
          </div>
        ) : zReport ? (
          <ZReportCard report={zReport} />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-[#7a6e5e] gap-3">
            <FileBarChart2 className="w-10 h-10 opacity-30" />
            <p className="text-sm">Is date ka koi data nahi mila.</p>
          </div>
        )}
      </div>
    </div>
  );
}
