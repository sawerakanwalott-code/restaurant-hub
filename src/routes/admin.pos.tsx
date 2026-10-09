import { useEffect, useState, useMemo, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  CheckCircle2,
  UtensilsCrossed,
  ShoppingBag,
  Store,
  DollarSign,
  User,
  Phone,
  Layers,
  ArrowRight,
  RotateCcw,
  Sparkles,
  CreditCard,
  QrCode,
  Tag,
  Hash,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api/client";
import { MENU, ORDERS } from "@/lib/api/endpoints";
import { readAccount } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { ADMIN_ROLES } from "@/lib/roles";
import { DISHES, type Dish } from "@/lib/menu";
import { syncLiveBackendData } from "@/lib/admin-store";

export const Route = createFileRoute("/admin/pos")({
  beforeLoad: requireRole(ADMIN_ROLES),
  head: () => ({
    meta: [{ title: "Counter POS — Kennedy Moon Grill" }],
  }),
  component: CounterPOSPage,
});

type CartItem = {
  dish: Dish;
  size: string;
  unitPrice: number;
  qty: number;
};

type CreatedOrderReceipt = {
  order_code: string;
  created_at: string;
  order_type: "takeaway" | "dine_in";
  items: { name: string; size: string; qty: number; unitPrice: number; total: number }[];
  subtotal: number;
  discount: number;
  total: number;
  cashTendered: number;
  changeDue: number;
  cashierName: string;
  customerName: string;
  customerPhone: string;
  tableNumber: string;
  paymentMethod: string;
};

// Web Audio API Cash Register Sound
function playCashChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    // Dual-tone register bell
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(987.77, now); // B5
    osc1.frequency.exponentialRampToValueAtTime(1318.51, now + 0.1); // E6

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(1318.51, now);
    osc2.frequency.exponentialRampToValueAtTime(1975.53, now + 0.15); // B6

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.4);
    osc2.stop(now + 0.4);
  } catch {
    // Audio context silently ignored if user hasn't interacted
  }
}

