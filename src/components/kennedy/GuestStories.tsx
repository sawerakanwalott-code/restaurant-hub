/**
 * GUEST STORIES — liquid-glass testimonial cards with a Makisu-style paper
 * fold reveal, ported from the provided prototype. Cards unfold as they
 * scroll into view and fold back when scrolled past. FAQ keeps the shared
 * accessible accordion. Stories are illustrative samples, never presented
 * as verified customer reviews.
 */
import { useEffect, useRef, type CSSProperties } from "react";
import { MessageCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import guestOne from "@/assets/kennedy-guest-1.webp";
import guestTwo from "@/assets/kennedy-guest-2.webp";
import guestThree from "@/assets/kennedy-guest-3.webp";
import guestFour from "@/assets/kennedy-guest-4.webp";

const STORIES = [
  { name: "The pizza lover", dish: "Pizza night", image: guestOne, panel: "var(--color-flame)", nameColor: "var(--color-cream)", quote: "That first cheesy slice, a little heat, and a table full of friends. My kind of pizza night." },
  { name: "The burger fan", dish: "Burger cravings", image: guestTwo, panel: "var(--color-gold)", nameColor: "var(--color-flame-dark)", quote: "A big burger, a proper appetite, and no sharing. Some cravings deserve their own order." },
  { name: "The desi foodie", dish: "Pakistani favourites", image: guestThree, panel: "var(--color-flame)", nameColor: "var(--color-cream)", quote: "Give me smoky grills and a good karahi. Desi comfort food always brings everyone together." },
  { name: "The family host", dish: "Something for everyone", image: guestFour, panel: "var(--color-gold)", nameColor: "var(--color-flame-dark)", quote: "Pizza for one, burgers for another, Pakistani favourites for the rest. That’s a happy family table." },
];
const FAQS = [
  { question: "What’s on the Kennedy menu?", answer: "Burgers, pizza, and Pakistani favourites. Browse the current menu for available dishes, sizes, and prices." },
  { question: "How do I place an order?", answer: "Choose a dish from the menu, add it to your cart, and continue to checkout. You can review your items before confirming." },
  { question: "Can I check ingredients before ordering?", answer: "Open a dish to see its description and any listed ingredients or allergens. If you have a food allergy, confirm suitability with the restaurant before ordering." },
  { question: "Which payment options can I use?", answer: "Choose from the payment options shown at checkout, including Cash on Delivery, JazzCash, and EasyPaisa." },
  { question: "Where can I follow my order?", answer: "Open your profile’s live-order view to check the status of an active order. When available, the Order live tab takes you there directly." },
];

type GuestCard = HTMLElement & { _open?: boolean; _want?: boolean; _rig?: HTMLElement | null };

export function GuestStories() {
  const reduced = useReducedMotion();
  const gridRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    const title = titleRef.current;
    if (!grid || !title) return;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>(".scroll-fold"));
    cards.forEach((card) => card.classList.add("fold-enabled"));

    if (reduced) {
      cards.forEach((c) => c.classList.add("ready"));
      title.classList.add("visible");
      return;
    }

    const N = 3, SPEED = 900, OVERLAP = 0.5; // N = number of big folds per card
    const mk = (cls: string, css?: Partial<CSSStyleDeclaration>) => {
      const d = document.createElement("div");
      d.className = cls;
      if (css) Object.assign(d.style, css);
      return d;
    };

    const unfold = (card: HTMLElement) => {
      const c = card as GuestCard;
      if (c._open) return;
      c._open = true;
      const H = card.offsetHeight, sh = Math.ceil(H / N), time = SPEED * (1 - OVERLAP);
      const rig = mk("fold-rig");
      rig.setAttribute("aria-hidden", "true");
      rig.inert = true;
      card.appendChild(rig);
      c._rig = rig;
      const src = Array.from(card.children).filter(
        (n) => n instanceof HTMLElement && !n.classList.contains("fold-rig") && !n.classList.contains("liquidGlass-effect"),
      );
      let parent: HTMLElement = rig;
      const parts: { node: HTMLElement; over: HTMLElement }[] = [];
      for (let i = 0; i < N; i++) {
        const h = i === N - 1 ? H - sh * (N - 1) : sh;
        const node = mk("node");
        const item = mk("item" + (i === 0 ? " first" : "") + (i === N - 1 ? " last" : ""));
        const inner = mk("inner", { height: h + "px" });
        const clone = mk("clone", { top: -i * sh + "px", height: H + "px", width: "100%" });
        src.forEach((n) => clone.appendChild(n.cloneNode(true)));
        inner.appendChild(clone);
        const back = mk("face back");
        const over = mk("face over");
        item.append(inner, back, over);
        node.appendChild(item);
        parent.appendChild(node);
        parent = node;
        node.style.transform = i === 0 ? "rotateX(-90deg)" : "rotateX(180deg)";
        parts.push({ node, over });
      }
      parts.forEach((x, i) => {
        const kf = i === 0 ? ["rotateX(-90deg)", "rotateX(60deg)", "rotateX(0deg)"] : ["rotateX(180deg)", "rotateX(-30deg)", "rotateX(0deg)"];
        const a = x.node.animate(kf.map((t) => ({ transform: t })), { duration: SPEED, delay: i * time, easing: "ease-in-out", fill: "both" });
        x.over.animate([{ opacity: 1 }, { opacity: 0 }], { duration: SPEED * 0.45, delay: (i < N - 1 ? i + 1 : i) * time, easing: "ease-in-out", fill: "both" });
        if (i === N - 1) {
          a.onfinish = () => {
            if (c._rig !== rig) return;
            card.classList.add("ready");
            setTimeout(() => {
              if (c._rig === rig) {
                rig.remove();
                c._rig = null;
              }
            }, 350);
          };
        }
      });
    };

    const fold = (card: HTMLElement) => {
      const c = card as GuestCard;
      if (!c._open) return;
      c._open = false;
      card.classList.remove("ready");
      if (c._rig) {
        c._rig.remove();
        c._rig = null;
      }
    };

    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          const card = e.target as GuestCard;
          if (e.isIntersecting && e.intersectionRatio >= 0.3) {
            setTimeout(() => {
              if (card._want) unfold(card);
            }, (cards.indexOf(card) % 4) * 130);
            card._want = true;
          } else if (!e.isIntersecting && e.boundingClientRect.top > 0) {
            card._want = false;
            fold(card);
          }
        }),
      { threshold: [0, 0.3] },
    );
    cards.forEach((c) => io.observe(c));

    const tio = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            title.classList.add("visible");
            tio.disconnect();
          }
        }),
      { threshold: 0.5 },
    );
    tio.observe(title);

    return () => {
      io.disconnect();
      tio.disconnect();
      cards.forEach((card) => {
        const c = card as GuestCard;
        c._open = false;
        c._want = false;
        c._rig?.remove();
        c._rig = null;
        card.classList.remove("ready");
        card.classList.remove("fold-enabled");
      });
      title.classList.remove("visible");
    };
  }, [reduced]);

  return (
    <div ref={gridRef}>
      <section className="guest-stories" aria-labelledby="guest-stories-title">
        <div className="community-heading" ref={titleRef}>
          <span className="community-eyebrow">Around the Kennedy table</span>
          <h2 id="guest-stories-title">
            Good food.
            <br />
            <em>Better company.</em>
          </h2>
          <p>Burgers, pizza &amp; Pakistani favourites. A craving for every seat.</p>
          <span className="guest-stories__sample">Sample guest stories</span>
        </div>

        <div className="guest-stories__grid">
          {STORIES.map((story) => (
            <div key={story.name} className="liquidGlass-wrapper guest-card scroll-fold">
              <div className="liquidGlass-effect" />
              <div className="liquidGlass-tint" />
              <div className="liquidGlass-shine" />
              <div className="liquidGlass-text card-body">
                <div className="avatar" style={{ "--panel": story.panel, "--name-c": story.nameColor } as CSSProperties}>
                  <div className="avatar-img">
                    <img src={story.image} alt={story.name} width={240} height={320} loading="lazy" decoding="async" />
                  </div>
                  <p>{story.name}</p>
                </div>
                <div className="qmark" aria-hidden="true">“</div>
                <p className="quote">{story.quote}</p>
                <p className="role">{story.dish}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <svg className="guest-glass-filter" aria-hidden="true" focusable="false">
        <filter id="kennedy-glass-distortion" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">
          <feTurbulence type="fractalNoise" baseFrequency="0.01 0.01" numOctaves="1" seed="5" result="turbulence" />
          <feComponentTransfer in="turbulence" result="mapped">
            <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
            <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
            <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
          </feComponentTransfer>
          <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
          <feSpecularLighting in="softMap" surfaceScale="5" specularConstant="1" specularExponent="100" lighting-color="white" result="specLight">
            <fePointLight x="-200" y="-200" z="300" />
          </feSpecularLighting>
          <feComposite in="specLight" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litImage" />
          <feDisplacementMap in="SourceGraphic" in2="softMap" scale="60" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      <section className="kennedy-faq" aria-labelledby="kennedy-faq-title">
        <div className="community-heading community-heading--faq">
          <span className="community-eyebrow"><MessageCircle aria-hidden="true" /> A little food for thought</span>
          <h2 id="kennedy-faq-title">
            Got questions?
            <br />
            <em>We’ve got you.</em>
          </h2>
          <p>Before the first bite.</p>
        </div>
        <Accordion type="single" collapsible className="kennedy-faq__list">
          {FAQS.map((faq, index) => (
            <AccordionItem key={faq.question} value={`faq-${index}`} className="kennedy-faq__item scroll-fold faq-fold">
              <AccordionTrigger className="kennedy-faq__trigger"><span className="kennedy-faq__number">0{index + 1}</span><span>{faq.question}</span></AccordionTrigger>
              <AccordionContent className="kennedy-faq__answer">{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}
