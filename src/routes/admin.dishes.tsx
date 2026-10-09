import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  UtensilsCrossed,
  Plus,
  Search,
  Check,
  X,
  Edit2,
  Trash2,
  Sparkles,
  Flame,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { invalidateMenuCache } from "@/lib/menu";
import { Field, LuxSearch, Panel, fieldClass } from "@/components/admin/bits";

export const Route = createFileRoute("/admin/dishes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Menu Management — Kennedy Moon Grill" },
      { name: "description", content: "Manage Kennedy Moon Grill dishes, prices, availability and chef specials." },
      { property: "og:title", content: "Menu Management — Kennedy Moon Grill" },
      { property: "og:description", content: "Kennedy Moon Grill menu operations and dish catalogue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DishesManagementPage,
});

interface DishSize {
  id?: number;
  size: string;
  price: number;
}

interface DishItem {
  id: number;
  name: string;
  slug?: string;
  category_name?: string;
  category?: number | { id: number; name: string };
  price: number;
  image_url?: string;
  description?: string;
  is_available: boolean;
  is_featured?: boolean;
  is_archived?: boolean;
  heat_level?: string;
  prep_time_minutes?: number;
  sizes?: DishSize[];
}

/** Counts metric values up on mount for the dashboard-style tiles. */
function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 750;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{n}</>;
}