export function CounterPOSPage() {
  const account = readAccount();
  const cashierName = account?.name || "Cashier";

  const [dishes, setDishes] = useState<Dish[]>(DISHES);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [orderType, setOrderType] = useState<"takeaway" | "dine_in">("takeaway");
  const [tableNumber, setTableNumber] = useState("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "jazzcash">("cod");
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [cashTendered, setCashTendered] = useState<number>(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<CreatedOrderReceipt | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Load live dishes from backend if configured
  useEffect(() => {
    let mounted = true;
    api
      .get<Dish[]>(MENU.dishes)
      .then((data) => {
        if (mounted && Array.isArray(data) && data.length > 0) {
          setDishes(data);
        }
      })
      .catch(() => {
        // Fallback to static DISHES
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    dishes.forEach((d) => {
      if (d.categoryName) set.add(d.categoryName);
    });
    return ["all", ...Array.from(set)];
  }, [dishes]);

  // Filtered dishes
  const filteredDishes = useMemo(() => {
    return dishes.filter((dish) => {
      const matchCat = activeCategory === "all" || dish.categoryName === activeCategory;
      const matchQuery =
        !searchQuery.trim() ||
        dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dish.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dish.tag?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [dishes, activeCategory, searchQuery]);

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.unitPrice * item.qty, 0);
  }, [cart]);

  const netTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const changeDue = useMemo(() => {
    if (paymentMethod !== "cod" || cashTendered <= 0) return 0;
    return Math.max(0, cashTendered - netTotal);
  }, [paymentMethod, cashTendered, netTotal]);

  // Add item to cart
  const handleAddToCart = (dish: Dish, sizeName = "Regular", priceOverride?: number) => {
    const price = priceOverride ?? (parseFloat(String(dish.price).replace(/[^0-9.]/g, "")) || 0);
    setCart((prev) => {
      const existing = prev.find((item) => item.dish.id === dish.id && item.size === sizeName);
      if (existing) {
        return prev.map((item) =>
          item.dish.id === dish.id && item.size === sizeName ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { dish, size: sizeName, unitPrice: price, qty: 1 }];
    });
  };

  const handleUpdateQty = (index: number, delta: number) => {
    setCart((prev) => {
      const copy = [...prev];
      const item = copy[index];
      if (!item) return prev;
      const newQty = item.qty + delta;
      if (newQty <= 0) {
        copy.splice(index, 1);
      } else {
        copy[index] = { ...item, qty: newQty };
      }
      return copy;
    });
  };

  const handleClearCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setCashTendered(0);
    setCustomerName("");
    setCustomerPhone("");
    setTableNumber("");
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handlePunchOrder = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty! Select at least one dish.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        order_type: orderType,
        source: "pos",
        status: "confirmed", // POS counter orders are confirmed immediately
        payment: paymentMethod,
        customer_name: customerName.trim() || "Walk-in Guest",
        customer_phone: customerPhone.trim(),
        delivery_address: orderType === "dine_in" ? `Dine-In Table ${tableNumber || "General"}` : "Counter Takeaway",
        table_number: tableNumber.trim(),
        discount: discountAmount,
        items: cart.map((item) => ({
          dish_id: item.dish.id,
          size: item.size,
          qty: item.qty,
          price: item.unitPrice,
        })),
      };

      const res = await api.post<any>(ORDERS.create, payload);
      playCashChime();

      const orderCode = res?.order_code || `MG-${Math.floor(100000 + Math.random() * 900000)}`;

      const receiptData: CreatedOrderReceipt = {
        order_code: orderCode,
        created_at: new Date().toLocaleString(),
        order_type: orderType,
        items: cart.map((i) => ({
          name: i.dish.name,
          size: i.size,
          qty: i.qty,
          unitPrice: i.unitPrice,
          total: i.unitPrice * i.qty,
        })),
        subtotal,
        discount: discountAmount,
        total: netTotal,
        cashTendered: cashTendered || netTotal,
        changeDue,
        cashierName,
        customerName: customerName.trim() || "Walk-in Guest",
        customerPhone: customerPhone.trim(),
        tableNumber: tableNumber.trim(),
        paymentMethod: paymentMethod === "cod" ? "CASH" : "JAZZCASH",
      };

      setLastReceipt(receiptData);
      setShowReceiptModal(true);
      toast.success(`Order #${orderCode} punched successfully!`);

      // Refresh admin store
      syncLiveBackendData().catch(() => {});
      handleClearCart();
    } catch (err: any) {
      toast.error(err?.message || "Failed to punch order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* ── 80mm THERMAL RECEIPT PRINT AREA (Active ONLY on @media print) ── */}
      <div id="thermal-receipt" className="hidden print:block print:w-[72mm] print:m-0 print:p-2 font-mono text-black text-xs leading-tight">
        {lastReceipt && (
          <div className="space-y-1">
            <div className="text-center">
              <div className="text-sm font-black tracking-wider uppercase">KENNEDY MOON GRILL</div>
              <div className="text-[10px]">Narowal Branch • Phone: 0300-1234567</div>
              <div className="text-[10px] uppercase font-bold text-gray-800">
                *** {lastReceipt.order_type === "takeaway" ? "TAKEAWAY ORDER" : `DINE-IN - TABLE ${lastReceipt.tableNumber || "1"}`} ***
              </div>
            </div>

            <div className="border-t border-b border-black py-1 my-1">
              <div className="text-base font-black text-center tracking-widest">{lastReceipt.order_code}</div>
              <div className="flex justify-between text-[10px]">
                <span>Date: {lastReceipt.created_at}</span>
                <span>By: {lastReceipt.cashierName}</span>
              </div>
              {lastReceipt.customerPhone && (
                <div className="text-[10px]">
                  Cust: {lastReceipt.customerName} ({lastReceipt.customerPhone})
                </div>
              )}
            </div>

            <div className="border-b border-black pb-1">
              <div className="flex justify-between font-bold text-[10px] pb-0.5">
                <span>ITEM</span>
                <span>QTY x PRICE</span>
                <span>TOTAL</span>
              </div>
              {lastReceipt.items.map((it, idx) => (
                <div key={idx} className="flex justify-between text-[11px] py-0.5">
                  <div className="max-w-[42mm] truncate">
                    {it.name} {it.size !== "Regular" ? `(${it.size})` : ""}
                  </div>
                  <div>
                    {it.qty} x {it.unitPrice}
                  </div>
                  <div className="font-bold">{it.total}</div>
                </div>
              ))}
            </div>

            <div className="pt-1 space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>Rs. {lastReceipt.subtotal}</span>
              </div>
              {lastReceipt.discount > 0 && (
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>- Rs. {lastReceipt.discount}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Delivery Fee:</span>
                <span>Rs. 0 (Free POS)</span>
              </div>
              <div className="flex justify-between text-sm font-black pt-1 border-t border-dashed border-black">
                <span>NET TOTAL:</span>
                <span>Rs. {lastReceipt.total}</span>
              </div>
              <div className="flex justify-between text-[10px] pt-0.5">
                <span>Paid via: {lastReceipt.paymentMethod}</span>
                <span>Tendered: Rs. {lastReceipt.cashTendered}</span>
              </div>
              {lastReceipt.changeDue > 0 && (
                <div className="flex justify-between text-[11px] font-bold">
                  <span>CHANGE DUE:</span>
                  <span>Rs. {lastReceipt.changeDue}</span>
                </div>
              )}
            </div>

            <div className="text-center pt-2 border-t border-black text-[9px] space-y-0.5">
              <div>KITCHEN & BAG STAPLE COPY</div>
              <div>
                Track: {typeof window !== "undefined" ? `${window.location.origin}/track/${lastReceipt.order_code}` : `https://kennedy.pk/track/${lastReceipt.order_code}`}
              </div>
              <div>Thank You for Choosing Moon Grill!</div>
            </div>
          </div>
        )}
      </div>

      {/* ── SCREEN VIEW: Counter POS Dual Pane ── */}
      <div className="print:hidden h-[calc(100vh-4rem)] flex flex-col md:flex-row overflow-hidden bg-background">
        {/* LEFT COLUMN: Dish Catalog & Quick Tap (65%) */}
        <div className="flex-1 flex flex-col border-r border-border/80 overflow-hidden">
          {/* Top Bar: Search & Category Pills */}
          <div className="p-3 border-b border-border/60 bg-card/60 backdrop-blur space-y-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Quick search dishes by name or tag (Alt+S)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-muted/40 border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap capitalize transition ${
                    activeCategory === cat
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40"
                  }`}
                >
                  {cat === "all" ? "All Items" : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Dish Grid */}
          <div className="flex-1 p-3 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 content-start">
            {filteredDishes.map((dish) => (
              <motion.button
                key={dish.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleAddToCart(dish)}
                className="flex flex-col text-left p-3 rounded-xl border border-border/80 bg-card hover:border-primary/50 hover:shadow-sm transition group relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <span className="font-bold text-sm text-foreground group-hover:text-primary transition line-clamp-1">
                    {dish.name}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    +{dish.time || "15m"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-1 mb-2">
                  {dish.desc || dish.categoryName || "Freshly cooked"}
                </p>
                <div className="mt-auto flex items-center justify-between pt-1 border-t border-border/40">
                  <span className="text-xs font-black text-foreground">Rs. {Number(dish.price).toLocaleString()}</span>
                  <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: POS Register Cart & Checkout (35%) */}
        <div className="w-full md:w-[420px] lg:w-[460px] flex flex-col bg-card/40 overflow-hidden">
          {/* Header & Order Type Switcher */}
          <div className="p-3.5 border-b border-border/80 bg-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-primary" />
                <span className="font-bold text-sm text-foreground">Counter Register</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Cashier: <strong className="text-foreground">{cashierName}</strong>
              </span>
            </div>

            {/* Takeaway vs Dine-In Selector */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/60">
              <button
                onClick={() => setOrderType("takeaway")}
                className={`py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
                  orderType === "takeaway"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5 text-primary" /> Takeaway (0 Fee)
              </button>
              <button
                onClick={() => setOrderType("dine_in")}
                className={`py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
                  orderType === "dine_in"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5 text-primary" /> Dine-In
              </button>
            </div>

            {/* Customer & Table Inputs */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cust Name (Opt)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-muted/30 border border-border/80 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="03XXXXXXXXX (WhatsApp)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-muted/30 border border-border/80 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {orderType === "dine_in" && (
              <div className="relative">
                <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Table Number (e.g. Table 4)"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-muted/30 border border-border/80 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
          </div>

          {/* Cart Itemized List */}
          <div className="flex-1 p-3 overflow-y-auto divide-y divide-border/60">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                <ShoppingBag className="w-10 h-10 mb-2 opacity-30" />
                <p className="font-semibold text-sm">Register Cart Empty</p>
                <p className="text-xs max-w-[200px] mt-1">Tap any dish on the left to add items to ticket</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={`${item.dish.id}-${item.size}`} className="py-2 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs text-foreground truncate">{item.dish.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {item.size} • Rs. {item.unitPrice}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleUpdateQty(idx, -1)}
                      className="w-6 h-6 rounded-md bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground transition"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-black w-5 text-center">{item.qty}</span>
                    <button
                      onClick={() => handleUpdateQty(idx, 1)}
                      className="w-6 h-6 rounded-md bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground transition"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <span className="text-xs font-bold text-foreground w-16 text-right">
                    Rs. {(item.unitPrice * item.qty).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Pricing & Checkout Dock */}
          <div className="p-3.5 border-t border-border/80 bg-card space-y-3">
            {/* Quick Discount & Tender Buttons */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Discount:
                </span>
                <div className="flex gap-1">
                  {[0, 50, 100, 200].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDiscountAmount(d)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border transition ${
                        discountAmount === d ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                      }`}
                    >
                      {d === 0 ? "None" : `Rs ${d}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash Quick Tender Selector */}
              {paymentMethod === "cod" && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Cash Given:</span>
                  <div className="flex gap-1">
                    {[netTotal, 500, 1000, 2000, 5000].map((c) => (
                      <button
                        key={c}
                        onClick={() => setCashTendered(c)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition ${
                          cashTendered === c ? "bg-emerald-600 text-white border-emerald-600" : "border-border hover:bg-muted"
                        }`}
                      >
                        {c === netTotal ? "Exact" : c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-1 text-xs pt-1 border-t border-border/60">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span>Rs. {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery Fee:</span>
                <span className="text-emerald-600 font-bold">Rs. 0 (POS)</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Discount Applied:</span>
                  <span>- Rs. {discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-foreground pt-1 border-t border-border/60">
                <span>Net Total:</span>
                <span className="text-primary">Rs. {netTotal.toLocaleString()}</span>
              </div>
              {paymentMethod === "cod" && changeDue > 0 && (
                <div className="flex justify-between text-xs font-bold text-emerald-600 pt-0.5">
                  <span>Change Due to Customer:</span>
                  <span>Rs. {changeDue.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Payment Method Switcher */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentMethod("cod")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  paymentMethod === "cod"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                    : "border-border hover:bg-muted text-foreground"
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" /> Cash Tender
              </button>
              <button
                onClick={() => setPaymentMethod("jazzcash")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  paymentMethod === "jazzcash"
                    ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                    : "border-border hover:bg-muted text-foreground"
                }`}
              >
                <QrCode className="w-3.5 h-3.5" /> JazzCash QR
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleClearCart}
                disabled={cart.length === 0 || isSubmitting}
                className="p-3 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition disabled:opacity-40"
                title="Clear Ticket"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={handlePunchOrder}
                disabled={cart.length === 0 || isSubmitting}
                className="flex-1 py-3 px-4 rounded-xl bg-primary text-primary-foreground font-black text-sm hover:bg-primary/95 active:scale-[0.99] transition shadow-md flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {isSubmitting ? (
                  <span>Punching Order...</span>
                ) : (
                  <>
                    <span>PUNCH & PRINT</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── RECEIPT CONFIRMATION MODAL ── */}
      <AnimatePresence>
        {showReceiptModal && lastReceipt && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            >
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="font-black text-lg text-foreground">Order #{lastReceipt.order_code}</h3>
                <p className="text-xs text-muted-foreground">Punched and sent to kitchen display system</p>
              </div>

              <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 text-xs border border-border/60">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Type:</span>
                  <span className="font-bold uppercase">{lastReceipt.order_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="font-bold text-primary">Rs. {lastReceipt.total}</span>
                </div>
                {lastReceipt.changeDue > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Change Due:</span>
                    <span>Rs. {lastReceipt.changeDue}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handlePrintReceipt}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-primary/90 transition shadow-sm"
                >
                  <Printer className="w-4 h-4" /> Print 80mm KOT
                </button>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="py-2.5 px-4 rounded-xl border border-border hover:bg-muted text-xs font-bold text-foreground transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
