import { AlertTriangle, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OrderBill } from "@/lib/account";

/** 409 insufficient_stock — the kitchen ran out of something in the order. */
export function SoldOutDialog({
  open,
  items,
  onClose,
}: {
  open: boolean;
  items: string[];
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl border-2 border-flame/30 bg-cream">
        <DialogHeader>
          <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full bg-flame/15 text-flame">
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          </div>
          <DialogTitle className="text-center font-display text-2xl font-extrabold uppercase text-charcoal">
            Sold out just now
          </DialogTitle>
          <DialogDescription className="text-center font-body text-charcoal/70">
            The kitchen doesn't have enough stock for part of your order. Nothing was charged.
          </DialogDescription>
        </DialogHeader>
        {items.length > 0 && (
          <ul className="space-y-1 rounded-2xl bg-flame/10 p-3 font-body text-sm text-charcoal">
            {items.map((i) => (
              <li key={i}>• {i}</li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-flame py-3 font-display text-sm font-extrabold uppercase tracking-[0.16em] text-cream"
          >
            Edit my order
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The bill that counts — straight from the server's order response. */
export function OrderReceiptDialog({
  open,
  code,
  bill,
  note,
  onClose,
}: {
  open: boolean;
  code: string | null;
  bill: OrderBill | null;
  note: string;
  onClose: () => void;
}) {
  const row = (label: string, value: number, minus = false) => (
    <div className="flex justify-between">
      <dt className="text-charcoal/60">{label}</dt>
      <dd className="text-charcoal">
        {minus ? "− " : ""}
        {value ? `Rs ${value}` : label === "Subtotal" ? "Rs 0" : "Free"}
      </dd>
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl border-2 border-charcoal/10 bg-cream">
        <DialogHeader>
          <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full bg-flame text-cream">
            <Check className="h-7 w-7" aria-hidden="true" />
          </div>
          <DialogTitle className="text-center font-display text-2xl font-extrabold uppercase text-charcoal">
            {code ? `Order ${code}` : "Order confirmed"}
          </DialogTitle>
          <DialogDescription className="text-center font-body text-charcoal/70">{note}</DialogDescription>
        </DialogHeader>
        {bill && (
          <dl className="space-y-2 font-body text-sm">
            {row("Subtotal", bill.subtotal)}
            {row("Delivery", bill.delivery_fee)}
            {bill.cod_fee > 0 && row("COD fee", bill.cod_fee)}
            {bill.discount > 0 && row("Discount", bill.discount, true)}
            <div className="flex justify-between border-t border-charcoal/10 pt-2">
              <dt className="font-display font-extrabold uppercase text-charcoal">Total</dt>
              <dd className="font-display text-xl font-extrabold text-flame">Rs {bill.total}</dd>
            </div>
          </dl>
        )}
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-flame py-3 font-display text-sm font-extrabold uppercase tracking-[0.16em] text-cream"
          >
            Track my order
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
