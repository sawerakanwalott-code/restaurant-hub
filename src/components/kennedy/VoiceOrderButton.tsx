import { FormEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Flame, MessageCircle, Mic, MicOff, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type Turn = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const STORAGE_KEY = "kennedy-takiii-guest-chat";
const WELCOME_TURN: Turn = {
  id: "takiii-welcome",
  role: "assistant",
  content: "Assalam-o-alaikum! Main Takiii hoon. Aaj kya khana pasand karein ge?",
};

function readSavedTurns(): Turn[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return [WELCOME_TURN];
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [WELCOME_TURN];
    return parsed.filter(
      (turn): turn is Turn =>
        typeof turn === "object" &&
        turn !== null &&
        "id" in turn &&
        "role" in turn &&
        "content" in turn &&
        typeof turn.id === "string" &&
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.content === "string",
    );
  } catch {
    return [WELCOME_TURN];
  }
}

export function VoiceOrderButton() {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([WELCOME_TURN]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTurns(readSavedTurns());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(turns));
  }, [mounted, turns]);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 180);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [reduceMotion, turns]);

  const closePanel = () => {
    setListening(false);
    setOpen(false);
  };

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setTurns((current) => [
      ...current,
      { id: `guest-${Date.now()}`, role: "user", content },
    ]);
    setDraft("");
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  if (!mounted) return null;

  return (
    <>
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 24, delay: 0.35 }}
        className="fixed right-4 z-[150] sm:right-7"
        style={{ bottom: "calc(1rem + var(--kmg-cart-bar, 0px) + env(safe-area-inset-bottom))" }}
      >
        <Button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Chat with Takiii"
          className="takiii-launcher group h-14 rounded-full px-2.5 pr-4 text-cream sm:h-16 sm:px-3 sm:pr-5"
        >
          <span className="takiii-launcher__spark takiii-launcher__spark--one" aria-hidden="true" />
          <span className="takiii-launcher__spark takiii-launcher__spark--two" aria-hidden="true" />
          <span className="takiii-launcher__icon grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream text-flame sm:h-11 sm:w-11">
            <Flame className="h-5 w-5 fill-current sm:h-6 sm:w-6" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col items-start text-left leading-tight">
            <span className="font-display text-sm font-extrabold tracking-normal">Takiii</span>
            <span className="font-body text-[0.65rem] font-bold text-cream/80 sm:text-xs">Ask about the menu</span>
          </span>
          <Sparkles className="ml-1 h-5 w-5 transition-transform group-hover:rotate-12" aria-hidden="true" />
        </Button>
      </motion.div>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close Takiii chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePanel}
              className="fixed inset-0 z-[290] cursor-default bg-charcoal/45 backdrop-blur-sm sm:bg-charcoal/20"
            />

            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="takiii-title"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 34, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              className="fixed inset-x-0 bottom-0 z-[300] flex max-h-[82svh] min-h-[34rem] flex-col overflow-hidden rounded-t-2xl border border-charcoal/15 bg-cream shadow-[0_-18px_60px_oklch(0.28_0.03_40/0.35)] sm:inset-x-auto sm:bottom-24 sm:right-7 sm:h-[36rem] sm:min-h-0 sm:w-[25rem] sm:rounded-2xl"
            >
              <header className="relative flex items-center gap-3 overflow-hidden bg-flame px-4 py-4 text-cream">
                <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full border-[18px] border-cream/10" />
                <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cream text-flame shadow-[var(--shadow-card)]">
                  <Flame className="h-6 w-6 fill-current" aria-hidden="true" />
                </span>
                <div className="relative min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 id="takiii-title" className="font-display text-lg font-extrabold tracking-normal">Takiii</h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-charcoal/18 px-2 py-0.5 font-body text-[0.65rem] font-bold">
                      <span className="h-1.5 w-1.5 rounded-full bg-cream" /> Guest chat
                    </span>
                  </div>
                  <p className="truncate font-body text-xs font-semibold text-cream/80">Kennedy&apos;s food companion</p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={closePanel}
                  aria-label="Close"
                  className="relative rounded-full text-cream hover:bg-cream/15 hover:text-cream"
                >
                  <X aria-hidden="true" />
                </Button>
              </header>

              <div ref={transcriptRef} className="flex-1 space-y-4 overflow-y-auto bg-cream px-4 py-5" aria-live="polite">
                <div className="flex items-center gap-3 text-charcoal/50">
                  <span className="h-px flex-1 bg-charcoal/10" />
                  <span className="font-body text-[0.65rem] font-extrabold uppercase tracking-wider">Today</span>
                  <span className="h-px flex-1 bg-charcoal/10" />
                </div>

                {turns.map((turn) => (
                  <motion.div
                    key={turn.id}
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={turn.role === "user" ? "flex justify-end" : "flex items-end gap-2"}
                  >
                    {turn.role === "assistant" && (
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-flame text-cream">
                        <Flame className="h-4 w-4 fill-current" aria-hidden="true" />
                      </span>
                    )}
                    <div
                      className={
                        turn.role === "user"
                          ? "max-w-[82%] rounded-2xl rounded-br-sm bg-charcoal px-4 py-3 font-body text-sm leading-relaxed text-cream shadow-[var(--shadow-card)]"
                          : "max-w-[82%] rounded-2xl rounded-bl-sm border border-charcoal/10 bg-cream-deep px-4 py-3 font-body text-sm leading-relaxed text-charcoal"
                      }
                    >
                      {turn.content}
                    </div>
                  </motion.div>
                ))}

                {listening && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mx-auto flex w-fit items-center gap-2 rounded-full bg-flame/10 px-4 py-2 font-body text-xs font-extrabold text-flame"
                  >
                    <span className="h-2 w-2 animate-pulse rounded-full bg-flame" /> Listening…
                  </motion.div>
                )}
              </div>

              <form onSubmit={sendMessage} className="border-t border-charcoal/10 bg-cream-deep p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="flex items-end gap-2 rounded-2xl border border-charcoal/15 bg-cream p-2 shadow-[inset_0_1px_0_color-mix(in_oklch,var(--color-cream)_80%,transparent)] focus-within:border-flame/55">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setListening((current) => !current)}
                    aria-label={listening ? "Stop microphone" : "Use microphone"}
                    title={listening ? "Stop microphone" : "Use microphone"}
                    className={listening ? "shrink-0 rounded-full bg-flame text-cream hover:bg-flame-dark hover:text-cream" : "shrink-0 rounded-full text-flame hover:bg-flame/10 hover:text-flame"}
                  >
                    {listening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
                  </Button>
                  <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    rows={1}
                    placeholder="Message Takiii…"
                    aria-label="Message Takiii"
                    className="max-h-24 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 font-body text-sm text-charcoal outline-none placeholder:text-charcoal/45"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!draft.trim()}
                    aria-label="Send message"
                    className="shrink-0 rounded-full bg-charcoal text-cream hover:bg-flame"
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                </div>
              </form>
            </motion.section>
          </>
        )}
      </AnimatePresence>
    </>
  );
}