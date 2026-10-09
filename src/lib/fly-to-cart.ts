/**
 * "Fly to cart" effect: a copy of the dish photo shrinks along a curved path
 * into the cart icon. Triggered from addToCart using the last tapped element,
 * so every add button gets the effect without per-button wiring.
 */
let lastTap: { el: Element; at: number } | null = null;

if (typeof window !== "undefined") {
  window.addEventListener(
    "pointerdown",
    (e) => {
      if (e.target instanceof Element) lastTap = { el: e.target, at: Date.now() };
    },
    { capture: true, passive: true },
  );
}

function findImage(from: Element): HTMLImageElement | null {
  let node: Element | null = from;
  for (let i = 0; node && i < 8; i++, node = node.parentElement) {
    const imgs = Array.from(node.querySelectorAll("img")).filter((img) => {
      const r = img.getBoundingClientRect();
      return r.width > 40 && r.height > 40 && img.currentSrc;
    });
    if (imgs.length) return imgs[0] as HTMLImageElement;
  }
  return null;
}

function findTarget(): DOMRect | null {
  for (const el of Array.from(document.querySelectorAll("[data-cart-target]"))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
  }
  return null;
}

export function flyFromLastTap() {
  if (typeof window === "undefined" || !lastTap || Date.now() - lastTap.at > 1500) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const btn = lastTap.el.closest("button");
  if (btn) gooeyAdded(btn as HTMLElement, reduce);
  if (reduce) { lastTap = null; return; }
  const img = findImage(lastTap.el);
  lastTap = null;
  if (!img) return;
  const from = img.getBoundingClientRect();
  const src = img.currentSrc;

  // Cart icon may mount on the first add — wait two frames for it.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const to = findTarget();
      const endX = to ? to.left + to.width / 2 : 40;
      const endY = to ? to.top + to.height / 2 : window.innerHeight - 40;
      const size = Math.min(from.width, from.height, 220);
      const startX = from.left + from.width / 2;
      const startY = from.top + from.height / 2;

      const ghost = document.createElement("img");
      ghost.src = src;
      ghost.alt = "";
      ghost.setAttribute("aria-hidden", "true");
      ghost.className = "fly-to-cart";
      Object.assign(ghost.style, {
        width: `${size}px`,
        height: `${size}px`,
        left: `${startX - size / 2}px`,
        top: `${startY - size / 2}px`,
      });
      document.body.appendChild(ghost);

      const dx = endX - startX;
      const dy = endY - startY;
      const lift = Math.min(160, Math.abs(dy) * 0.35 + 60);
      const anim = ghost.animate(
        [
          { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 },
          {
            transform: `translate(${dx * 0.35}px, ${dy * 0.35 - lift}px) scale(0.7) rotate(-12deg)`,
            opacity: 1,
            offset: 0.35,
          },
          {
            transform: `translate(${dx}px, ${dy}px) scale(${24 / size}) rotate(20deg)`,
            opacity: 0.6,
          },
        ],
        { duration: 850, easing: "cubic-bezier(0.55, 0, 0.35, 1)", fill: "forwards" },
      );
      anim.onfinish = () => {
        ghost.remove();
        document.querySelectorAll("[data-cart-target]").forEach((el) => {
          el.animate(
            [{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }],
            { duration: 360, easing: "ease-out" },
          );
        });
      };
    }),
  );
}

const noise = (n = 1) => n / 2 - Math.random() * n;

