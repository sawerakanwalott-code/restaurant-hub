import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Boxes,
  Plus,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  PackagePlus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
  Loader2,
  TrendingDown,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api/client";
import { Field, LuxSearch, Panel, fieldClass } from "@/components/admin/bits";

export const Route = createFileRoute("/admin/inventory")({
  ssr: false,
  component: InventoryManagementPage,
});

interface InventoryItem {
  id: number;
  name: string;
  unit: string;
  current_stock: number;
  reorder_threshold: number;
  cost_per_unit: number;
  created_at?: string;
  updated_at?: string;
}

function InventoryManagementPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "low" | "out" | "healthy">("all");

  // Adjust Modal state
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedItemForAdjust, setSelectedItemForAdjust] = useState<InventoryItem | null>(null);
  const [adjustType, setAdjustType] = useState<"purchase" | "wastage" | "adjustment">("purchase");
  const [adjustQty, setAdjustQty] = useState<number>(5);
  const [adjustNote, setAdjustNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // New Item Modal state
  const [newItemModalOpen, setNewItemModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("kg");
  const [newStock, setNewStock] = useState<number>(20);
  const [newThreshold, setNewThreshold] = useState<number>(5);
  const [newCost, setNewCost] = useState<number>(350);
  const [creating, setCreating] = useState(false);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const res = await api.get<any[]>("/inventory/");
      if (Array.isArray(res)) {
        setItems(
          res.map((item) => ({
            id: item.id,
            name: item.name,
            unit: item.unit || "kg",
            current_stock: Number(item.current_stock) || 0,
            reorder_threshold: Number(item.reorder_threshold) || 0,
            cost_per_unit: Number(item.cost_per_unit) || 0,
            created_at: item.created_at,
            updated_at: item.updated_at,
          }))
        );
      }
    } catch {
      toast.error("Failed to load inventory provisions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInventory();
  }, []);

  const openQuickAdjust = (item?: InventoryItem, defaultType: "purchase" | "wastage" | "adjustment" = "purchase") => {
    setSelectedItemForAdjust(item || items[0] || null);
    setAdjustType(defaultType);
    setAdjustQty(defaultType === "purchase" ? 10 : 2);
    setAdjustNote("");
    setAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForAdjust) return;

    setAdjusting(true);
    try {
      await api.post("/inventory/adjust/", {
        item_id: selectedItemForAdjust.id,
        type: adjustType,
        quantity: adjustQty,
        note: adjustNote.trim(),
      });

      toast.success(
        adjustType === "purchase"
          ? `Restocked +${adjustQty} ${selectedItemForAdjust.unit} of ${selectedItemForAdjust.name}`
          : adjustType === "wastage"
          ? `Recorded wastage: -${adjustQty} ${selectedItemForAdjust.unit} of ${selectedItemForAdjust.name}`
          : `Stock adjusted for ${selectedItemForAdjust.name}`
      );
      setAdjustModalOpen(false);
      await loadInventory();
    } catch (err) {
      toast.error("Adjustment failed", {
        description: err instanceof Error ? err.message : "Error executing stock adjustment.",
      });
    } finally {
      setAdjusting(false);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error("Item name is required");
      return;
    }

    setCreating(true);
    try {
      await api.post("/inventory/", {
        name: newName.trim(),
        unit: newUnit,
        current_stock: newStock,
        reorder_threshold: newThreshold,
        cost_per_unit: newCost,
      });

      toast.success(`Inventory Item "${newName}" Added!`);
      setNewItemModalOpen(false);
      setNewName("");
      await loadInventory();
    } catch (err) {
      toast.error("Failed to add inventory item", {
        description: err instanceof Error ? err.message : "Error adding item.",
      });
    } finally {
      setCreating(false);
    }
  };

  // Filtered rows
  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchSearch = !term || item.name.toLowerCase().includes(term);
      const isOut = item.current_stock <= 0;
      const isLow = !isOut && item.current_stock <= item.reorder_threshold;
      const isHealthy = item.current_stock > item.reorder_threshold;

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "low" && isLow) ||
        (statusFilter === "out" && isOut) ||
        (statusFilter === "healthy" && isHealthy);

      return matchSearch && matchStatus;
    });
  }, [items, search, statusFilter]);

  const totalItemsCount = items.length;
  const outOfStockCount = items.filter((i) => i.current_stock <= 0).length;
  const lowStockCount = items.filter(
    (i) => i.current_stock > 0 && i.current_stock <= i.reorder_threshold
  ).length;
  const healthyCount = items.filter((i) => i.current_stock > i.reorder_threshold).length;
  const totalValuation = items.reduce(
    (sum, i) => sum + i.current_stock * i.cost_per_unit,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-lux/70">
            Supply & Kitchen Warehouse
          </p>
          <h1 className="mt-1 font-hero text-3xl tracking-wide sm:text-4xl text-lux">
            Inventory & Stock Controls
          </h1>
          <p className="mt-1 text-sm text-slate-dim">
            Butchery meats, charcoal, dairy provisions, and automatic stock deduction monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openQuickAdjust(undefined, "purchase")}
            className="inline-flex items-center gap-2 rounded-full border border-lux/40 bg-lux/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-lux hover:bg-lux/20 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Quick Stock Adjust
          </button>
          <button
            type="button"
            onClick={() => setNewItemModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-lux/40 bg-gradient-to-r from-flame to-[#D94824] px-5 py-2 text-xs font-black uppercase tracking-[0.16em] text-cream shadow-[0_4px_20px_rgba(184,42,20,0.4)] transition hover:brightness-110 active:scale-95"
          >
            <Plus className="h-4 w-4" /> Add Item
          </button>
        </div>
      </header>

      {/* Low Stock Warning Banner if any items low */}
      {lowStockCount + outOfStockCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-cream shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-lux border border-amber-500/40">
              <AlertTriangle className="h-5 w-5 text-lux" />
            </div>
            <div>
              <h4 className="font-hero text-sm font-bold text-lux">
                Inventory Restock Required
              </h4>
              <p className="text-xs text-cream/70">
                {outOfStockCount > 0 && `${outOfStockCount} item(s) are completely out of stock. `}
                {lowStockCount > 0 && `${lowStockCount} item(s) have dropped below their minimum kitchen reorder threshold.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter("low")}
            className="rounded-xl border border-lux/40 bg-lux/20 px-3.5 py-1.5 font-display text-[11px] font-black uppercase tracking-wider text-lux hover:bg-lux/30 transition"
          >
            Filter Low Stock
          </button>
        </motion.div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Panel bodyClassName="p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-dim">
              Warehouse Items
            </span>
            <span className="block font-hero num-lux text-2xl text-frost mt-0.5">{totalItemsCount}</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lux/10 text-lux border border-lux/20">
            <Warehouse className="h-5 w-5" />
          </div>
        </Panel>

        <Panel bodyClassName="p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-dim">
              Healthy Stock
            </span>
            <span className="block font-hero num-lux text-2xl text-emerald-400 mt-0.5">{healthyCount}</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Check className="h-5 w-5" />
          </div>
        </Panel>

        <Panel bodyClassName="p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-dim">
              Low Stock Alerts
            </span>
            <span className="block font-hero num-lux text-2xl text-amber-400 mt-0.5">{lowStockCount}</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <TrendingDown className="h-5 w-5" />
          </div>
        </Panel>

        <Panel bodyClassName="p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-dim">
              Total Stock Valuation
            </span>
            <span className="block font-hero num-lux text-2xl text-lux mt-0.5">
              Rs {Math.round(totalValuation).toLocaleString()}
            </span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lux/10 text-lux border border-lux/20">
            <Boxes className="h-5 w-5" />
          </div>
        </Panel>
      </div>

      {/* Search & Filter Bar */}
      <Panel bodyClassName="p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Search Provisions">
            <LuxSearch
              value={search}
              onChange={setSearch}
              placeholder="Search by ingredient, item, or provision"
              ariaLabel="Search inventory"
            />
          </Field>

          <Field label="Stock Level Filter">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className={fieldClass}
            >
              <option value="all">All Provisions ({totalItemsCount})</option>
              <option value="healthy">Healthy Stock ({healthyCount})</option>
              <option value="low">Low Stock Alerts ({lowStockCount})</option>
              <option value="out">Out of Stock ({outOfStockCount})</option>
            </select>
          </Field>
        </div>
      </Panel>

      {/* Inventory Items List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-lux">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : filteredItems.length === 0 ? (
        <Panel bodyClassName="p-12 text-center">
          <Boxes className="mx-auto h-10 w-10 text-lux/40" />
          <h3 className="mt-3 text-sm font-bold text-frost">No inventory items found</h3>
          <p className="mt-1 text-xs text-slate-dim">
            Try adjusting your search criteria or add a new provision.
          </p>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const isOut = item.current_stock <= 0;
            const isLow = !isOut && item.current_stock <= item.reorder_threshold;
            const valuation = item.current_stock * item.cost_per_unit;

            return (
              <Panel
                key={item.id}
                bodyClassName="p-4 flex flex-col justify-between h-full space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-hero text-base font-bold text-frost">
                        {item.name}
                      </h3>
                      <span className="text-[11px] font-mono text-slate-dim">
                        Unit: <strong className="text-cream">{item.unit}</strong>
                      </span>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        isOut
                          ? "border border-ruby/50 bg-ruby/20 text-ruby"
                          : isLow
                          ? "border border-amber-500/50 bg-amber-500/20 text-amber-300"
                          : "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                      }`}
                    >
                      {isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock"}
                    </span>
                  </div>

                  {/* Stock Gauge */}
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3 space-y-2">
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-dim">
                          Available Quantity
                        </span>
                        <p className="font-hero num-lux text-2xl font-black text-lux">
                          {item.current_stock.toFixed(1)}{" "}
                          <span className="text-xs font-normal text-cream/60">{item.unit}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-dim">
                          Min Alert Level
                        </span>
                        <p className="text-xs font-mono font-bold text-cream/70">
                          {item.reorder_threshold.toFixed(1)} {item.unit}
                        </p>
                      </div>
                    </div>

                    {/* Progress visual */}
                    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isOut ? "w-0 bg-ruby" : isLow ? "w-1/3 bg-amber-400" : "w-full bg-emerald-400"
                        }`}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-cream/60 px-1">
                    <span>Cost / unit: Rs {item.cost_per_unit}</span>
                    <span>Total value: Rs {Math.round(valuation).toLocaleString()}</span>
                  </div>
                </div>

                {/* Quick Stock Action buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => openQuickAdjust(item, "purchase")}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-lux/30 bg-lux/10 py-1.5 font-display text-[11px] font-black uppercase tracking-wider text-lux hover:bg-lux/20 transition"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" /> Restock
                  </button>
                  <button
                    type="button"
                    onClick={() => openQuickAdjust(item, "wastage")}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-ruby/30 bg-ruby/10 py-1.5 font-display text-[11px] font-black uppercase tracking-wider text-ruby hover:bg-ruby/20 transition"
                  >
                    <ArrowDownRight className="h-3.5 w-3.5" /> Waste / Deduct
                  </button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {/* Quick Adjust Modal */}
      <AnimatePresence>
        {adjustModalOpen && selectedItemForAdjust && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAdjustModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative z-10 w-full max-w-md rounded-3xl border border-lux/30 bg-[#161413] p-6 text-cream shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lux/20 text-lux border border-lux/30">
                    <RefreshCw className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-hero text-lg font-bold text-lux">
                      Stock Adjustment
                    </h3>
                    <p className="text-xs text-cream/60">
                      {selectedItemForAdjust.name} (Current: {selectedItemForAdjust.current_stock} {selectedItemForAdjust.unit})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="rounded-full p-1.5 text-cream/50 hover:bg-white/10 hover:text-cream"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAdjustSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-lux mb-1.5">
                    Adjustment Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "purchase", label: "+ Restock" },
                      { id: "wastage", label: "- Spoilage" },
                      { id: "adjustment", label: "Audit Fix" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setAdjustType(t.id as any)}
                        className={`rounded-xl border py-2 text-xs font-black uppercase tracking-wider transition ${
                          adjustType === t.id
                            ? "border-lux bg-lux/20 text-lux shadow-sm"
                            : "border-white/10 bg-black/30 text-cream/60"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-lux mb-1">
                    Quantity ({selectedItemForAdjust.unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min={0.1}
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(Number(e.target.value) || 0)}
                    className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 px-3 text-sm text-cream font-mono font-bold focus:border-lux focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-lux mb-1">
                    Reason / Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                    placeholder="e.g. Received weekly poultry delivery"
                    className="w-full rounded-xl border border-white/10 bg-black/40 py-2 px-3 text-xs text-cream placeholder:text-cream/30 focus:border-lux focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setAdjustModalOpen(false)}
                    className="rounded-xl border border-white/20 px-3.5 py-2 font-display text-xs font-black uppercase tracking-wider text-cream/70 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adjusting}
                    className="flex items-center gap-1.5 rounded-xl border border-lux/40 bg-gradient-to-r from-flame to-[#D94824] px-5 py-2 font-display text-xs font-black uppercase tracking-wider text-cream shadow-sm hover:brightness-110 active:scale-95 disabled:opacity-50"
                  >
                    {adjusting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {adjusting ? "Updating…" : "Apply Adjustment"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add New Item Modal */}
      <AnimatePresence>
        {newItemModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNewItemModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative z-10 w-full max-w-md rounded-3xl border border-lux/30 bg-[#161413] p-6 text-cream shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lux/20 text-lux border border-lux/30">
                    <PackagePlus className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-hero text-lg font-bold text-lux">
                      Add Kitchen Provision
                    </h3>
                    <p className="text-xs text-cream/60">
                      Create new stock item for ingredient and kitchen tracking.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setNewItemModalOpen(false)}
                  className="rounded-full p-1.5 text-cream/50 hover:bg-white/10 hover:text-cream"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateItem} className="mt-4 space-y-4">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-lux mb-1">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Mutton Shinwari Cut"
                    className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 px-3 text-xs text-cream focus:border-lux focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-lux mb-1">
                      Measurement Unit
                    </label>
                    <select
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 px-3 text-xs text-cream focus:border-lux focus:outline-none"
                    >
                      <option value="kg">Kilogram (kg)</option>
                      <option value="g">Gram (g)</option>
                      <option value="pcs">Pieces (pcs)</option>
                      <option value="l">Liter (l)</option>
                      <option value="ml">Milliliter (ml)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-lux mb-1">
                      Initial Stock
                    </label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={newStock}
                      onChange={(e) => setNewStock(Number(e.target.value) || 0)}
                      className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 px-3 text-xs text-cream font-mono focus:border-lux focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-lux mb-1">
                      Reorder Threshold
                    </label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={newThreshold}
                      onChange={(e) => setNewThreshold(Number(e.target.value) || 0)}
                      className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 px-3 text-xs text-cream font-mono focus:border-lux focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-lux mb-1">
                      Cost per Unit (PKR)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newCost}
                      onChange={(e) => setNewCost(Number(e.target.value) || 0)}
                      className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 px-3 text-xs text-cream font-mono focus:border-lux focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setNewItemModalOpen(false)}
                    className="rounded-xl border border-white/20 px-3.5 py-2 font-display text-xs font-black uppercase tracking-wider text-cream/70 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex items-center gap-1.5 rounded-xl border border-lux/40 bg-gradient-to-r from-flame to-[#D94824] px-5 py-2 font-display text-xs font-black uppercase tracking-wider text-cream shadow-sm hover:brightness-110 active:scale-95 disabled:opacity-50"
                  >
                    {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                    {creating ? "Adding…" : "Add Provision"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