function DishesManagementPage() {
  const reduce = useReducedMotion();
  const [dishes, setDishes] = useState<DishItem[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string; slug: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available" | "unavailable">("all");

  // Edit / Create Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<DishItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState(1200);
  const [formCategory, setFormCategory] = useState<number | "">("");
  const [formDesc, setFormDesc] = useState("");
  const [formImage, setFormImage] = useState("");
  const [formAvailable, setFormAvailable] = useState(true);
  const [formFeatured, setFormFeatured] = useState(false);
  const [formHeat, setFormHeat] = useState("Mild");
  const [formPrepTime, setFormPrepTime] = useState(25);
  const [saving, setSaving] = useState(false);

  // Load dishes and categories
  const loadData = async () => {
    try {
      setLoading(true);
      const [dishRes, catRes] = await Promise.all([
        api.get<any[]>("/admin/menu/dishes/").catch(() => api.get<any[]>("/menu/dishes/")),
        api.get<any[]>("/admin/menu/categories/").catch(() => api.get<any[]>("/menu/categories/")).catch(() => []),
      ]);

      let loadedCategories: { id: number; name: string; slug: string }[] = [];
      if (Array.isArray(catRes) && catRes.length > 0) {
        loadedCategories = catRes.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug || c.name.toLowerCase().replace(/\s+/g, "-"),
        }));
        setCategories(loadedCategories);
      }

      if (Array.isArray(dishRes)) {
        setDishes(
          dishRes.map((d) => ({
            id: d.id,
            name: d.name,
            slug: d.slug,
            category_name: typeof d.category === "object" ? d.category?.name : d.category_name || "Mains",
            category: typeof d.category === "object" ? d.category?.id : d.category,
            price: Number(d.base_price ?? d.price) || 0,
            image_url: d.image_url || d.image,
            description: d.description || d.desc || "",
            is_available: d.is_available ?? true,
            is_featured: d.is_featured ?? false,
            heat_level: d.heat_label || d.heat_level || d.heat || "Medium",
            prep_time_minutes: d.prep_time_minutes || d.time || 25,
            sizes: d.sizes?.map((s: any) => ({
              id: s.id,
              size: s.size,
              price: Number(s.price),
            })) || [],
          }))
        );
      }
    } catch (err) {
      toast.error("Failed to load menu dishes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Quick toggle availability (In stock vs Sold Out)
  const toggleAvailability = async (dish: DishItem) => {
    const nextState = !dish.is_available;
    // Optimistic update
    setDishes((prev) =>
      prev.map((d) => (d.id === dish.id ? { ...d, is_available: nextState } : d))
    );

    try {
      await api.patch(`/admin/menu/dishes/${dish.id}/`, {
        is_available: nextState,
      });
      invalidateMenuCache();
      toast.success(
        nextState ? `"${dish.name}" is now Available` : `"${dish.name}" marked as Sold Out`,
        {
          description: nextState
            ? "Customers can now order this dish."
            : "Customers will see this dish as unavailable on the menu.",
        }
      );
    } catch {
      // Revert on error
      setDishes((prev) =>
        prev.map((d) => (d.id === dish.id ? { ...d, is_available: !nextState } : d))
      );
      toast.error("Could not update dish availability");
    }
  };

  // Open modal for new dish or edit
  const openEditModal = (dish?: DishItem) => {
    const defaultCatId = categories[0]?.id || "";
    if (dish) {
      const catId = typeof dish.category === "object" ? (dish.category as any)?.id : dish.category;
      setEditingDish(dish);
      setFormName(dish.name);
      setFormPrice(dish.price);
      setFormCategory(catId || defaultCatId);
      setFormDesc(dish.description || "");
      setFormImage(dish.image_url || "");
      setFormAvailable(dish.is_available);
      setFormFeatured(dish.is_featured || false);
      setFormHeat(dish.heat_level || "Medium");
      setFormPrepTime(dish.prep_time_minutes || 25);
    } else {
      setEditingDish(null);
      setFormName("");
      setFormPrice(1200);
      setFormCategory(defaultCatId);
      setFormDesc("");
      setFormImage("");
      setFormAvailable(true);
      setFormFeatured(false);
      setFormHeat("Medium");
      setFormPrepTime(25);
    }
    setModalOpen(true);
  };

  const handleSaveDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Dish name is required");
      return;
    }

    setSaving(true);
    const resolvedCat = formCategory !== "" ? Number(formCategory) : (categories[0]?.id || 1);
    const payload: Record<string, any> = {
      name: formName.trim(),
      base_price: Number(formPrice) || 1200,
      price: Number(formPrice) || 1200,
      category: resolvedCat,
      category_id: resolvedCat,
      description: formDesc.trim(),
      image_url: formImage.trim(),
      is_available: formAvailable,
      is_featured: formFeatured,
      heat_label: formHeat,
      heat_level: formHeat,
      prep_time_minutes: Number(formPrepTime) || 25,
    };

    try {
      if (editingDish) {
        await api.patch(`/admin/menu/dishes/${editingDish.id}/`, payload);
        toast.success(`Dish "${formName}" Updated!`);
      } else {
        await api.post("/admin/menu/dishes/", payload);
        toast.success(`Dish "${formName}" Created!`);
      }
      invalidateMenuCache();
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      const errDetail = err?.data ? JSON.stringify(err.data) : (err instanceof Error ? err.message : "Error saving dish.");
      toast.error("Failed to save dish", {
        description: errDetail,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveDish = async (dish: DishItem) => {
    if (!window.confirm(`Are you sure you want to remove "${dish.name}" from the active menu?`)) {
      return;
    }

    try {
      await api.delete(`/admin/menu/dishes/${dish.id}/`);
      invalidateMenuCache();
      setDishes((prev) => prev.filter((d) => d.id !== dish.id));
      toast.success(`Dish "${dish.name}" archived`);
    } catch {
      toast.error("Failed to archive dish");
    }
  };

  // Filtered rows
  const filteredDishes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return dishes.filter((d) => {
      const matchSearch =
        !term ||
        d.name.toLowerCase().includes(term) ||
        (d.category_name && d.category_name.toLowerCase().includes(term));
      const matchCategory =
        categoryFilter === "all" ||
        d.category_name?.toLowerCase() === categoryFilter.toLowerCase();
      const matchAvailability =
        availabilityFilter === "all" ||
        (availabilityFilter === "available" && d.is_available) ||
        (availabilityFilter === "unavailable" && !d.is_available);
      return matchSearch && matchCategory && matchAvailability;
    });
  }, [dishes, search, categoryFilter, availabilityFilter]);

  const totalCount = dishes.length;
  const availableCount = dishes.filter((d) => d.is_available).length;
  const soldOutCount = totalCount - availableCount;
  const featuredCount = dishes.filter((d) => d.is_featured).length;

  return (
    <div className="admin-dishes space-y-6">
      {/* Page Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-lux/70">
            Menu Operations
          </p>
          <h1 className="mt-1 font-hero text-3xl tracking-wide sm:text-4xl text-lux">
            Dishes & Culinary Catalogue
          </h1>
          <p className="mt-1 text-sm text-slate-dim">
            Control live menu pricing, sizing variants, and toggle in-stock availability instantly.
          </p>
        </div>

        <Button variant="ghost"
          type="button"
          onClick={() => openEditModal()}
          className="admin-dishes__add"
        >
          <Plus className="h-4 w-4" /> Add New Dish
        </Button>
      </header>

      {/* Metric Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            { label: "Total Dishes", value: totalCount, icon: UtensilsCrossed, cls: "text-lux", chip: "bg-lux/10 text-lux border-lux/25", ruby: false },
            { label: "Available (In Stock)", value: availableCount, icon: Check, cls: "text-jade", chip: "bg-jade/10 text-jade border-jade/25", ruby: false },
            { label: "Sold Out (Off Menu)", value: soldOutCount, icon: EyeOff, cls: "text-ruby", chip: "bg-ruby/10 text-ruby border-ruby/25", ruby: true },
            { label: "Chef Specials", value: featuredCount, icon: Sparkles, cls: "text-lux", chip: "bg-lux/10 text-lux border-lux/25", ruby: false },
          ] as const
        ).map((t, i) => (
          <motion.div
            key={t.label}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
            className="admin-dishes__metric"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="block truncate text-[10px] font-black uppercase tracking-[0.16em] text-slate-dim">
                  {t.label}
                </span>
                <span className={`mt-1 block font-hero num-lux text-3xl font-black leading-none ${t.cls}`}>
                  <CountUp value={t.value} />
                </span>
              </div>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${t.chip}`}>
                <t.icon className="h-4 w-4" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filter / Search Bar */}
      <Panel bodyClassName="p-4">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <Field label="Search Dishes">
            <LuxSearch
              value={search}
              onChange={setSearch}
              placeholder="Search by dish name or category"
              ariaLabel="Search dishes"
            />
          </Field>

          <Field label="Category Filter">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={fieldClass}
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status Filter">
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value as any)}
              className={fieldClass}
            >
              <option value="all">All Dishes</option>
              <option value="available">Available (In Stock)</option>
              <option value="unavailable">Sold Out (Unavailable)</option>
            </select>
          </Field>
        </div>
      </Panel>

      {/* Dish Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-lux">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : filteredDishes.length === 0 ? (
        <Panel bodyClassName="p-12 text-center">
          <UtensilsCrossed className="mx-auto h-10 w-10 text-lux/40" />
          <h3 className="mt-3 text-sm font-bold text-frost">No dishes match your filters</h3>
          <p className="mt-1 text-xs text-slate-dim">
            Try adjusting your search query or reset the category filters.
          </p>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDishes.map((dish, i) => (
            <motion.article
              key={dish.id}
              layout={reduce ? false : "position"}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                opacity: { duration: 0.25, delay: Math.min(i, 5) * 0.035 },
                y: { duration: 0.35, delay: Math.min(i, 5) * 0.035, ease: [0.22, 1, 0.36, 1] },
                layout: { duration: reduce ? 0 : 0.25 },
              }}
              className={`admin-dishes__card group relative flex flex-col overflow-hidden ${dish.is_available ? "" : "admin-dishes__card--sold"}`}
            >
              {/* Dish Top Image & Badges */}
              <div className="admin-dishes__media relative h-44 w-full overflow-hidden">
                {dish.image_url ? (
                  <img
                    src={dish.image_url}
                    alt={dish.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-panel-soft text-mist">
                    <UtensilsCrossed className="h-12 w-12" />
                  </div>
                )}
                <div className="admin-dishes__image-shade absolute inset-0" />

                {/* Badges */}
                <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-lux/40 bg-ink-deep/90 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-lux backdrop-blur-md">
                    {dish.category_name || "Mains"}
                  </span>
                  {dish.is_featured && (
                    <span className="flex items-center gap-1 rounded-full border border-lux/40 bg-lux/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-lux backdrop-blur-md">
                      <Sparkles className="h-3 w-3" /> Special
                    </span>
                  )}
                </div>

                {/* Quick Availability Badge */}
                <div className="absolute top-3 right-3">
                  <Button variant="ghost"
                    type="button"
                    onClick={() => toggleAvailability(dish)}
                    title={dish.is_available ? "Click to mark as Sold Out" : "Click to mark as Available"}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider shadow-lg backdrop-blur-md transition ${
                      dish.is_available
                        ? "border border-jade/40 bg-ink-deep/90 text-jade hover:bg-panel-soft"
                        : "border border-ruby/50 bg-ruby/30 text-ruby hover:bg-ruby/40"
                    }`}
                  >
                    {dish.is_available ? (
                      <>
                        <Check className="h-3 w-3" /> In Stock
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3 w-3" /> Sold Out
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div>
                  <h3 className="admin-dishes__name text-lg font-bold leading-snug text-frost">
                    {dish.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-dim">
                    {dish.description || "Authentic specialty cooked over charcoal flame."}
                  </p>
                </div>

                {/* Heat & Time attribute chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-flame/30 bg-flame/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-flame">
                    <Flame className="h-3 w-3" /> {dish.heat_level}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-lux/25 bg-lux/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-lux">
                    <Clock className="h-3 w-3" /> {dish.prep_time_minutes} min
                  </span>
                </div>

                {/* Sizing & Pricing breakdown */}
                <div className="admin-dishes__price mt-auto py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-dim">
                      Base Price
                    </span>
                    <span className="font-hero num-lux text-lg font-black text-lux">
                      Rs {dish.price}
                    </span>
                  </div>
                  {dish.sizes && dish.sizes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 border-t border-white/10 pt-2">
                      {dish.sizes.map((s, idx) => (
                        <span
                          key={idx}
                          className="rounded-lg bg-white/5 px-2 py-0.5 text-[10px] font-mono text-cream/70"
                        >
                          {s.size}: <strong className="text-lux">Rs {s.price}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="admin-dishes__actions flex flex-wrap items-center justify-between gap-2 pt-3">
                  <Button variant="ghost"
                    type="button"
                    onClick={() => toggleAvailability(dish)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-cream/70 transition hover:border-lux/40 hover:text-lux active:scale-95"
                  >
                    {dish.is_available ? "Set Sold Out" : "Set Available"}
                  </Button>

                  <div className="flex items-center gap-1.5">
                    <Button variant="ghost"
                      type="button"
                      onClick={() => openEditModal(dish)}
                      className="rounded-xl border border-lux/25 bg-lux/5 p-2 text-lux transition hover:bg-lux/15 active:scale-90"
                      title="Edit dish"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost"
                      type="button"
                      onClick={() => handleArchiveDish(dish)}
                      className="rounded-xl border border-ruby/30 bg-ruby/5 p-2 text-ruby transition hover:bg-ruby/15 active:scale-90"
                      title="Archive dish"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      {/* Edit / Create Dish Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: 8 }}
              transition={{ duration: reduce ? 0 : 0.22 }}
              className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-lux/30 bg-[#161413] p-6 text-cream shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lux/20 text-lux border border-lux/30">
                    <UtensilsCrossed className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-hero text-lg font-bold text-lux">
                      {editingDish ? `Edit: ${editingDish.name}` : "Add New Dish"}
                    </h2>
                    <p className="text-xs text-cream/60">
                      Configure dish pricing, availability, and description.
                    </p>
                  </div>
                </div>
                <Button variant="ghost"
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-full p-1.5 text-cream/50 hover:bg-white/10 hover:text-cream"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <form onSubmit={handleSaveDish} className="mt-5 space-y-4">
                {/* Section: Dish identity */}
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <UtensilsCrossed className="h-3.5 w-3.5 text-lux" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-lux">
                      Dish Identity
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-cream/60">
                        Dish Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g. Mutton Shinwari Karahi"
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-cream placeholder:text-cream/30 focus:border-lux focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-cream/60">
                        Category
                      </label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(Number(e.target.value) || "")}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-cream focus:border-lux focus:outline-none"
                      >
                        <option value="">Select Category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section: Pricing & Kitchen */}
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Flame className="h-3.5 w-3.5 text-flame" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-lux">
                      Pricing &amp; Kitchen
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-cream/60">
                        Base Price (PKR)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={formPrice}
                        onChange={(e) => setFormPrice(Number(e.target.value) || 0)}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-cream focus:border-lux focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-cream/60">
                        Heat Level
                      </label>
                      <select
                        value={formHeat}
                        onChange={(e) => setFormHeat(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-cream focus:border-lux focus:outline-none"
                      >
                        <option value="Mild">Mild</option>
                        <option value="Medium">Medium</option>
                        <option value="Hot">Hot</option>
                        <option value="Extra Hot">Extra Hot</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-cream/60">
                        Prep Time (min)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={120}
                        value={formPrepTime}
                        onChange={(e) => setFormPrepTime(Number(e.target.value) || 25)}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-cream focus:border-lux focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Section: Presentation */}
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-lux" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-lux">
                      Presentation
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-cream/60">
                        Image URL
                      </label>
                      <input
                        type="url"
                        value={formImage}
                        onChange={(e) => setFormImage(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-cream placeholder:text-cream/30 focus:border-lux focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-cream/60">
                        Description
                      </label>
                      <textarea
                        rows={2}
                        value={formDesc}
                        onChange={(e) => setFormDesc(e.target.value)}
                        placeholder="Authentic charcoal-cooked karahi with black pepper and fresh green chilies."
                        className="w-full rounded-xl border border-white/10 bg-black/40 p-2.5 text-xs text-cream placeholder:text-cream/30 focus:border-lux focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Availability switches */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button variant="ghost"
                    type="button"
                    onClick={() => setFormAvailable(!formAvailable)}
                    className={`inline-flex items-center gap-2.5 rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-wider transition active:scale-95 ${
                      formAvailable
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                        : "border-white/10 bg-black/40 text-cream/50 hover:border-white/20"
                    }`}
                  >
                    <span className={`relative h-3.5 w-6 rounded-full transition-colors ${formAvailable ? "bg-emerald-500/70" : "bg-white/15"}`}>
                      <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-cream shadow transition-all ${formAvailable ? "left-3" : "left-0.5"}`} />
                    </span>
                    {formAvailable ? "Available · In Stock" : "Sold Out"}
                  </Button>

                  <Button variant="ghost"
                    type="button"
                    onClick={() => setFormFeatured(!formFeatured)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-wider transition active:scale-95 ${
                      formFeatured
                        ? "border-lux/50 bg-lux/15 text-lux"
                        : "border-white/10 bg-black/40 text-cream/50 hover:border-lux/30"
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {formFeatured ? "Chef Special · Featured" : "Mark as Chef Special"}
                  </Button>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
                  <Button variant="ghost"
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-xl border border-white/20 px-4 py-2.5 font-display text-xs font-black uppercase tracking-[0.14em] text-cream/70 transition hover:bg-white/10 active:scale-95"
                  >
                    Cancel
                  </Button>
                  <Button variant="ghost"
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-xl border border-lux/40 bg-gradient-to-r from-flame to-[#D94824] px-6 py-2.5 font-display text-xs font-black uppercase tracking-[0.16em] text-cream shadow-[0_8px_24px_rgba(184,42,20,0.4)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {saving ? "Saving…" : editingDish ? "Save Changes" : "Create Dish"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
