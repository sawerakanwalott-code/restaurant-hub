import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Headphones, RotateCcw, ShoppingBag } from "lucide-react";

import { fetchDishes, DISHES, BACKEND_MENU } from "@/lib/menu";
import { addToCart } from "@/lib/cart";
import { isMuted, playSfx } from "@/lib/sfx";
import bookCover from "@/assets/menu-book-cover.jpg";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "framer-motion";

type BookDish = {
  slug: string;
  name: string;
  course: string;
  price: string;
  description: string;
  notes: string[];
  image: string;
};

function formatDishes(source: typeof DISHES): BookDish[] {
  return [...source]
    .sort((a, b) => {
      const aIsPizza = a.slug.includes("pizza") || a.tag.toLowerCase().includes("pizza") || a.name.toLowerCase().includes("pizza");
      const bIsPizza = b.slug.includes("pizza") || b.tag.toLowerCase().includes("pizza") || b.name.toLowerCase().includes("pizza");
      if (aIsPizza && !bIsPizza) return -1;
      if (!aIsPizza && bIsPizza) return 1;
      return 0;
    })
    .map((dish) => ({
      slug: dish.slug,
      name: dish.name,
      course: dish.tag,
      price: `PKR ${dish.price}`,
      description: dish.desc,
      notes: [`${dish.serves} · ${dish.weight}`, `Ready in ${dish.time}`, dish.ingredients[0] || "Caddy Oven Special"],
      image: dish.image,
    }));
}

function speak(text: string) {
  if (typeof window === "undefined" || isMuted()) return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.92;
  utter.pitch = 0.9;
  utter.volume = 0.6;
  synth.speak(utter);
}

type Drag = { dir: 1 | -1; p: number; settling: boolean; commit: boolean };

