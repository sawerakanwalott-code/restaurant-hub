import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  sending: boolean;
  /** flips true once the code was delivered — triggers the "Sent!" reveal */
  sent: boolean;
  disabled?: boolean;
  showPlane?: boolean;
  doneLabel?: string;
  children: ReactNode;
};

/** The paper plane from the reference "Click to Send" design (points up). */
const PLANE_D =
  "M560.611 481.384C562.003 479.263 565.113 479.263 566.505 481.384L607.063 543.177C615.657 556.272 607.507 573.375 592.766 575.676L566.422 557.462V510.018C566.422 508.436 565.14 507.154 563.558 507.154C561.976 507.154 560.693 508.436 560.693 510.018V557.462L534.349 575.676C519.609 573.375 511.459 556.272 520.053 543.177L560.611 481.384Z";

function Plane({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="514 476 100 104" aria-hidden>
      <path d={PLANE_D} fill="currentColor" />
    </svg>
  );
}

/** Paper-plane button: squeezes into a bubble, plane loops out, lands as a tick. */
export function SendPlaneButton({ sending, sent, disabled, showPlane = true, doneLabel = "Sent!", children }: Props) {
  const [phase, setPhase] = useState<"idle" | "flying" | "sent">("idle");
  const wasSending = useRef(false);
  const sentAtStart = useRef(sent);

  useEffect(() => {
    if (sending) {
      if (!wasSending.current) sentAtStart.current = sent;
      wasSending.current = true;
      setPhase("flying");
      return undefined;
    }
    if (wasSending.current) {
      wasSending.current = false;
      if (sent && !sentAtStart.current) {
        setPhase("sent");
        const t = setTimeout(() => setPhase("idle"), 1700);
        return () => clearTimeout(t);
      }
      setPhase("idle");
    }
    return undefined;
  }, [sending, sent]);

  return (
    <div className="send-plane-wrap" data-phase={phase}>
      <button type="submit" disabled={disabled} aria-busy={sending} className={cn("auth-cta send-plane-btn")}>
        <span className="send-plane-label">
          {showPlane && <Plane className="send-plane-mini" />}
          {children}
        </span>
        <span className="send-plane-sent" aria-hidden={phase !== "sent"}>
          <svg viewBox="0 0 24 24" className="send-plane-tick" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {doneLabel}
        </span>
      </button>

      <div className="send-plane-sky" aria-hidden>
        <svg className="send-plane-route" viewBox="-160 -110 320 160">
          <path d="M0,0 C30,-50 90,-95 120,-60 C150,-25 70,30 30,20 C0,12 -10,-10 0,0" />
        </svg>
        <span className="send-plane-flyer">
          <Plane />
        </span>
      </div>
    </div>
  );
}
