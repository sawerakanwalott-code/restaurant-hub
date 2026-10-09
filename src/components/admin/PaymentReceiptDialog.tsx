import { Link } from "@tanstack/react-router";
import { ExternalLink, FileText, ImageOff, Receipt } from "lucide-react";

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Money, PaymentBadge } from "@/components/admin/bits";
import { PAYMENT_LABEL, type AdminOrder } from "@/lib/admin-store";

type Props = { order: AdminOrder };

/** Shows the customer's uploaded JazzCash / EasyPaisa receipt for an order. */
export function PaymentReceiptDialog({ order }: Props) {
  const p = order.payment;
  const url = p.proofUrl ?? null;
  const isPdf = !!url && /\.pdf($|\?)/i.test(url);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-lux/40 bg-lux/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-lux transition hover:bg-lux/20"
        >
          <Receipt className="h-3 w-3" /> View receipt
        </button>
      </DialogTrigger>
      <DialogContent className="panel-lux max-w-lg border-lux/25 bg-background/95 text-frost">
        <DialogTitle className="font-hero text-xl tracking-wide text-frost">
          Payment receipt · <span className="num-lux text-lux">{order.code}</span>
        </DialogTitle>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Method" value={PAYMENT_LABEL[p.method]} />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-dim">Status</p>
            <div className="pt-1"><PaymentBadge status={p.status} /></div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-dim">Order total</p>
            <Money value={order.total} className="text-lux" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-dim">Amount paid</p>
            <Money value={p.amountPaid} className="text-frost" />
          </div>
          <Info label="Reference / TID" value={p.reference || "—"} />
          <Info label="Paid at" value={p.paidAt ? new Date(p.paidAt).toLocaleString() : "—"} />
          {p.verifiedBy && <Info label="Verified by" value={p.verifiedBy} />}
        </div>

        <div className="overflow-hidden rounded-2xl border border-lux/20 bg-muted/20">
          {!url ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-slate-dim">
              <ImageOff className="h-8 w-8" />
              <p className="text-sm">No receipt uploaded for this order yet.</p>
            </div>
          ) : isPdf ? (
            <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-6 text-sm text-lux hover:underline">
              <FileText className="h-5 w-5" /> Open PDF receipt
            </a>
          ) : (
            <a href={url} target="_blank" rel="noreferrer">
              <img src={url} alt={`Payment receipt for ${order.code}`} className="max-h-[50vh] w-full object-contain" />
            </a>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-lux/25 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-frost hover:border-lux/60">
              <ExternalLink className="h-3.5 w-3.5" /> Full size
            </a>
          )}
          <Link
            to="/admin/orders/$id"
            params={{ id: order.id }}
            className="inline-flex items-center gap-1.5 rounded-full border border-lux/40 bg-lux/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-lux hover:bg-lux/20"
          >
            Verify on order page
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-dim">{label}</p>
      <p className="pt-1 font-bold text-frost break-all">{value}</p>
    </div>
  );
}
