import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Banknote, Bike, CheckCircle2, ChefHat, Clock, CloudOff, CreditCard, Delete, History, LayoutGrid,
  List, Lock, Minus, Pause, Percent, Phone, Play, Plus, Printer, RefreshCw, Search, Settings2,
  ShoppingBag, StickyNote, Store, Tag, Trash2, User, UtensilsCrossed, Wallet, X,
} from "lucide-react";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api/client";
import { ADMIN, MENU, ORDERS } from "@/lib/api/endpoints";
import { readAccount } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { ADMIN_ROLES } from "@/lib/roles";
import { DISHES, type Dish } from "@/lib/menu";
import { syncLiveBackendData } from "@/lib/admin-store";
import { ADMIN_EXTRA } from "@/lib/admin-extras";
import { formatMoney } from "@/lib/money";
import {
  POS_KEYS, changeDue, computeTotals, dishPrice, expectedCash, lineKey, load, quickCash, salesByMethod, save,
  type CashMove, type Discount, type OrderType, type PayMethod, type PosLine, type PosSale, type Shift,
} from "@/lib/pos";

export const Route = createFileRoute("/admin/pos")({
  beforeLoad: requireRole(ADMIN_ROLES),
  head: () => ({
    meta: [
      { title: "Counter POS — Kennedy Moon Grill" },
      { name: "description", content: "Fast counter till for takeaway, dine-in and delivery orders." },
    ],
  }),
  component: CounterPOSPage,
});

const POS_API = {
  shiftOpen: "/admin/pos/shifts/",
  shiftClose: (id: string) => `/admin/pos/shifts/${id}/close/`,
  cashMove: (id: string) => `/admin/pos/shifts/${id}/cash-moves/`,
  tables: "/admin/pos/tables/",
  voidOrder: (code: string) => `/orders/${encodeURIComponent(code)}/void/`,
};

const METHODS: { id: PayMethod; label: string; icon: typeof Banknote }[] = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "jazzcash", label: "JazzCash", icon: Wallet },
  { id: "easypaisa", label: "EasyPaisa", icon: Wallet },
];
const TABLES = Array.from({ length: 16 }, (_, i) => `T${i + 1}`);
const QUICK_NOTES = ["Less spicy", "Extra spicy", "No onion", "Extra raita", "Pack separately", "Well done"];

type Prefs = { taxPercent: number; servicePercent: number; deliveryFee: number; sound: boolean; layout: "grid" | "list"; autoKot: boolean };
const DEFAULT_PREFS: Prefs = { taxPercent: 0, servicePercent: 0, deliveryFee: 150, sound: true, layout: "grid", autoKot: true };

type Held = { id: string; at: string; label: string; lines: PosLine[]; type: OrderType; table: string; customer: { name: string; phone: string; address: string }; discount: Discount };

type Receipt = {
  code: string; at: string; type: OrderType; table: string; cashier: string;
  customer: { name: string; phone: string; address: string };
  lines: PosLine[]; totals: ReturnType<typeof computeTotals>;
  payments: { method: PayMethod; amount: number; ref?: string }[]; tendered: number; change: number; offline: boolean;
};

function chime() {
  try {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new C(); const t = ctx.currentTime; const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.setValueAtTime(988, t); o.frequency.exponentialRampToValueAtTime(1976, t + 0.15);
    g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.4);
  } catch { /* ignore */ }
}

const uid = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const isOffline = (e: unknown) => e instanceof ApiError && e.isNetwork;
const notBuilt = (e: unknown) => e instanceof ApiError && (e.isNetwork || [404, 405, 501].includes(e.status));
const Rs = (n: number) => formatMoney(n);

