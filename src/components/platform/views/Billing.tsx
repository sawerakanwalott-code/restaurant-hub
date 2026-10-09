import { useMemo, useState } from "react";
import { BellRing, CheckCircle2, Clock, Download, FilePlus2, Search, Wallet, XCircle } from "lucide-react";

import { api } from "@/lib/api/client";
import { PLATFORM } from "@/lib/api/endpoints";
import type { Invoice, InvoiceStatus } from "@/lib/platform/types";
import { usePlatform } from "../store";
import { Avatar, Card, downloadCsv, Empty, Field, fmtDate, fmtDateTime, InvPill, Kpi, Modal, PageHead, pkr, SampleBanner } from "../ui";

export function Billing() {
  const { invoices, tenants, sources, mutate, set, settings } = usePlatform();
  const [filter, setFilter] = useState<"all" | InvoiceStatus>("all");
  const [q, setQ] = useState("");
  const [review, setReview] = useState<Invoice | null>(null);
  const [create, setCreate] = useState(false);

  const sum = (s: InvoiceStatus[]) => invoices.filter((i) => s.includes(i.status)).reduce((a, i) => a + Number(i.amount_pkr), 0);
  const overdue = invoices.filter((i) => i.status === "pending" && i.due_date && new Date(i.due_date) < new Date());
  const rows = useMemo(() => invoices.filter((i) => (filter === "all" || i.status === filter) && (!q || i.subscription.tenant.name.toLowerCase().includes(q.toLowerCase()) || String(i.id).includes(q) || i.jazzcash_transaction_id.includes(q))), [invoices, filter, q]);

  const decide = (inv: Invoice, action: "approve" | "reject", notes: string) => mutate({
    label: action === "approve" ? `Invoice #${inv.id} approved` : `Invoice #${inv.id} rejected`,
    call: () => api.post(PLATFORM.verifyInvoice(inv.id), { action, admin_notes: notes }),
    local: () => set("invoices", (p) => p.map((x) => (x.id === inv.id ? { ...x, status: action === "approve" ? "paid" : "rejected", admin_notes: notes, paid_at: action === "approve" ? new Date().toISOString() : null } : x))),
    audit: { action: `${action === "approve" ? "Approved" : "Rejected"} invoice #${inv.id}`, target: inv.subscription.tenant.name, category: "billing" },
  }).then((ok) => ok && setReview(null));

  const remind = (inv: Invoice) => mutate({ label: `Reminder sent to ${inv.subscription.tenant.name}`, call: () => api.post(PLATFORM.invoiceRemind(inv.id), {}), local: () => {}, audit: { action: `Sent payment reminder for #${inv.id}`, target: inv.subscription.tenant.name, category: "billing" } });

  const chips: ["all" | InvoiceStatus, string][] = [["all", "All"], ["under_review", "Needs review"], ["pending", "Unpaid"], ["paid", "Paid"], ["rejected", "Rejected"]];

  return (
    <>
      <PageHead title="Invoices & payments" crumb="Invoices" actions={<>
        <button className="pf-btn pf-btn-ghost" onClick={() => downloadCsv("invoices", rows.map((i) => ({ id: i.id, restaurant: i.subscription.tenant.name, plan: i.subscription.plan.name, amount: i.amount_pkr, status: i.status, period_start: i.period_start, period_end: i.period_end, txn: i.jazzcash_transaction_id, paid_at: i.paid_at })))}><Download className="h-4 w-4" /> Export</button>
        <button className="pf-btn pf-btn-primary" onClick={() => setCreate(true)}><FilePlus2 className="h-4 w-4" /> New invoice</button>
      </>} />
      <SampleBanner source={sources.invoices} what="Invoices" />

      <div className="pf-kpis">
        <Kpi icon={CheckCircle2} tone="green" value={pkr(sum(["paid"]))} label="Collected" />
        <Kpi icon={Clock} tone="yellow" value={pkr(sum(["under_review"]))} label="Waiting for your review" onClick={() => setFilter("under_review")} />
        <Kpi icon={Wallet} tone="orange" value={pkr(sum(["pending"]))} label="Unpaid" hint={overdue.length ? <span style={{ color: "var(--pf-red)" }}>{overdue.length} overdue</span> : undefined} onClick={() => setFilter("pending")} />
        <Kpi icon={XCircle} tone="red" value={invoices.filter((i) => i.status === "rejected").length} label="Rejected proofs" onClick={() => setFilter("rejected")} />
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="pf-chips">{chips.map(([k, l]) => <button key={k} className={`pf-chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{l}</button>)}</div>
          <div className="relative ml-auto"><Search className="pf-muted absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" /><input className="pf-input" style={{ paddingLeft: 36, width: 260 }} placeholder="Restaurant, invoice # or JazzCash ID" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        {rows.length === 0 ? <Empty>No invoices here.</Empty> : (
          <div className="pf-table-wrap">
            <table className="pf-table">
              <thead><tr><th>Invoice</th><th>Restaurant</th><th>Period</th><th>Amount</th><th>JazzCash ID</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id}>
                    <td><b>#{i.id}</b><div className="pf-muted text-xs">{fmtDate(i.created_at)}</div></td>
                    <td><div className="flex items-center gap-2"><Avatar name={i.subscription.tenant.name} size={32} /><div><b className="text-sm">{i.subscription.tenant.name}</b><div className="pf-muted text-xs">{i.subscription.plan.name}</div></div></div></td>
                    <td className="text-sm">{fmtDate(i.period_start)} – {fmtDate(i.period_end)}</td>
                    <td><b>{pkr(i.amount_pkr)}</b></td>
                    <td className="pf-display text-sm">{i.jazzcash_transaction_id || <span className="pf-muted">—</span>}</td>
                    <td><InvPill s={i.status} /></td>
                    <td className="whitespace-nowrap text-right">
                      {i.status === "under_review" ? <button className="pf-btn pf-btn-primary pf-btn-sm" onClick={() => setReview(i)}>Review proof</button> : null}
                      {i.status === "pending" ? <button className="pf-btn pf-btn-ghost pf-btn-sm" onClick={() => remind(i)}><BellRing className="h-3.5 w-3.5" /> Remind</button> : null}
                      {i.status === "paid" || i.status === "rejected" ? <button className="pf-btn pf-btn-ghost pf-btn-sm" onClick={() => setReview(i)}>Details</button> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Where restaurants pay you" className="mt-[22px]">
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl p-4 tone-blue"><div className="text-xs font-bold">JazzCash</div><div className="pf-display mt-1 text-base">{settings.payout_jazzcash}</div></div>
          <div className="rounded-xl p-4 tone-violet"><div className="text-xs font-bold">Bank transfer</div><div className="pf-display mt-1 text-base">{settings.payout_bank}</div></div>
        </div>
        <p className="pf-muted mt-3 text-xs">Change these in Settings. Restaurants see them on their billing page.</p>
      </Card>

      {review ? <ReviewModal inv={review} onClose={() => setReview(null)} onDecide={decide} /> : null}
      {create ? <CreateInvoice tenants={tenants.map((t) => ({ slug: t.slug, name: t.name, plan: t.plan_name }))} onClose={() => setCreate(false)} /> : null}
    </>
  );
}

function ReviewModal({ inv, onClose, onDecide }: { inv: Invoice; onClose: () => void; onDecide: (i: Invoice, a: "approve" | "reject", n: string) => void }) {
  const [notes, setNotes] = useState(inv.admin_notes);
  const open = inv.status === "under_review";
  return (
    <Modal title={`Invoice #${inv.id}`} onClose={onClose} footer={open ? <>
      <button className="pf-btn pf-btn-danger" disabled={!notes.trim()} title={!notes.trim() ? "Add a reason first" : ""} onClick={() => onDecide(inv, "reject", notes)}><XCircle className="h-4 w-4" /> Reject</button>
      <button className="pf-btn pf-btn-success" onClick={() => onDecide(inv, "approve", notes)}><CheckCircle2 className="h-4 w-4" /> Approve payment</button>
    </> : undefined}>
      <dl className="grid grid-cols-2 gap-y-2 text-sm">
        <dt className="pf-muted">Restaurant</dt><dd><b>{inv.subscription.tenant.name}</b></dd>
        <dt className="pf-muted">Plan</dt><dd>{inv.subscription.plan.name}</dd>
        <dt className="pf-muted">Amount</dt><dd><b>{pkr(inv.amount_pkr)}</b></dd>
        <dt className="pf-muted">JazzCash ID</dt><dd className="pf-display">{inv.jazzcash_transaction_id || "—"}</dd>
        <dt className="pf-muted">Status</dt><dd><InvPill s={inv.status} /></dd>
        {inv.paid_at ? <><dt className="pf-muted">Paid</dt><dd>{fmtDateTime(inv.paid_at)}</dd></> : null}
      </dl>
      {inv.payment_proof_url ? (
        <a href={inv.payment_proof_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl" style={{ background: "var(--pf-bg)" }}>
          <img src={inv.payment_proof_url} alt="Payment proof" className="max-h-80 w-full object-contain" />
          <span className="pf-muted block p-2 text-center text-xs">Click to open full size</span>
        </a>
      ) : <p className="pf-muted text-sm">No payment screenshot uploaded.</p>}
      <Field label={open ? "Note to restaurant (required to reject)" : "Note"}><textarea className="pf-textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!open} /></Field>
    </Modal>
  );
}

function CreateInvoice({ tenants, onClose }: { tenants: { slug: string; name: string; plan: string }[]; onClose: () => void }) {
  const { mutate, set } = usePlatform();
  const [slug, setSlug] = useState(tenants[0]?.slug ?? "");
  const [amount, setAmount] = useState(6000);
  const [note, setNote] = useState("");
  const t = tenants.find((x) => x.slug === slug);
  return (
    <Modal title="New invoice" onClose={onClose} footer={<>
      <button className="pf-btn pf-btn-ghost" onClick={onClose}>Cancel</button>
      <button className="pf-btn pf-btn-primary" disabled={!t || amount <= 0} onClick={() => {
        const now = new Date();
        const inv: Invoice = { id: Math.floor(Date.now() / 1000) % 100000, subscription: { tenant: { slug, name: t!.name }, plan: { name: t!.plan } }, amount_pkr: String(amount), status: "pending", period_start: now.toISOString(), period_end: new Date(+now + 30 * 864e5).toISOString(), jazzcash_transaction_id: "", payment_proof_url: "", paid_at: null, created_at: now.toISOString(), due_date: new Date(+now + 7 * 864e5).toISOString(), admin_notes: note };
        void mutate({ label: `Invoice created for ${t!.name}`, call: () => api.post(PLATFORM.invoiceCreate, { tenant_slug: slug, amount_pkr: amount, admin_notes: note }), local: () => set("invoices", (p) => [inv, ...p]), audit: { action: `Created invoice ${pkr(amount)}`, target: t!.name, category: "billing" } }).then((ok) => ok && onClose());
      }}>Create invoice</button>
    </>}>
      <Field label="Restaurant"><select className="pf-select" value={slug} onChange={(e) => setSlug(e.target.value)}>{tenants.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}</select></Field>
      <Field label="Amount (₨)"><input type="number" className="pf-input" value={amount} onChange={(e) => setAmount(+e.target.value)} /></Field>
      <Field label="Note"><input className="pf-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Setup fee" /></Field>
      <p className="pf-muted text-xs">Due in 7 days. The restaurant is notified on WhatsApp.</p>
    </Modal>
  );
}
