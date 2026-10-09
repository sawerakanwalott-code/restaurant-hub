/**
 * Customer live-tracking screen: map first, then a status sheet, caddy card,
 * a compact step timeline and the order summary.
 *
 * Pure presentation: every number arrives from a `TrackingSnapshot`
 * (`src/lib/tracking.ts`) plus plain order props from the profile route.
 */
import { motion, useReducedMotion } from "framer-motion";
import { Bike, Check, CreditCard, MapPin, Phone, Route as RouteIcon } from "lucide-react";

import { TrackMap } from "@/components/kennedy/TrackMap";
import { formatClock, type TrackingSnapshot } from "@/lib/tracking";

type Props = {
  snapshot: TrackingSnapshot;
  riderName: string;
  targetLabel: string;
  riderPhone?: string | null;
  riderAssigned?: boolean;
  dishName?: string;
  dishImage?: string | null;
  itemsLabel?: string;
  totalLabel?: string;
  paymentLabel?: string;
};

export function OrderTracking({
  snapshot,
  riderName,
  targetLabel,
  riderPhone,
  riderAssigned,
  dishName,
  dishImage,
  itemsLabel,
  totalLabel,
  paymentLabel,
}: Props) {
  const reduce = useReducedMotion();
  const pct = Math.round(snapshot.progress * 100);
  const activeStage = snapshot.stages.find((s) => s.active);
  const title = snapshot.delivered ? "Delivered — enjoy your meal!" : (activeStage?.label ?? "On track");

  return (
    <div className="space-y-3">
      {/* map */}
      <div className="overflow-hidden rounded-2xl border-2 border-flame/30 bg-cream-deep p-1.5">
        <TrackMap
          variant="storefront"
          riderName={riderName}
          target={snapshot.target}
          targetLabel={targetLabel}
          rideStarted={!!snapshot.courier}
          courier={snapshot.courier}
        />
      </div>

      {/* status sheet */}
      <section className="rounded-2xl border-2 border-flame/25 bg-cream-deep p-4 text-charcoal">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-body text-xs font-bold text-flame">Order #{snapshot.orderCode}</p>
            <h2 className="mt-0.5 font-display text-lg font-bold leading-snug text-charcoal">{title}</h2>
            {activeStage?.hint && !snapshot.delivered && (
              <p className="mt-0.5 font-body text-[13px] text-charcoal/65">{activeStage.hint}</p>
            )}
          </div>
          <div className="shrink-0 rounded-2xl bg-flame px-3 py-2 text-cream text-center">
            <p className="font-display text-xl font-black leading-none text-cream">
              {snapshot.delivered ? <Check className="mx-auto h-5 w-5" aria-hidden="true" /> : snapshot.etaMinutes}
            </p>
            <p className="mt-1 font-body text-[10px] font-bold text-cream/80">
              {snapshot.delivered ? "Done" : "min"}
            </p>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-charcoal/10">
          <motion.div
            className="h-full rounded-full bg-flame"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: reduce ? 0 : 0.6, ease: "easeOut" }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between font-body text-xs text-charcoal/60">
          <span>Placed {formatClock(snapshot.placedAt)}</span>
          <span>Arrives by {formatClock(snapshot.etaAt)}</span>
        </div>

        {/* steps */}
        <ol className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-1">
          {snapshot.stages.map((stage) => (
            <li key={stage.key} className="flex min-w-0 flex-col items-center text-center">
              <span
                className={`grid h-7 w-7 place-items-center rounded-full border-2 transition-colors ${
                  stage.done ? "border-flame bg-flame text-cream" : "border-charcoal/15 bg-cream text-charcoal/30"
                } ${stage.active ? "ring-4 ring-flame/25" : ""}`}
              >
                {stage.done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <span
                className={`mt-1.5 line-clamp-2 font-body text-[10px] font-bold leading-tight ${
                  stage.done ? "text-charcoal" : "text-charcoal/45"
                }`}
              >
                {stage.label}
              </span>
              {stage.at && <span className="font-body text-[10px] text-charcoal/50">{formatClock(stage.at)}</span>}
            </li>
          ))}
        </ol>
      </section>

      {/* caddy */}
      <section className="flex items-center gap-3 rounded-2xl border-2 border-flame/20 bg-cream-deep p-3.5 text-charcoal">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-flame text-cream">
          <Bike className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-[11px] text-charcoal/60">Your caddy</p>
          <p className="truncate font-display text-base font-bold">
            {riderAssigned ? riderName : "Being assigned…"}
          </p>
          <p className="flex items-center gap-1 font-body text-[11px] text-charcoal/60">
            <RouteIcon className="h-3 w-3" aria-hidden="true" />
            {snapshot.courier
              ? `${snapshot.remainingKm.toFixed(1)} km away${snapshot.speedKmh ? ` · ${snapshot.speedKmh.toFixed(0)} km/h` : ""}`
              : "Still at the grill"}
          </p>
        </div>
        {riderPhone && (
          <a
            href={`tel:${riderPhone}`}
            aria-label={`Call ${riderName}`}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-flame text-cream transition-transform active:scale-95"
          >
            <Phone className="h-5 w-5" aria-hidden="true" />
          </a>
        )}
      </section>

      {/* order summary */}
      <section className="rounded-2xl border-2 border-flame/20 bg-cream-deep p-4">
        <div className="flex items-center gap-3">
          {dishImage && (
            <img src={dishImage} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" loading="lazy" decoding="async" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-bold text-charcoal">{dishName}</p>
            {itemsLabel && <p className="font-body text-xs text-charcoal/55">{itemsLabel}</p>}
          </div>
          {totalLabel && <p className="shrink-0 font-display text-base font-black text-flame">{totalLabel}</p>}
        </div>
        <dl className="mt-3 space-y-2 border-t-2 border-dashed border-flame/25 pt-3 font-body text-[13px]">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-flame" aria-hidden="true" />
            <dt className="sr-only">Deliver to</dt>
            <dd className="text-charcoal/75">{targetLabel}</dd>
          </div>
          {paymentLabel && (
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 shrink-0 text-flame" aria-hidden="true" />
              <dt className="sr-only">Payment</dt>
              <dd className="text-charcoal/75">{paymentLabel}</dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
}