export function MenuBook() {
  const reducedMotion = useReducedMotion();
  const [dishes, setDishes] = useState<BookDish[]>(() => (BACKEND_MENU ? [] : formatDishes(DISHES)));
  const [page, setPage] = useState(0); // 0 = cover, 1..n = dish
  const [drag, setDrag] = useState<Drag | null>(null);
  const [menuError, setMenuError] = useState(false);
  const start = useRef<{ x: number; w: number; id: number } | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    fetchDishes()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setDishes(formatDishes(data));
          setPage(0);
        }
      })
      .catch(() => setMenuError(true));
  }, []);

  useEffect(() => () => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  const total = dishes.length; // last page index

  const finish = useCallback(
    (dir: 1 | -1, commit: boolean, fromP: number) => {
      busy.current = true;
      setDrag({ dir, p: fromP, settling: false, commit });
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setDrag({ dir, p: commit ? 1 : 0, settling: true, commit })),
      );
      window.setTimeout(() => {
        if (commit) {
          setPage((cur) => {
            const next = Math.min(total, Math.max(0, cur + dir));
            const d = dishes[next - 1];
            if (dir > 0 && d) speak(d.name);
            return next;
          });
        }
        setDrag(null);
        busy.current = false;
      }, reducedMotion ? 30 : 680);
      if (commit) playSfx(dir > 0 ? "swoosh" : "pop");
    },
    [dishes, total, reducedMotion],
  );

  const flip = useCallback(
    (dir: 1 | -1) => {
      if (busy.current) return;
      if (dir > 0 && page >= total) return;
      if (dir < 0 && page <= 0) return;
      finish(dir, true, 0);
    },
    [finish, page, total],
  );

  const closeAll = useCallback(() => {
    if (busy.current || page === 0) return;
    playSfx("pop");
    window.speechSynthesis?.cancel();
    setPage(0);
  }, [page]);

  const order = useCallback((slug: string, name: string) => {
    addToCart(slug);
    playSfx("cart");
    toast.success(`${name} added to your order`);
  }, []);

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (busy.current) return;
    if ((e.target as HTMLElement).closest("button")) return;
    const r = e.currentTarget.getBoundingClientRect();
    start.current = { x: e.clientX, w: r.width, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) < 6) return;
    const dir: 1 | -1 = dx < 0 ? 1 : -1;
    if ((dir > 0 && page >= total) || (dir < 0 && page <= 0)) return;
    const p = Math.min(1, Math.abs(dx) / (s.w * 0.9));
    setDrag({ dir, p, settling: false, commit: false });
  };
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    start.current = null;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) < 6) {
      setDrag(null);
      const r = e.currentTarget.getBoundingClientRect();
      flip(e.clientX - r.left > r.width * 0.4 ? 1 : -1);
      return;
    }
    if (drag) finish(drag.dir, drag.p > 0.28, drag.p);
  };

  // Which pages to render
  let under = page;
  let sheet: number | null = null;
  let angle = 0;
  if (drag) {
    if (drag.dir > 0) {
      under = page + 1;
      sheet = page;
      angle = -180 * drag.p;
    } else {
      under = page;
      sheet = page - 1;
      angle = -180 * (1 - drag.p);
    }
  }

  const renderPage = (i: number) => {
    if (i === 0) {
      return (
        <div className="mb2-face mb2-cover">
          <img className="mb2-cover__texture" src={bookCover} alt="" width={768} height={1024} decoding="async" draggable={false} />
          <span className="mb2-cover__kicker">Moon Grill · Narowal</span>
          <span className="mb2-cover__title">Kennedy</span>
          <span className="mb2-cover__sub">The Menu Book</span>
          <span className="mb2-cover__rule" aria-hidden="true"><i /></span>
          <span className="mb2-cover__meta">Charcoal · Dum · Wood-Fired</span>
          <Button className="mb2-cover__cta" onClick={() => flip(1)} disabled={total === 0}>{total === 0 ? (menuError ? "Menu currently unavailable" : "Menu loading…") : "Open the book"}<ChevronRight aria-hidden="true" /></Button>
        </div>
      );
    }
    const d = dishes[i - 1];
    if (!d) return null;
    return (
      <div className="mb2-face mb2-dish">
        <img src={d.image} alt={d.name} loading="lazy" decoding="async" draggable={false} />
        <span className="mb2-dish__vignette" aria-hidden="true" />
        <span className="mb2-dish__frame" aria-hidden="true" />
        <div className="mb2-dish__top">
          <span className="mb2-chip">{d.course}</span>
          <span className="mb2-no">No. {String(i).padStart(2, "0")}</span>
        </div>
        <div className="mb2-dish__body">
          <h3 className="mb2-dish__name">{d.name}</h3>
          <p className="mb2-dish__desc">{d.description}</p>
          <div className="mb2-dish__notes">
            {d.notes.map((n) => <span key={n}>{n}</span>)}
          </div>
          <div className="mb2-dish__buy">
            <span className="mb2-dish__price">{d.price}</span>
            <Button
              type="button"
              className="mb2-listen"
              aria-label={`Listen to ${d.name}`}
              onClick={(e) => { e.stopPropagation(); speak(`${d.name}. ${d.description}. Price: ${d.price}`); }}
            >
              <Headphones aria-hidden="true" />
            </Button>
            <Button
              type="button"
              data-sfx="cart"
              className="mb2-order"
              onClick={(e) => { e.stopPropagation(); order(d.slug, d.name); }}
            >
              <ShoppingBag aria-hidden="true" /> Order
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section id="menu-book" className="mb2-scene">
      <header className="mb2-head">
        <span className="mb2-head__kicker">Charcoal · Dum · Wood-Fired</span>
      </header>

      <div className="mb2-stage">
        <div
          className={`mb2-book${drag ? " is-dragging" : ""}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => { start.current = null; if (drag) finish(drag.dir, false, drag.p); }}
          tabIndex={0}
          onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); flip(1); } if (event.key === "ArrowLeft") { event.preventDefault(); flip(-1); } }}
          role="region"
          aria-label="Menu book, swipe to flip pages"
          aria-roledescription="flipbook"
        >
          <div className="mb2-stack" aria-hidden="true"><i /><i /><i /></div>
          <div className="mb2-page mb2-page--under">{renderPage(Math.min(total, under))}</div>

          {sheet !== null && sheet >= 0 && (
            <div
              className={`mb2-sheet${drag?.settling ? " is-settling" : ""}`}
              style={{ "--a": `${angle}deg`, "--s": Math.sin((Math.abs(angle) * Math.PI) / 180) } as CSSProperties}
            >
              <div className="mb2-sheet__front">{renderPage(sheet)}</div>
              <div className="mb2-sheet__back">
                <span>Kennedy</span>
                <small>Moon Grill · Narowal</small>
              </div>
              <span className="mb2-sheet__shade" aria-hidden="true" />
            </div>
          )}

          {page < total && !drag && <span className="mb2-corner" aria-hidden="true" />}
        </div>
      </div>

      <nav className="mb2-controls" aria-label="Menu book pages">
        <Button variant="ghost" size="icon" type="button" onClick={() => flip(-1)} disabled={page === 0 || busy.current} aria-label="Previous dish" title="Previous dish"><ChevronLeft /></Button>
        <div className="mb2-controls__progress">
          <span>{page === 0 ? "Cover" : dishes[page - 1]?.name}</span>
           <div aria-hidden="true"><i style={{ width: `${total ? Math.max(4, (page / total) * 100) : 0}%` }} /></div>
          <small>{page} / {total}</small>
        </div>
        <Button variant="ghost" size="icon" type="button" onClick={() => flip(1)} disabled={page === total || busy.current} aria-label="Next dish" title="Next dish"><ChevronRight /></Button>
        <Button variant="ghost" size="icon" type="button" onClick={closeAll} disabled={page === 0 || busy.current} aria-label="Back to cover" title="Back to cover"><RotateCcw /></Button>
      </nav>
    </section>
  );
}
