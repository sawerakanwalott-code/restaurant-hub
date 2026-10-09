import { createFileRoute } from "@tanstack/react-router";
import { EyeOff, MessageSquareReply, Star } from "lucide-react";
import { useMemo, useState } from "react";

import { Bar, GhostButton, GoldButton, Panel, SegmentedTabs, StatCard, fieldClass } from "@/components/admin/bits";
import { PageHeader, SampleNote } from "@/components/admin/SampleNote";
import { api } from "@/lib/api/client";
import { timeAgo } from "@/lib/admin-store";
import { ADMIN_EXTRA, sampleReviews, useAdminResource, type Review } from "@/lib/admin-extras";

export const Route = createFileRoute("/admin/reviews")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Customer Reviews — Owner Console" },
      { name: "description", content: "Read and reply to customer ratings for food and delivery." },
      { property: "og:title", content: "Customer Reviews — Owner Console" },
      { property: "og:description", content: "Read and reply to customer ratings." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReviewsPage,
});

type Tab = "all" | "unanswered" | "low";

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-3.5 w-3.5 ${i <= n ? "fill-lux text-lux" : "text-slate-dim/40"}`} />)}
    </span>
  );
}

function ReviewsPage() {
  const { data, sample, mutate } = useAdminResource<Review[]>(ADMIN_EXTRA.reviews, sampleReviews);
  const [tab, setTab] = useState<Tab>("all");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const avg = (k: "rating" | "food" | "delivery") => (data.length ? data.reduce((s, r) => s + r[k], 0) / data.length : 0);
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: data.filter((r) => r.rating === n).length }));
  const rows = useMemo(
    () => data.filter((r) => (tab === "unanswered" ? !r.reply : tab === "low" ? r.rating <= 2 : true)),
    [data, tab],
  );

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Guests" title="Reviews" sub="What customers say after delivery. A quick reply wins them back." />
      <SampleNote show={sample} what="Reviews" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Overall" value={`${avg("rating").toFixed(1)} ★`} tone="gold" icon={<Star className="h-4 w-4" />} />
        <StatCard label="Food" value={`${avg("food").toFixed(1)} ★`} />
        <StatCard label="Delivery" value={`${avg("delivery").toFixed(1)} ★`} tone={avg("delivery") < 3.5 ? "bad" : "good"} />
        <StatCard label="Waiting for reply" value={data.filter((r) => !r.reply).length} tone={data.some((r) => !r.reply) ? "bad" : "good"} icon={<MessageSquareReply className="h-4 w-4" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <Panel title="Rating spread">
          <div className="space-y-2">
            {dist.map(({ n, c }) => (
              <div key={n} className="flex items-center gap-3 text-xs">
                <span className="w-6 text-frost">{n}★</span>
                <div className="flex-1"><Bar value={c} max={Math.max(data.length, 1)} tone={n <= 2 ? "ruby" : "gold"} /></div>
                <span className="w-6 text-right text-slate-dim">{c}</span>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-3">
          <SegmentedTabs value={tab} onChange={setTab} options={[{ id: "all", label: "All" }, { id: "unanswered", label: "Unanswered" }, { id: "low", label: "1–2 stars" }]} />
          {rows.map((r) => (
            <Panel key={r.id} bodyClassName={`p-5 space-y-3 ${r.hidden ? "opacity-50" : ""}`}>
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-bold text-frost">{r.customer}</p>
                <Stars n={r.rating} />
                <span className="text-[11px] text-slate-dim">{r.order_code} · {timeAgo(new Date(r.at).getTime())}</span>
                <span className="ml-auto text-[11px] text-slate-dim">Food {r.food}★ · Delivery {r.delivery}★</span>
              </div>
              <p className="text-sm text-mist">“{r.comment}”</p>
              {r.reply ? (
                <div className="rounded-xl border border-lux/20 bg-lux/5 px-3 py-2 text-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-lux">Your reply</p>
                  <p className="text-frost">{r.reply}</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input className={`${fieldClass} flex-1`} placeholder="Write a reply…" value={drafts[r.id] ?? ""} onChange={(e) => setDrafts({ ...drafts, [r.id]: e.target.value })} />
                  <GoldButton disabled={!drafts[r.id]?.trim()} onClick={() => mutate("Reply posted", () => api.post(ADMIN_EXTRA.reviewReply(r.id), { reply: drafts[r.id] }), (p) => p.map((x) => (x.id === r.id ? { ...x, reply: drafts[r.id] } : x)))}>Reply</GoldButton>
                </div>
              )}
              <GhostButton onClick={() => mutate(r.hidden ? "Review shown" : "Review hidden", () => api.patch(ADMIN_EXTRA.review(r.id), { hidden: !r.hidden }), (p) => p.map((x) => (x.id === r.id ? { ...x, hidden: !r.hidden } : x)))}>
                <EyeOff className="h-3.5 w-3.5" /> {r.hidden ? "Show on menu" : "Hide from menu"}
              </GhostButton>
            </Panel>
          ))}
          {rows.length === 0 ? <p className="text-sm text-slate-dim">Nothing here.</p> : null}
        </div>
      </div>
    </div>
  );
}