export function CounterPOSPage() {
  const cashier = readAccount()?.name || "Cashier";
  const searchRef = useRef<HTMLInputElement>(null);

  const [dishes, setDishes] = useState<Dish[]>(DISHES);
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  const [type, setType] = useState<OrderType>("takeaway");
  const [table, setTable] = useState("");
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "" });
  const [lines, setLines] = useState<PosLine[]>([]);
  const [discount, setDiscount] = useState<Discount>({ kind: "flat", value: 0, reason: "" });
  const [coupon, setCoupon] = useState({ code: "", amount: 0, label: "" });

  const [held, setHeld] = useState<Held[]>([]);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [shift, setShift] = useState<Shift | null>(null);
  const [customers, setCustomers] = useState<{ name: string; phone: string; address?: string }[]>([]);

  const [panel, setPanel] = useState<null | "pay" | "receipt" | "held" | "sales" | "shift" | "prefs" | "discount">(null);
  const [sizeFor, setSizeFor] = useState<Dish | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [printMode, setPrintMode] = useState<"receipt" | "kot">("receipt");
  const [busy, setBusy] = useState(false);

  // ── boot ──
  useEffect(() => {
    setHeld(load(POS_KEYS.held, [])); setSales(load(POS_KEYS.sales, []));
    setShift(load(POS_KEYS.shift, null)); setPrefs({ ...DEFAULT_PREFS, ...load(POS_KEYS.prefs, {}) });
    api.get<Dish[]>(MENU.dishes).then((d) => Array.isArray(d) && d.length && setDishes(d)).catch(() => {});
    api.get<Record<string, unknown>>(ADMIN_EXTRA.settings).then((s) => {
      setPrefs((p) => ({ ...p, taxPercent: Number(s?.tax_percent ?? p.taxPercent), servicePercent: Number(s?.service_charge_percent ?? p.servicePercent), deliveryFee: Number(s?.delivery_fee ?? p.deliveryFee) }));
    }).catch(() => {});
    api.get<unknown>(ADMIN.customers).then((r) => {
      const list = Array.isArray(r) ? r : (r as { results?: unknown[] })?.results ?? [];
      setCustomers((list as Record<string, unknown>[]).map((c) => ({ name: String(c.name ?? c.full_name ?? ""), phone: String(c.phone ?? ""), address: c.address ? String(c.address) : undefined })).filter((c) => c.phone));
    }).catch(() => {});
  }, []);
  useEffect(() => save(POS_KEYS.held, held), [held]);
  useEffect(() => save(POS_KEYS.sales, sales.slice(0, 300)), [sales]);
  useEffect(() => save(POS_KEYS.shift, shift), [shift]);
  useEffect(() => save(POS_KEYS.prefs, prefs), [prefs]);

  const categories = useMemo(() => ["all", ...new Set(dishes.map((d) => d.categoryName).filter(Boolean) as string[])], [dishes]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return dishes.filter((d) => (cat === "all" || d.categoryName === cat) && (!s || `${d.name} ${d.slug} ${d.tag}`.toLowerCase().includes(s)));
  }, [dishes, cat, q]);

  const totals = useMemo(() => computeTotals({
    lines, discount, couponDiscount: coupon.amount, taxPercent: prefs.taxPercent,
    servicePercent: type === "dine_in" ? prefs.servicePercent : 0, deliveryFee: type === "delivery" ? prefs.deliveryFee : 0,
  }), [lines, discount, coupon.amount, prefs, type]);

  const unsent = lines.some((l) => l.qty > l.sentQty);
  const pendingSync = sales.filter((s) => !s.synced).length;
  const phoneMatches = customer.phone.length >= 4 ? customers.filter((c) => c.phone.includes(customer.phone) && c.phone !== customer.phone).slice(0, 4) : [];

  // ── cart ops ──
  const add = (d: Dish, size?: string) => {
    if (!size && (d.sizes?.length ?? 0) > 1) return setSizeFor(d);
    const sz = size ?? d.sizes?.[0]?.size ?? "Regular";
    const key = lineKey(d.slug, sz, "");
    setLines((p) => p.some((l) => l.key === key)
      ? p.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l))
      : [...p, { key, dishId: d.id, slug: d.slug, name: d.name, size: sz, unitPrice: dishPrice(d, sz), qty: 1, note: "", sentQty: 0 }]);
    setSizeFor(null);
  };
  const qty = (key: string, delta: number) => setLines((p) => p.flatMap((l) => (l.key !== key ? [l] : l.qty + delta <= 0 ? [] : [{ ...l, qty: l.qty + delta }])));
  const setNote = (key: string, note: string) => setLines((p) => p.map((l) => (l.key === key ? { ...l, note } : l)));

  const reset = () => {
    setLines([]); setDiscount({ kind: "flat", value: 0, reason: "" }); setCoupon({ code: "", amount: 0, label: "" });
    setCustomer({ name: "", phone: "", address: "" }); setTable("");
  };

  const hold = useCallback(() => {
    if (!lines.length) return toast.error("Nothing to hold");
    const label = type === "dine_in" && table ? `Table ${table}` : customer.name || `Order ${held.length + 1}`;
    setHeld((h) => [{ id: uid(), at: new Date().toISOString(), label, lines, type, table, customer, discount }, ...h]);
    reset(); toast.success(`Held — ${label}`);
  }, [lines, type, table, customer, discount, held.length]);

  const recall = (h: Held) => {
    if (lines.length) hold();
    setLines(h.lines); setType(h.type); setTable(h.table); setCustomer(h.customer); setDiscount(h.discount);
    setHeld((x) => x.filter((y) => y.id !== h.id)); setPanel(null);
  };

  const applyCoupon = async () => {
    if (!coupon.code.trim()) return;
    try {
      const r = await api.post<{ discount?: number | string; label?: string; valid?: boolean }>(ORDERS.applyCoupon, { code: coupon.code.trim(), subtotal: totals.subtotal });
      if (r?.valid === false) throw new Error("Coupon not valid");
      setCoupon((c) => ({ ...c, amount: Number(r?.discount ?? 0), label: r?.label ?? c.code }));
      toast.success(`Coupon applied: ${r?.label ?? coupon.code}`);
    } catch (e) {
      setCoupon((c) => ({ ...c, amount: 0, label: "" }));
      toast.error(e instanceof Error ? e.message : "Coupon not valid");
    }
  };

  const printNow = (mode: "receipt" | "kot") => { setPrintMode(mode); setTimeout(() => window.print(), 50); };

  const sendKot = () => {
    if (!unsent) return toast.info("Kitchen already has every item");
    setReceipt({ code: "KOT", at: new Date().toLocaleString(), type, table, cashier, customer, lines: lines.map((l) => ({ ...l, qty: l.qty - l.sentQty })).filter((l) => l.qty > 0), totals, payments: [], tendered: 0, change: 0, offline: false });
    setLines((p) => p.map((l) => ({ ...l, sentQty: l.qty })));
    printNow("kot");
  };

  // ── checkout ──
  const complete = async (payments: { method: PayMethod; amount: number; ref?: string }[], tendered: number) => {
    if (!shift) { toast.error("Open a shift first"); setPanel("shift"); return; }
    if (type === "dine_in" && !table) return toast.error("Pick a table");
    if (type === "delivery" && (!customer.phone || !customer.address)) return toast.error("Delivery needs phone and address");
    setBusy(true);
    const payload = {
      source: "pos", order_type: type, status: "confirmed", shift_id: shift.id,
      payment: payments.length > 1 ? "split" : payments[0]?.method,
      payments: payments.map((p) => ({ method: p.method, amount: p.amount, reference: p.ref ?? "" })),
      payment_status: "paid",
      customer_name: customer.name.trim() || "Walk-in Guest", customer_phone: customer.phone.trim(),
      delivery_address: type === "delivery" ? customer.address : type === "dine_in" ? `Dine-In ${table}` : "Counter Takeaway",
      table_number: table, coupon_code: coupon.amount ? coupon.code : "",
      discount: totals.discount, discount_reason: discount.reason, service_charge: totals.service, tax: totals.tax,
      delivery_fee: totals.deliveryFee, total: totals.total,
      items: lines.map((l) => ({ dish_id: l.dishId, dish_slug: l.slug, size: l.size, qty: l.qty, price: l.unitPrice, note: l.note })),
    };
    let code = `POS-${uid()}`; let offline = false;
    try {
      const r = await api.post<{ order_code?: string }>(ORDERS.create, payload);
      if (r?.order_code) code = r.order_code;
    } catch (e) {
      if (!isOffline(e)) { setBusy(false); toast.error(e instanceof Error ? e.message : "Could not save order"); return; }
      offline = true; toast.warning("No connection — saved on this till, will send when back online");
    }
    if (prefs.sound) chime();
    const rec: Receipt = { code, at: new Date().toLocaleString(), type, table, cashier, customer, lines, totals, payments, tendered, change: changeDue(totals.total, tendered), offline };
    setSales((s) => [{ code, at: new Date().toISOString(), type, total: totals.total, payments, synced: !offline, payload, receipt: rec }, ...s]);
    setReceipt(rec); setPanel("receipt"); setBusy(false);
    if (prefs.autoKot && unsent) setLines((p) => p.map((l) => ({ ...l, sentQty: l.qty })));
    reset(); syncLiveBackendData().catch(() => {});
  };

  const retrySync = async () => {
    let ok = 0;
    for (const s of sales.filter((x) => !x.synced)) {
      try { await api.post(ORDERS.create, s.payload); ok++; setSales((all) => all.map((x) => (x.code === s.code ? { ...x, synced: true } : x))); } catch { break; }
    }
    toast[ok ? "success" : "error"](ok ? `${ok} order(s) sent` : "Still offline");
  };

  const voidSale = async (s: PosSale) => {
    const reason = window.prompt(`Reason for voiding ${s.code}?`);
    if (!reason) return;
    try { await api.post(POS_API.voidOrder(s.code), { reason }); } catch (e) { if (!notBuilt(e)) return toast.error("Could not void"); toast.info("Voided on this till only", { description: "The server part isn't ready yet." }); }
    setSales((all) => all.map((x) => (x.code === s.code ? { ...x, voided: true } : x)));
  };

  // ── shortcuts ──
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA";
      if (e.key === "Escape") { setPanel(null); setSizeFor(null); setNoteFor(null); }
      else if (e.key === "F2") { e.preventDefault(); if (lines.length) setPanel("pay"); }
      else if (e.key === "F4") { e.preventDefault(); hold(); }
      else if (e.key === "F8") { e.preventDefault(); sendKot(); }
      else if (e.key === "/" && !typing) { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on);
  });

  const busyTables = new Set(held.filter((h) => h.type === "dine_in").map((h) => h.table));

  return (
    <>
      <PrintArea receipt={receipt} mode={printMode} />

      <div className="print:hidden h-[calc(100vh-4rem)] flex flex-col bg-background">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border bg-card/70">
          <Store className="w-4 h-4 text-primary" />
          <span className="font-bold text-sm">Counter POS</span>
          <button onClick={() => setPanel("shift")} className={`pos-chip ${shift ? "text-primary" : "text-destructive"}`}>
            {shift ? <><Clock className="w-3.5 h-3.5" /> Shift open · {new Date(shift.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</> : <><Lock className="w-3.5 h-3.5" /> Shift closed</>}
          </button>
          <span className="text-xs text-muted-foreground">Cashier <b className="text-foreground">{cashier}</b></span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {pendingSync > 0 && <button onClick={retrySync} className="pos-chip text-destructive"><CloudOff className="w-3.5 h-3.5" /> {pendingSync} unsent · retry</button>}
            <button onClick={() => setPanel("held")} className="pos-chip"><Pause className="w-3.5 h-3.5" /> Held ({held.length})</button>
            <button onClick={() => setPanel("sales")} className="pos-chip"><History className="w-3.5 h-3.5" /> Today ({sales.filter((s) => s.at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length})</button>
            <button onClick={() => setPanel("prefs")} className="pos-chip"><Settings2 className="w-3.5 h-3.5" /> Till settings</button>
          </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* menu */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
            <div className="p-3 space-y-2 border-b border-border/60">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dishes  ( / )"
                    onKeyDown={(e) => { if (e.key === "Enter" && filtered[0]) { add(filtered[0]); setQ(""); } }}
                    className="pos-input pl-9" />
                </div>
                <button onClick={() => setPrefs((p) => ({ ...p, layout: p.layout === "grid" ? "list" : "grid" }))} className="pos-icon-btn" aria-label="Toggle layout">
                  {prefs.layout === "grid" ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                {categories.map((c) => (
                  <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap capitalize ${cat === c ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}>
                    {c === "all" ? `All (${dishes.length})` : c}
                  </button>
                ))}
              </div>
            </div>
            <div className={`flex-1 overflow-y-auto p-3 content-start ${prefs.layout === "grid" ? "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5" : "flex flex-col gap-1.5"}`}>
              {filtered.map((d) => {
                const inCart = lines.filter((l) => l.slug === d.slug).reduce((a, l) => a + l.qty, 0);
                return (
                  <motion.button key={d.slug} whileTap={{ scale: 0.96 }} onClick={() => add(d)}
                    className={`relative text-left rounded-xl border bg-card hover:border-primary/60 transition ${inCart ? "border-primary" : "border-border"} ${prefs.layout === "grid" ? "p-2 flex flex-col" : "p-2 flex items-center gap-3"}`}>
                    {d.image && <img src={d.image} alt="" loading="lazy" className={prefs.layout === "grid" ? "w-full h-20 object-cover rounded-lg mb-2" : "w-10 h-10 object-cover rounded-md"} />}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm line-clamp-1">{d.name}</div>
                      <div className="text-[11px] text-muted-foreground line-clamp-1">{d.sizes?.length > 1 ? `${d.sizes.length} sizes` : d.categoryName}</div>
                    </div>
                    <div className="text-xs font-black text-primary mt-1">{d.sizes?.length > 1 ? "from " : ""}{Rs(dishPrice(d))}</div>
                    {inCart > 0 && <span className="absolute top-1.5 right-1.5 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[11px] font-black grid place-items-center">{inCart}</span>}
                  </motion.button>
                );
              })}
              {!filtered.length && <p className="text-sm text-muted-foreground col-span-full text-center py-10">No dishes match “{q}”.</p>}
            </div>
          </div>

          {/* register */}
          <div className="w-full md:w-[440px] xl:w-[480px] flex flex-col bg-card/40 overflow-hidden">
            <div className="p-3 space-y-2.5 border-b border-border">
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted/60">
                {([["takeaway", "Takeaway", ShoppingBag], ["dine_in", "Dine-in", UtensilsCrossed], ["delivery", "Delivery", Bike]] as const).map(([id, label, Icon]) => (
                  <button key={id} onClick={() => setType(id)} className={`py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 ${type === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                    <Icon className="w-3.5 h-3.5 text-primary" /> {label}
                  </button>
                ))}
              </div>
              {type === "dine_in" && (
                <div className="grid grid-cols-8 gap-1">
                  {TABLES.map((t) => (
                    <button key={t} onClick={() => setTable(t)} disabled={busyTables.has(t) && table !== t}
                      className={`py-1 rounded-md text-[11px] font-bold border ${table === t ? "bg-primary text-primary-foreground border-primary" : busyTables.has(t) ? "border-destructive/40 text-destructive/70" : "border-border text-muted-foreground hover:text-foreground"}`}>{t}</button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 relative">
                <label className="relative"><User className="pos-in-icon" /><input className="pos-input pl-8 py-1.5 text-xs" placeholder="Customer name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} /></label>
                <label className="relative"><Phone className="pos-in-icon" /><input className="pos-input pl-8 py-1.5 text-xs" inputMode="tel" placeholder="03XXXXXXXXX" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></label>
                {phoneMatches.length > 0 && (
                  <div className="absolute z-20 top-full right-0 mt-1 w-1/2 rounded-lg border border-border bg-popover shadow-lg">
                    {phoneMatches.map((c) => (
                      <button key={c.phone} onClick={() => setCustomer({ name: c.name, phone: c.phone, address: c.address ?? customer.address })} className="block w-full text-left px-2.5 py-1.5 text-xs hover:bg-muted">
                        <b>{c.name || "Customer"}</b> <span className="text-muted-foreground">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {type === "delivery" && <input className="pos-input py-1.5 text-xs" placeholder="Delivery address" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} />}
            </div>

            {/* lines */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {!lines.length && <div className="h-full grid place-items-center text-center text-sm text-muted-foreground"><div><ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-40" />Tap a dish to start the order<div className="text-[11px] mt-1">F2 pay · F4 hold · F8 kitchen · / search</div></div></div>}
              <AnimatePresence initial={false}>
                {lines.map((l) => (
                  <motion.div key={l.key} layout initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="rounded-xl border border-border bg-card p-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{l.name} {l.size !== "Regular" && <span className="text-muted-foreground font-medium">· {l.size}</span>}</div>
                        <div className="text-[11px] text-muted-foreground">{Rs(l.unitPrice)} each {l.sentQty > 0 && <span className="text-primary">· {l.sentQty} in kitchen</span>}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => qty(l.key, -1)} className="pos-qty"><Minus className="w-3 h-3" /></button>
                        <span className="w-6 text-center text-sm font-black">{l.qty}</span>
                        <button onClick={() => qty(l.key, 1)} className="pos-qty"><Plus className="w-3 h-3" /></button>
                      </div>
                      <div className="w-20 text-right text-sm font-black">{Rs(l.unitPrice * l.qty)}</div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <button onClick={() => setNoteFor(noteFor === l.key ? null : l.key)} className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1"><StickyNote className="w-3 h-3" />{l.note || "Add note"}</button>
                      <button onClick={() => qty(l.key, -l.qty)} className="ml-auto text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1"><Trash2 className="w-3 h-3" /> Remove</button>
                    </div>
                    {noteFor === l.key && (
                      <div className="mt-1.5 space-y-1.5">
                        <input autoFocus className="pos-input py-1 text-xs" value={l.note} onChange={(e) => setNote(l.key, e.target.value)} placeholder="Kitchen note" onKeyDown={(e) => e.key === "Enter" && setNoteFor(null)} />
                        <div className="flex flex-wrap gap-1">{QUICK_NOTES.map((n) => <button key={n} onClick={() => setNote(l.key, l.note ? `${l.note}, ${n}` : n)} className="px-2 py-0.5 rounded-md bg-muted text-[10px]">{n}</button>)}</div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* totals */}
            <div className="border-t border-border p-3 space-y-2 bg-card">
              <div className="flex gap-2">
                <div className="relative flex-1"><Tag className="pos-in-icon" /><input className="pos-input pl-8 py-1.5 text-xs uppercase" placeholder="Coupon" value={coupon.code} onChange={(e) => setCoupon({ code: e.target.value, amount: 0, label: "" })} onKeyDown={(e) => e.key === "Enter" && applyCoupon()} /></div>
                <button onClick={applyCoupon} className="pos-chip">Apply</button>
                <button onClick={() => setPanel("discount")} className="pos-chip"><Percent className="w-3.5 h-3.5" /> Discount</button>
              </div>
              <div className="text-xs space-y-0.5">
                <Row k={`Subtotal (${totals.itemCount} items)`} v={Rs(totals.subtotal)} />
                {totals.discount > 0 && <Row k={`Discount${coupon.label ? ` · ${coupon.label}` : ""}${discount.reason ? ` · ${discount.reason}` : ""}`} v={`− ${Rs(totals.discount)}`} accent />}
                {totals.service > 0 && <Row k={`Service ${prefs.servicePercent}%`} v={Rs(totals.service)} />}
                {totals.tax > 0 && <Row k={`Tax ${prefs.taxPercent}%`} v={Rs(totals.tax)} />}
                {totals.deliveryFee > 0 && <Row k="Delivery fee" v={Rs(totals.deliveryFee)} />}
              </div>
              <div className="flex items-baseline justify-between pt-1 border-t border-dashed border-border">
                <span className="text-sm font-bold">Total</span><span className="text-2xl font-black text-primary">{Rs(totals.total)}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <button onClick={() => { if (lines.length && window.confirm("Clear this order?")) reset(); }} className="pos-act"><Trash2 className="w-4 h-4" />Clear</button>
                <button onClick={hold} className="pos-act"><Pause className="w-4 h-4" />Hold</button>
                <button onClick={sendKot} className={`pos-act ${unsent ? "text-primary" : ""}`}><ChefHat className="w-4 h-4" />Kitchen</button>
                <button disabled={!lines.length} onClick={() => setPanel("pay")} className="pos-act bg-primary text-primary-foreground border-primary disabled:opacity-40"><Banknote className="w-4 h-4" />Pay</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* size picker */}
      <Modal open={!!sizeFor} onClose={() => setSizeFor(null)} title={sizeFor?.name ?? ""}>
        <div className="grid grid-cols-2 gap-2">
          {sizeFor?.sizes.map((s) => (
            <button key={s.size} onClick={() => add(sizeFor, s.size)} className="p-3 rounded-xl border border-border hover:border-primary text-left">
              <div className="font-bold">{s.size}</div><div className="text-primary font-black">{Rs(Number(s.price))}</div>
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={panel === "discount"} onClose={() => setPanel(null)} title="Order discount">
        <DiscountForm value={discount} subtotal={totals.subtotal} onSave={(d) => { setDiscount(d); setPanel(null); }} />
      </Modal>

      <Modal open={panel === "pay"} onClose={() => setPanel(null)} title={`Take payment · ${Rs(totals.total)}`} wide>
        <PayPanel total={totals.total} busy={busy} onDone={complete} />
      </Modal>

      <Modal open={panel === "receipt"} onClose={() => setPanel(null)} title="Order complete">
        {receipt && (
          <div className="text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
            <div className="text-2xl font-black tracking-widest">{receipt.code}</div>
            {receipt.offline && <p className="text-xs text-destructive">Saved on this till — will be sent when online.</p>}
            {receipt.change > 0 && <div className="rounded-xl bg-primary/10 p-3"><div className="text-xs text-muted-foreground">Change to give</div><div className="text-3xl font-black text-primary">{Rs(receipt.change)}</div></div>}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => printNow("receipt")} className="pos-act"><Printer className="w-4 h-4" />Receipt</button>
              <button onClick={() => printNow("kot")} className="pos-act"><ChefHat className="w-4 h-4" />Kitchen</button>
              <button onClick={() => { setPanel(null); searchRef.current?.focus(); }} className="pos-act bg-primary text-primary-foreground border-primary"><Plus className="w-4 h-4" />New order</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={panel === "held"} onClose={() => setPanel(null)} title="Held orders">
        {!held.length ? <p className="text-sm text-muted-foreground">No held orders.</p> : (
          <div className="space-y-1.5">{held.map((h) => (
            <div key={h.id} className="flex items-center gap-2 p-2 rounded-xl border border-border">
              <div className="flex-1"><div className="font-bold text-sm">{h.label}</div><div className="text-[11px] text-muted-foreground">{h.lines.reduce((a, l) => a + l.qty, 0)} items · {new Date(h.at).toLocaleTimeString()}</div></div>
              <button onClick={() => recall(h)} className="pos-chip text-primary"><Play className="w-3.5 h-3.5" /> Resume</button>
              <button onClick={() => setHeld((x) => x.filter((y) => y.id !== h.id))} className="pos-icon-btn"><X className="w-4 h-4" /></button>
            </div>))}
          </div>
        )}
      </Modal>

      <Modal open={panel === "sales"} onClose={() => setPanel(null)} title="Today's sales on this till" wide>
        <SalesList sales={sales} onReprint={(s) => { setReceipt(s.receipt as Receipt); printNow("receipt"); }} onVoid={voidSale} />
      </Modal>

      <Modal open={panel === "shift"} onClose={() => setPanel(null)} title={shift ? "Shift & cash drawer" : "Open a shift"}>
        <ShiftPanel shift={shift} sales={shift ? sales.filter((s) => s.at >= shift.openedAt) : []} cashier={cashier} setShift={setShift} />
      </Modal>

      <Modal open={panel === "prefs"} onClose={() => setPanel(null)} title="Till settings">
        <div className="space-y-3 text-sm">
          <NumField label="Tax %" value={prefs.taxPercent} onChange={(v) => setPrefs({ ...prefs, taxPercent: v })} />
          <NumField label="Service charge % (dine-in)" value={prefs.servicePercent} onChange={(v) => setPrefs({ ...prefs, servicePercent: v })} />
          <NumField label="Delivery fee (Rs)" value={prefs.deliveryFee} onChange={(v) => setPrefs({ ...prefs, deliveryFee: v })} />
          <Toggle label="Cash register sound" on={prefs.sound} set={(v) => setPrefs({ ...prefs, sound: v })} />
          <Toggle label="Mark items as sent to kitchen on payment" on={prefs.autoKot} set={(v) => setPrefs({ ...prefs, autoKot: v })} />
          <p className="text-[11px] text-muted-foreground">Tax, service and delivery fee load from Restaurant settings when the server provides them.</p>
        </div>
      </Modal>
    </>
  );
}

/* ───────────── pieces ───────────── */

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return <div className={`flex justify-between ${accent ? "text-primary" : "text-muted-foreground"}`}><span className="truncate pr-2">{k}</span><span className="font-semibold">{v}</span></div>;
}

function Modal({ open, onClose, title, wide, children }: { open: boolean; onClose: () => void; title: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="print:hidden fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div onClick={(e) => e.stopPropagation()} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
            className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[88vh] overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-2xl`}>
            <div className="flex items-center justify-between mb-3"><h3 className="font-black">{title}</h3><button onClick={onClose} className="pos-icon-btn" aria-label="Close"><X className="w-4 h-4" /></button></div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return <label className="flex items-center justify-between gap-3"><span>{label}</span><input type="number" min={0} className="pos-input w-28 py-1.5 text-right" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} /></label>;
}
function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return <label className="flex items-center justify-between gap-3 cursor-pointer"><span>{label}</span><button type="button" onClick={() => set(!on)} className={`w-10 h-6 rounded-full p-0.5 transition ${on ? "bg-primary" : "bg-muted"}`}><span className={`block w-5 h-5 rounded-full bg-background transition ${on ? "translate-x-4" : ""}`} /></button></label>;
}

function DiscountForm({ value, subtotal, onSave }: { value: Discount; subtotal: number; onSave: (d: Discount) => void }) {
  const [d, setD] = useState(value);
  const amt = d.kind === "percent" ? Math.round((subtotal * d.value) / 100) : d.value;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted/60">
        {(["flat", "percent"] as const).map((k) => <button key={k} onClick={() => setD({ ...d, kind: k })} className={`py-1.5 rounded-lg text-xs font-bold ${d.kind === k ? "bg-background" : "text-muted-foreground"}`}>{k === "flat" ? "Amount (Rs)" : "Percent (%)"}</button>)}
      </div>
      <input type="number" min={0} autoFocus className="pos-input text-lg font-black" value={d.value || ""} onChange={(e) => setD({ ...d, value: Number(e.target.value) || 0 })} />
      <div className="flex flex-wrap gap-1.5">{(d.kind === "percent" ? [5, 10, 15, 20, 50] : [50, 100, 200, 500]).map((v) => <button key={v} onClick={() => setD({ ...d, value: v })} className="pos-chip">{d.kind === "percent" ? `${v}%` : `Rs ${v}`}</button>)}</div>
      <div className="flex flex-wrap gap-1.5">{["Regular customer", "Staff meal", "Complaint", "Owner approved"].map((r) => <button key={r} onClick={() => setD({ ...d, reason: r })} className={`pos-chip ${d.reason === r ? "text-primary border-primary" : ""}`}>{r}</button>)}</div>
      <input className="pos-input text-xs" placeholder="Reason (shown in activity log)" value={d.reason} onChange={(e) => setD({ ...d, reason: e.target.value })} />
      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Discount</span><b className="text-primary">− {Rs(Math.min(subtotal, amt))}</b></div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => onSave({ kind: "flat", value: 0, reason: "" })} className="pos-act">Remove</button>
        <button onClick={() => { if (d.value > 0 && !d.reason.trim()) return toast.error("Add a reason"); onSave(d); }} className="pos-act bg-primary text-primary-foreground border-primary">Apply</button>
      </div>
    </div>
  );
}

function PayPanel({ total, busy, onDone }: { total: number; busy: boolean; onDone: (p: { method: PayMethod; amount: number; ref?: string }[], tendered: number) => void }) {
  const [method, setMethod] = useState<PayMethod>("cash");
  const [entry, setEntry] = useState("");
  const [ref, setRef] = useState("");
  const [parts, setParts] = useState<{ method: PayMethod; amount: number; ref?: string }[]>([]);
  const paid = parts.reduce((a, p) => a + p.amount, 0);
  const remaining = Math.max(0, total - paid);
  const typed = Number(entry) || 0;
  const key = (k: string) => setEntry((e) => (k === "C" ? "" : k === "<" ? e.slice(0, -1) : (e + k).replace(/^0+(?=\d)/, "").slice(0, 7)));

  const finish = (amount: number) => {
    if (method !== "cash" && !ref.trim() && method !== "card") return toast.error("Enter the wallet transaction ID");
    const take = method === "cash" ? amount : Math.min(amount, remaining);
    const all = [...parts, { method, amount: Math.min(take, remaining), ref: ref.trim() || undefined }];
    if (take < remaining) { setParts(all); setEntry(""); setRef(""); toast.info(`Rs ${remaining - take} left — choose next method`); return; }
    const cashTendered = method === "cash" ? amount : 0;
    const otherCash = parts.filter((p) => p.method === "cash").reduce((a, p) => a + p.amount, 0);
    onDone(all, cashTendered ? cashTendered + otherCash : 0);
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-1.5">
          {METHODS.map((m) => <button key={m.id} onClick={() => setMethod(m.id)} className={`p-2.5 rounded-xl border flex items-center gap-2 text-sm font-bold ${method === m.id ? "border-primary bg-primary/10 text-primary" : "border-border"}`}><m.icon className="w-4 h-4" />{m.label}</button>)}
        </div>
        <div className="rounded-xl bg-muted/40 p-3 text-sm space-y-1">
          <Row k="Total" v={Rs(total)} />
          {parts.map((p, i) => <Row key={i} k={`Paid · ${p.method}${p.ref ? ` (${p.ref})` : ""}`} v={Rs(p.amount)} accent />)}
          <div className="flex justify-between font-black text-base pt-1 border-t border-border"><span>Remaining</span><span className="text-primary">{Rs(remaining)}</span></div>
          {method === "cash" && typed > remaining && <div className="flex justify-between font-black text-primary"><span>Change</span><span>{Rs(typed - remaining)}</span></div>}
        </div>
        {method !== "cash" && <input className="pos-input text-sm" placeholder={method === "card" ? "Card slip / last 4 (optional)" : "Transaction ID"} value={ref} onChange={(e) => setRef(e.target.value)} />}
        {parts.length > 0 && <button onClick={() => setParts([])} className="text-xs text-muted-foreground flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Reset split</button>}
      </div>
      <div className="space-y-2">
        <div className="pos-input text-right text-2xl font-black h-12 flex items-center justify-end">{entry ? Rs(typed) : <span className="text-muted-foreground text-base">{Rs(remaining)}</span>}</div>
        {method === "cash" && <div className="flex flex-wrap gap-1.5">{quickCash(remaining).map((v) => <button key={v} onClick={() => setEntry(String(v))} className="pos-chip">{v === remaining ? "Exact" : `Rs ${v.toLocaleString()}`}</button>)}</div>}
        <div className="grid grid-cols-3 gap-1.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "<"].map((k) => <button key={k} onClick={() => key(k)} className="pos-act h-11 text-lg font-black">{k === "<" ? <Delete className="w-4 h-4" /> : k}</button>)}
        </div>
        <button disabled={busy || (method === "cash" && entry !== "" && typed <= 0)} onClick={() => finish(entry ? typed : remaining)}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-black flex items-center justify-center gap-2 disabled:opacity-50">
          <CheckCircle2 className="w-5 h-5" /> {busy ? "Saving…" : entry && typed < remaining ? `Take ${Rs(typed)} (split)` : "Complete sale"}
        </button>
      </div>
    </div>
  );
}

function SalesList({ sales, onReprint, onVoid }: { sales: PosSale[]; onReprint: (s: PosSale) => void; onVoid: (s: PosSale) => void }) {
  const today = sales.filter((s) => s.at.slice(0, 10) === new Date().toISOString().slice(0, 10));
  const by = salesByMethod(today);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">{METHODS.map((m) => <div key={m.id} className="rounded-xl bg-muted/40 p-2"><div className="text-[11px] text-muted-foreground">{m.label}</div><div className="font-black text-sm">{Rs(by[m.id])}</div></div>)}</div>
      {!today.length ? <p className="text-sm text-muted-foreground">No sales yet today.</p> : today.map((s) => (
        <div key={s.code} className={`flex items-center gap-2 p-2 rounded-xl border border-border ${s.voided ? "opacity-50 line-through" : ""}`}>
          <div className="flex-1"><div className="font-bold text-sm">{s.code} {!s.synced && <span className="text-destructive text-[10px] no-underline">· unsent</span>}</div><div className="text-[11px] text-muted-foreground">{new Date(s.at).toLocaleTimeString()} · {s.type.replace("_", "-")} · {s.payments.map((p) => p.method).join(" + ")}</div></div>
          <b className="text-sm">{Rs(s.total)}</b>
          <button onClick={() => onReprint(s)} className="pos-icon-btn" aria-label="Reprint"><Printer className="w-4 h-4" /></button>
          {!s.voided && <button onClick={() => onVoid(s)} className="pos-icon-btn text-destructive" aria-label="Void"><X className="w-4 h-4" /></button>}
        </div>
      ))}
    </div>
  );
}

function ShiftPanel({ shift, sales, cashier, setShift }: { shift: Shift | null; sales: PosSale[]; cashier: string; setShift: (s: Shift | null) => void }) {
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [counted, setCounted] = useState(0);
  const call = async (path: string, body: unknown) => { try { await api.post(path, body); } catch (e) { if (!notBuilt(e)) throw e; } };

  if (!shift) return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Count the cash in the drawer before the first sale.</p>
      <NumField label="Opening float (Rs)" value={amount} onChange={setAmount} />
      <button onClick={async () => { const s: Shift = { id: `SH-${uid()}`, openedAt: new Date().toISOString(), openedBy: cashier, openingFloat: amount, moves: [] }; await call(POS_API.shiftOpen, { opening_float: amount, client_id: s.id }).catch(() => {}); setShift(s); toast.success("Shift opened"); }}
        className="w-full pos-act bg-primary text-primary-foreground border-primary h-11"><Play className="w-4 h-4" /> Open shift</button>
    </div>
  );

  const valid = sales.filter((s) => !s.voided);
  const by = salesByMethod(valid);
  const expected = expectedCash(shift, valid);
  const move = async (kind: CashMove["kind"]) => {
    if (amount <= 0 || !reason.trim()) return toast.error("Enter amount and reason");
    const m: CashMove = { at: new Date().toISOString(), kind, amount, reason };
    await call(POS_API.cashMove(shift.id), m).catch(() => {});
    setShift({ ...shift, moves: [...shift.moves, m] }); setAmount(0); setReason(""); toast.success(kind === "in" ? "Cash added" : "Cash removed");
  };
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-xl bg-muted/40 p-3 space-y-1">
        <Row k={`Opened by ${shift.openedBy}`} v={new Date(shift.openedAt).toLocaleTimeString()} />
        <Row k="Opening float" v={Rs(shift.openingFloat)} />
        <Row k={`Sales (${valid.length})`} v={Rs(valid.reduce((a, s) => a + s.total, 0))} />
        {METHODS.map((m) => <Row key={m.id} k={`  ${m.label}`} v={Rs(by[m.id])} />)}
        {shift.moves.map((m, i) => <Row key={i} k={`Cash ${m.kind} · ${m.reason}`} v={`${m.kind === "in" ? "+" : "−"} ${Rs(m.amount)}`} accent />)}
        <div className="flex justify-between font-black pt-1 border-t border-border"><span>Expected in drawer</span><span className="text-primary">{Rs(expected)}</span></div>
      </div>
      <div className="flex gap-2"><input type="number" className="pos-input w-24 py-1.5" placeholder="Rs" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value) || 0)} /><input className="pos-input py-1.5 flex-1" placeholder="Reason (e.g. bought ice)" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-2"><button onClick={() => move("in")} className="pos-act">Cash in</button><button onClick={() => move("out")} className="pos-act">Cash out</button></div>
      <div className="border-t border-border pt-3 space-y-2">
        <NumField label="Counted cash (Rs)" value={counted} onChange={setCounted} />
        {counted > 0 && <Row k="Difference" v={`${counted - expected >= 0 ? "+" : "−"} ${Rs(Math.abs(counted - expected))}`} accent={counted !== expected} />}
        <button onClick={async () => { if (!window.confirm("Close this shift?")) return; await call(POS_API.shiftClose(shift.id), { counted_cash: counted, expected_cash: expected }).catch(() => {}); setShift(null); toast.success(`Shift closed · difference ${Rs(counted - expected)}`); }}
          className="w-full pos-act h-11 text-destructive border-destructive/50"><Lock className="w-4 h-4" /> Close shift (Z report)</button>
      </div>
    </div>
  );
}

