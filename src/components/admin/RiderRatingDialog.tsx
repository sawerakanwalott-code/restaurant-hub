import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, X, Check, Loader2, Bike } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { syncLiveBackendData } from "@/lib/admin-store";

interface RiderRatingDialogProps {
  open: boolean;
  orderId: string | number;
  orderCode: string;
  riderName?: string;
  currentRating?: number | null;
  onClose: () => void;
}

export function RiderRatingDialog({
  open,
  orderId,
  orderCode,
  riderName,
  currentRating,
  onClose,
}: RiderRatingDialogProps) {
  const [rating, setRating] = useState<number>(currentRating || 5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/orders/${orderId}/rate/`, {
        rating,
        notes: notes.trim(),
      });
      toast.success("Rider Rating Submitted", {
        description: `Order ${orderCode} (${riderName || "Rider"}) rated ${rating}★ successfully.`,
      });
      await syncLiveBackendData();
      onClose();
    } catch (err) {
      toast.error("Could not save rating", {
        description: err instanceof Error ? err.message : "Error saving rating.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="relative z-10 w-full max-w-md rounded-3xl border border-lux/30 bg-[#161413] p-6 text-cream shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lux/20 text-lux border border-lux/40">
                  <Bike className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-hero text-lg font-bold text-lux">Rate Rider & Delivery</h3>
                  <p className="text-xs text-cream/60">
                    Order {orderCode} · {riderName || "Assigned Rider"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-cream/50 hover:bg-white/10 hover:text-cream transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="text-center">
                <label className="block text-[11px] font-black uppercase tracking-[0.18em] text-lux mb-2">
                  Performance Evaluation
                </label>
                <div className="flex items-center justify-center gap-2 py-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (hoverRating ?? rating) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(null)}
                        className="p-1 transition-transform hover:scale-125 focus:outline-none"
                      >
                        <Star
                          className={`h-8 w-8 ${
                            active
                              ? "fill-lux text-lux drop-shadow-[0_0_8px_rgba(230,175,46,0.6)]"
                              : "text-white/20"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs font-bold text-lux">
                  {rating === 5
                    ? "⭐⭐⭐⭐⭐ Exceptional Service"
                    : rating === 4
                    ? "⭐⭐⭐⭐ Very Good Delivery"
                    : rating === 3
                    ? "⭐⭐⭐ Average On-time Delivery"
                    : rating === 2
                    ? "⭐⭐ Delayed / Needs Improvement"
                    : "⭐ Poor Rider Performance"}
                </span>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-cream/60 mb-1">
                  Staff Evaluation Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Prompt customer handover, polite behavior, clean insulated bag"
                  className="w-full rounded-xl border border-white/10 bg-black/40 p-2.5 text-xs text-cream placeholder:text-cream/30 focus:border-lux focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/20 px-3.5 py-2 font-display text-xs font-black uppercase tracking-wider text-cream/70 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-xl border border-lux/40 bg-gradient-to-r from-lux to-[#C99218] px-5 py-2 font-display text-xs font-black uppercase tracking-wider text-charcoal shadow-sm hover:brightness-110 active:scale-95 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {submitting ? "Saving…" : "Save Rating"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
