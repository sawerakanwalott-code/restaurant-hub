/**
 * SITE LOADER — premium theatre-curtain opening with real loading progress.
 *
 * Rendered on the very first paint (SSR included) so the curtains are up
 * before the site shows. An inline head script in __root sets
 * `data-kmg-loader-seen` on <html> for returning sessions and CSS hides the
 * loader instantly in that case — no flash either way.
 *
 * Progress is real: it tracks fonts, decoded images already in the document,
 * and the window load event, then eases toward 100% so the meter always
 * feels creamy instead of jumping. The curtains only part once we are ready
 * (or once the safety ceiling is hit), so it can never hang.
 */
import { useEffect, useRef, useState } from "react";

export const LOADER_SESSION_KEY = "kmg.loader.seen.v2";

/** Never show for less than this — avoids an ugly one-frame blink. */
const MIN_MS = 900;
/** Hard ceiling: curtains open no matter what the network is doing. */
const MAX_MS = 3000;
/** Length of the curtain-open + stage-lift choreography (matches CSS). */
const OPEN_MS = 1200;

const PHASES: Array<{ at: number; label: string }> = [
  { at: 0, label: "Lighting the stone oven" },
  { at: 35, label: "Kneading the dough" },
  { at: 62, label: "Melting the cheese" },
  { at: 84, label: "Calling Caddy" },
  { at: 99, label: "Ready" },
];

function phaseFor(p: number) {
  let label = PHASES[0]?.label ?? "Ready";
  for (const phase of PHASES) if (p >= phase.at) label = phase.label;
  return label;
}

export function SiteLoader() {
  const [visible, setVisible] = useState(true);
  const [opening, setOpening] = useState(false);
  const [progress, setProgress] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(LOADER_SESSION_KEY)) {
      setVisible(false);
      return;
    }
    sessionStorage.setItem(LOADER_SESSION_KEY, "1");

    const started = performance.now();
    document.body.style.overflow = "hidden";

    let real = 0; // 0..1 share of actual work finished
    let done = false; // page is ready — glide to 100% from here
    let landed = false; // counter has visibly hit 100%
    let displayed = 0;
    let eased = 0;
    const timers: number[] = [];

    // ---- real signals -----------------------------------------------------
    const signals: Array<Promise<unknown>> = [];
    signals.push(
      new Promise<void>((resolve) => {
        if (document.readyState === "complete") return resolve();
        window.addEventListener("load", () => resolve(), { once: true });
      }),
    );
    if ("fonts" in document) signals.push((document as Document).fonts.ready);

    // Lazy/offscreen images may never load while the curtain is up — only
    // wait on eager (above-the-fold) artwork.
    const images = Array.from(document.images).filter(
      (img) => img.loading !== "lazy" && img.getAttribute("loading") !== "lazy",
    );
    const total = signals.length + images.length;
    let finished = 0;
    const bump = () => {
      finished += 1;
      real = Math.min(1, finished / Math.max(1, total));
    };
    for (const s of signals) s.then(bump, bump);
    for (const img of images) {
      if (img.complete) bump();
      else {
        img.addEventListener("load", bump, { once: true });
        img.addEventListener("error", bump, { once: true });
      }
    }

    // ---- eased meter ------------------------------------------------------
    const tick = () => {
      const elapsed = performance.now() - started;
      // Real readiness leads the count; publish only changed whole percentages.
      const trickle = Math.min(0.92, elapsed / MAX_MS);
      const target = Math.max(trickle, real) * 100;
      eased += (target - eased) * 0.08;
      const next = Math.min(99, Math.round(eased));
      if (next !== displayed) {
        displayed = next;
        setProgress(next);
      }

      const ready = (real >= 1 && elapsed >= MIN_MS) || elapsed >= MAX_MS;
      if (ready && !done) done = true;

      if (done && !landed) {
        // The page is ready: glide the counter the rest of the way so it
        // always lands on a visible 100% before the curtains part.
        eased += (100 - eased) * 0.16;
        if (Math.round(eased) >= 100) {
          landed = true;
          setProgress(100);
          // Hold the full 100% on screen briefly before opening.
          timers.push(
            window.setTimeout(() => setOpening(true), 550),
            window.setTimeout(() => {
              setVisible(false);
              document.body.style.overflow = "";
            }, 550 + OPEN_MS),
          );
        }
      }
      if (!landed) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      timers.forEach(window.clearTimeout);
      document.body.style.overflow = "";
    };
  }, []);

  if (!visible) return null;

  const pct = Math.round(progress);

  return (
    <div className={`opening${opening ? " is-opening" : ""}`} role="status" aria-label="Loading Kennedy Moon Grill">
      <div className="curtain curtain-left" />
      <div className="curtain curtain-right" />
      <div className="opening-glow" />
      <div className="curtain-valance" />
      <div className="opening-title" aria-hidden>
        <span>Kennedy</span>
        <strong>Moon Grill</strong>
        <i>FIRE. FLAVOUR. NAROWAL.</i>
      </div>
      <div className="opening-status" aria-hidden={opening}>
        <div className="opening-meta">
          <span className="opening-phase">{phaseFor(pct)}</span>
          <span className="opening-pct" key={pct}>{pct}%</span>
        </div>
      </div>
    </div>
  );
}