function PrintArea({ receipt, mode }: { receipt: Receipt | null; mode: "receipt" | "kot" }) {
  if (!receipt) return null;
  const head = receipt.type === "dine_in" ? `DINE-IN · ${receipt.table}` : receipt.type === "delivery" ? "DELIVERY" : "TAKEAWAY";
  return (
    <div className="hidden print:block print:w-[72mm] p-2 font-mono text-[11px] leading-tight text-foreground">
      <div className="text-center">
        <div className="text-sm font-black">KENNEDY MOON GRILL</div>
        <div className="font-bold">{mode === "kot" ? "*** KITCHEN TICKET ***" : head}</div>
        {mode === "kot" && <div className="text-base font-black">{head}</div>}
      </div>
      <div className="border-y border-current my-1 py-1">
        {receipt.code !== "KOT" && <div className="text-center text-base font-black">{receipt.code}</div>}
        <div>{receipt.at} · {receipt.cashier}</div>
        {receipt.customer.name && <div>{receipt.customer.name} {receipt.customer.phone}</div>}
        {receipt.type === "delivery" && <div>{receipt.customer.address}</div>}
      </div>
      {receipt.lines.map((l) => (
        <div key={l.key} className="py-0.5">
          <div className="flex justify-between"><span className={mode === "kot" ? "text-sm font-black" : ""}>{l.qty} × {l.name}{l.size !== "Regular" ? ` (${l.size})` : ""}</span>{mode === "receipt" && <span>{l.unitPrice * l.qty}</span>}</div>
          {l.note && <div className="pl-3 font-bold">» {l.note}</div>}
        </div>
      ))}
      {mode === "receipt" && (
        <div className="border-t border-current mt-1 pt-1 space-y-0.5">
          <div className="flex justify-between"><span>Subtotal</span><span>{receipt.totals.subtotal}</span></div>
          {receipt.totals.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{receipt.totals.discount}</span></div>}
          {receipt.totals.service > 0 && <div className="flex justify-between"><span>Service</span><span>{receipt.totals.service}</span></div>}
          {receipt.totals.tax > 0 && <div className="flex justify-between"><span>Tax</span><span>{receipt.totals.tax}</span></div>}
          {receipt.totals.deliveryFee > 0 && <div className="flex justify-between"><span>Delivery</span><span>{receipt.totals.deliveryFee}</span></div>}
          <div className="flex justify-between text-sm font-black border-t border-dashed border-current pt-1"><span>TOTAL</span><span>Rs {receipt.totals.total}</span></div>
          {receipt.payments.map((p, i) => <div key={i} className="flex justify-between"><span>{p.method.toUpperCase()}{p.ref ? ` ${p.ref}` : ""}</span><span>{p.amount}</span></div>)}
          {receipt.tendered > 0 && <div className="flex justify-between"><span>Cash given</span><span>{receipt.tendered}</span></div>}
          {receipt.change > 0 && <div className="flex justify-between font-black"><span>CHANGE</span><span>{receipt.change}</span></div>}
          <div className="text-center pt-2">Thank you! Track: /track/{receipt.code}</div>
        </div>
      )}
    </div>
  );
}
