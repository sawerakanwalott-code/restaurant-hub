import { useEffect, useRef, useState } from "react";
import { Crown, Delete, Loader2, LockKeyhole } from "lucide-react";

/**
 * Extra lock on top of the superuser login. This is a convenience gate for a
 * shared/unattended screen — the real protection is still the backend login.
 * Code comes from VITE_PLATFORM_LOCK_CODE (default 1234).
 */
const LOCK_CODE = String((import.meta.env["VITE_PLATFORM_LOCK_CODE"] as string | undefined) ?? "1234").trim() || "1234";
const LEN = LOCK_CODE.length;
export const UNLOCK_KEY = "kmg.platform.unlocked";

export function LockScreen({ onUnlock, onFail }: { onUnlock: () => void; onFail?: () => void }) {
  const [entering, setEntering] = useState(false);
  const [pin, setPin] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "error" | "opening">("idle");
  const [now, setNow] = useState<Date | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!entering && (e.key === "Enter" || e.key === " " || /^\d$/.test(e.key))) {
        setEntering(true);
        if (/^\d$/.test(e.key)) press(e.key);
        return;
      }
      if (!entering) return;
      if (e.key === "Escape") cancel();
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (/^\d$/.test(e.key)) press(e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (entering) inputRef.current?.focus();
  }, [entering]);

  function press(d: string) {
    if (state === "checking" || state === "opening") return;
    setState("idle");
    setPin((p) => {
      const next = (p + d).slice(0, LEN);
      if (next.length === LEN) verify(next);
      return next;
    });
  }

  function verify(code: string) {
    setState("checking");
    setTimeout(() => {
      if (code === LOCK_CODE) {
        // Doors slide apart first (1.05s), then the console unlocks.
        setState("opening");
        setTimeout(() => {
          sessionStorage.setItem(UNLOCK_KEY, String(Date.now()));
          onUnlock();
        }, 1050);
      } else {
        setState("error");
        setPin("");
        onFail?.();
      }
    }, 550);
  }

  function cancel() {
    setEntering(false);
    setPin("");
    setState("idle");
  }

  const time = now ? now.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--";
  const date = now ? now.toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long" }) : "";

  return (
    <div className={`pf-lock ${entering ? "entering" : ""} ${state === "error" ? "error" : ""} ${state === "opening" ? "opening" : ""}`} onClick={() => !entering && setEntering(true)}>
      <div className="pf-lock-doors" aria-hidden="true">
        <div className="pf-lock-door left" />
        <div className="pf-lock-door right" />
      </div>
      <div className="pf-lock-brand">
        <div className="pf-lock-brand-icon"><Crown className="h-6 w-6" /></div>
        <div>
          <h2>Kennedy Platform</h2>
          <p>Owner console · locked</p>
        </div>
      </div>

      <div className="pf-lock-info">
        <div className="pf-lock-time">{time}</div>
        <div className="pf-lock-date">{date}</div>
        <div className="pf-lock-date" style={{ fontSize: 15, opacity: 0.85 }}>Welcome back — unlock to continue</div>
      </div>

      <div className="pf-lock-cta">
        <button className="pf-clear-btn" onClick={(e) => { e.stopPropagation(); setEntering(true); }} aria-label="Unlock">
          <LockKeyhole className="h-5 w-5" /> Unlock
        </button>
      </div>

      <div className="pf-pin-wrap" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          inputMode="numeric"
          aria-label="Lock code"
          value=""
          onChange={() => {}}
          style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
        />
        <div className="pf-pin" onClick={() => inputRef.current?.focus()}>
          {Array.from({ length: LEN }).map((_, i) => (
            <div key={i} className={`pf-pin-digit ${i < pin.length ? "filled" : ""} ${i === pin.length && state !== "checking" ? "focused" : ""}`} />
          ))}
        </div>
        <div className="pf-pin-label">
          {state === "checking" ? (
            <Loader2 className="pf-spin mx-auto h-7 w-7" />
          ) : (
            <>
              {state === "error" ? <span className="err">Wrong code</span> : <span>Enter your {LEN}-digit code</span>}
              <button onClick={cancel}>Cancel</button>
            </>
          )}
        </div>
        <div className="pf-keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} onClick={() => press(d)}>{d}</button>
          ))}
          <span />
          <button onClick={() => press("0")}>0</button>
          <button aria-label="Delete" onClick={() => setPin((p) => p.slice(0, -1))}><Delete className="mx-auto h-5 w-5" /></button>
        </div>
      </div>
    </div>
  );
}