/** Gooey burst + "Added" pill on the tapped add button (from the gooey example). */
function gooeyAdded(btn: HTMLElement, reduce: boolean) {
  if (getComputedStyle(btn).position === "static") btn.style.position = "relative";
  btn.querySelector(".atc-added")?.remove();
  const pill = document.createElement("span");
  pill.className = "atc-added";
  pill.setAttribute("aria-hidden", "true");
  pill.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Added';
  btn.appendChild(pill);
  window.setTimeout(() => pill.classList.add("out"), 1200);
  window.setTimeout(() => pill.remove(), 1600);
  if (reduce) return;

  if (!document.getElementById("atc-goo-filter")) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:absolute;width:0;height:0";
    svg.innerHTML =
      '<filter id="atc-goo-filter" color-interpolation-filters="sRGB" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b"/><feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"/></filter>';
    document.body.appendChild(svg);
  }
  document.querySelectorAll(".atc-goo-wrap").forEach((n) => n.remove());
  const r = btn.getBoundingClientRect();
  const pad = 110;
  const W = r.width + pad * 2, H = r.height + pad * 2;
  const rad = Math.min(parseFloat(getComputedStyle(btn).borderTopLeftRadius) || 0, r.height / 2, r.width / 2);
  // Wrapper is masked with a button-shaped hole so dots pass BEHIND the button, like the example.
  const wrap = document.createElement("span");
  wrap.className = "atc-goo-wrap";
  wrap.setAttribute("aria-hidden", "true");
  Object.assign(wrap.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${W}px`, height: `${H}px` });
  const x = pad, y = pad, w = r.width, h = r.height, k = rad;
  const hole = `M${x + k} ${y}H${x + w - k}A${k} ${k} 0 0 1 ${x + w} ${y + k}V${y + h - k}A${k} ${k} 0 0 1 ${x + w - k} ${y + h}H${x + k}A${k} ${k} 0 0 1 ${x} ${y + h - k}V${y + k}A${k} ${k} 0 0 1 ${x + k} ${y}Z`;
  const svgMask = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'><path fill-rule='evenodd' d='M0 0H${W}V${H}H0Z ${hole}'/></svg>`;
  const url = `url("data:image/svg+xml,${encodeURIComponent(svgMask)}")`;
  wrap.style.setProperty("mask-image", url);
  wrap.style.setProperty("-webkit-mask-image", url);
  const fx = document.createElement("span");
  fx.className = "atc-goo";
  // Include the example's pill INSIDE the filter so nearby dots join its edge.
  // The outer mask is applied afterwards, keeping the actual button untouched.
  fx.style.setProperty("--atc-button-width", `${r.width}px`);
  fx.style.setProperty("--atc-button-height", `${r.height}px`);
  fx.style.setProperty("--atc-button-radius", `${rad}px`);
  wrap.appendChild(fx);
  document.body.appendChild(wrap);
  // Same params as the example: 15 particles, distance [90 -> 10], 600ms base, 300ms variance
  const count = 15, animationTime = 600, variance = 300, d = [90, 10], rr = 100;
  const palette = getComputedStyle(document.documentElement);
  const colors = ["--atc-red", "--atc-pink", "--atc-deep-red", "--atc-coral", "--atc-red"].map((token) => palette.getPropertyValue(token).trim());
  // Copy the reference generator exactly: X and Y each get their own noise.
  const getXY = (distance: number, pointIndex: number, totalPoints: number) => {
    const x = distance * Math.cos(((360 + noise(8)) / totalPoints * pointIndex) * Math.PI / 180);
    const y = distance * Math.sin(((360 + noise(8)) / totalPoints * pointIndex) * Math.PI / 180);
    return [x, y];
  };
  const createParticle = (i: number, t: number) => {
    const rotate = noise(rr / 10);
    return {
      start: getXY(d[0], count - i, count),
      end: getXY(d[1] + noise(7), count - i, count),
      time: t,
      scale: 1 + noise(0.2),
      color: colors[Math.floor(Math.random() * colors.length)],
      rotate: rotate > 0 ? (rotate + rr / 20) * 10 : (rotate - rr / 20) * 10,
    };
  };
  fx.style.setProperty("--time", `${animationTime * 2 + variance}ms`);
  for (let i = 0; i < count; i++) {
    const t = animationTime * 2 + noise(variance * 2);
    const particle = createParticle(i, t);
    window.setTimeout(() => {
      const p = document.createElement("span");
      p.className = "atc-particle";
      p.style.cssText = `--sx:${particle.start[0]}px;--sy:${particle.start[1]}px;--ex:${particle.end[0]}px;--ey:${particle.end[1]}px;--time:${particle.time}ms;--scale:${particle.scale};--rotate:${particle.rotate}deg;--pc:${particle.color}`;
      const point = document.createElement("span");
      point.className = "atc-point";
      p.appendChild(point);
      fx.appendChild(p);
      requestAnimationFrame(() => fx.classList.add("active"));
      window.setTimeout(() => p.remove(), t);
    }, 30);
  }
  window.setTimeout(() => wrap.remove(), 2000);
}
