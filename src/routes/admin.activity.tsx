import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import { useMemo, useState } from "react";

import { LuxSearch, Panel, SegmentedTabs } from "@/components/admin/bits";
import { PageHeader, SampleNote } from "@/components/admin/SampleNote";
import { timeAgo } from "@/lib/admin-store";
import { ADMIN_EXTRA, sampleAudit, useAdminResource, type AdminAudit } from "@/lib/admin-extras";

export const Route = createFileRoute("/admin/activity")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Activity Log — Owner Console" },
      { name: "description", content: "Who changed what in your restaurant: orders, payments, prices and staff." },
      { property: "og:title", content: "Activity Log — Owner Console" },
      { property: "og:description", content: "Every staff action, with who and when." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ActivityPage,
});

const TONE: Record<AdminAudit["category"], string> = {
  order: "bg-azure/12 text-azure",
  payment: "bg-jade/12 text-jade",
  menu: "bg-lux/12 text-lux",
  staff: "bg-amber-lux/12 text-amber-lux",
  settings: "bg-mist/10 text-mist",
  refund: "bg-ruby/12 text-ruby",
};

type Cat = AdminAudit["category"] | "all";

function ActivityPage() {
  const { data, sample } = useAdminResource<AdminAudit[]>(ADMIN_EXTRA.audit, sampleAudit);
  const [cat, setCat] = useState<Cat>("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data
      .filter((e) => (cat === "all" ? true : e.category === cat))
      .filter((e) => (!s ? true : [e.actor, e.action, e.target].join(" ").toLowerCase().includes(s)));
  }, [data, cat, q]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Control" title="Activity log" sub="Every change by your team — price edits, refunds, payment checks and more." />
      <SampleNote show={sample} what="The activity log" />

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedTabs value={cat} onChange={setCat} options={(["all", "order", "payment", "refund", "menu", "staff", "settings"] as Cat[]).map((v) => ({ value: v, label: v === "all" ? "All" : v[0].toUpperCase() + v.slice(1) }))} />
        <LuxSearch value={q} onChange={setQ} placeholder="Search person, action or order" className="ml-auto w-72" />
      </div>

      <Panel bodyClassName="p-0">
        <ol className="divide-y divide-lux/10">
          {rows.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <span className="icon-3d text-lux"><ScrollText className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-frost"><span className="font-bold">{e.actor}</span> <span className="text-slate-dim">({e.role})</span> · {e.action}</p>
                <p className="text-[11px] text-slate-dim">{e.target}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] ${TONE[e.category]}`}>{e.category}</span>
              <span className="w-20 text-right text-[11px] text-slate-dim">{timeAgo(new Date(e.at).getTime())}</span>
            </li>
          ))}
          {rows.length === 0 ? <li className="px-5 py-6 text-sm text-slate-dim">No matching activity.</li> : null}
        </ol>
      </Panel>
    </div>
  );
}
