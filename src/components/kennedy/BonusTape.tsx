import { Flame, Gift, Pizza, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import truckImg from "@/assets/kennedy-truck.webp";

type Item = { label: string; Icon: typeof Flame };

const TOP: Item[] = [
  { label: "Malai Boti Platter — Rs 200 Off", Icon: Flame },
  { label: "Second Large Pizza — Half Price", Icon: Pizza },
];

const BOTTOM: Item[] = [
  { label: "Free Delivery Inside Narowal", Icon: Gift },
  { label: "Seekh Kebab Combo — Limited Today", Icon: Sparkles },
];

function Row({ items, reverse }: { items: Item[]; reverse?: boolean }) {
  return (
    <div className="tape-track" data-reverse={reverse ? "true" : undefined}>
      {[0, 1].map((copy) => (
        <div className="tape-row" key={copy} aria-hidden={copy === 1}>
          {items.map(({ label, Icon }, i) => (
            <span className="tape-item" key={`${copy}-${i}`}>
              <Icon className="tape-icon" aria-hidden="true" />
              <span>{label}</span>
              <span className="tape-dot" aria-hidden="true" />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function BonusTape() {
  const sectionRef = useRef<HTMLElement>(null);
  const [started, setStarted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let hasScrolled = false;
    const onScroll = () => {
      hasScrolled = true;
      const bounds = section.getBoundingClientRect();
      if (bounds.top < window.innerHeight * 0.9 && bounds.bottom > 0) {
        setStarted(true);
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(Boolean(entry?.isIntersecting));
      if (entry?.isIntersecting && hasScrolled) setStarted(true);
    }, { threshold: 0.25 });
    observer.observe(section);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="tape-section truck-tape-section"
      data-started={started ? "true" : undefined}
      data-visible={visible ? "true" : undefined}
      aria-label="Today's deals and bonus offers"
    >
      {started && <div className="offer-truck" aria-hidden="true">
        <img
          src={truckImg}
          alt=""
          loading="lazy"
          decoding="async"
          width={1024}
          height={768}
        />
      </div>}
      <div className="ticket ticket--gold">
        <span className="ticket-badge">
          <Pizza aria-hidden="true" />
          <span>Crazy Deal</span>
        </span>
        <div className="ticket-window">
          <Row items={TOP} />
        </div>
      </div>
      <div className="ticket ticket--flame">
        <span className="ticket-badge">
          <Gift aria-hidden="true" />
          <span>Today's Bonus</span>
        </span>
        <div className="ticket-window">
          <Row items={BOTTOM} reverse />
        </div>
      </div>
    </section>
  );
}
