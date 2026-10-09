import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bot, Check, CheckCircle2, Copy, FileUp, ShieldCheck, Sparkles, Wallet, X } from "lucide-react";
import { toast } from "sonner";

export type WalletStep = "ready" | "pay" | "upload" | "done";

type Props = {
  method: "jazzcash" | "easypaisa";
  amount: number;
  step: WalletStep;
  onStep: (s: WalletStep) => void;
  /** Receives the proof file; backend upload attaches later. */
  onProof: (file: File | null) => void;
};

/**
 * Presentation-only wallet checkout: ready → payment card → proof upload.
 * Account details are placeholders until till IDs come from the backend.
 */
export function WalletPayFlow({ method, amount, step, onStep, onProof }: Props) {
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0);
  const label = method === "jazzcash" ? "JazzCash" : "Easypaisa";

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return void toast.error("File too large", { description: "Max 8 MB." });
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
    setProgress(0);
    let p = 0;
    const t = window.setInterval(() => {
      p += 20;
      setProgress(p);
      if (p >= 100) { window.clearInterval(t); onProof(f); onStep("done"); }
    }, reduce ? 10 : 160);
  };

  const clear = () => {
    setFile(null); setPreview(null); setProgress(0); onProof(null); onStep("upload");
    if (inputRef.current) inputRef.current.value = "";
  };

  const copy = (v: string) => { void navigator.clipboard?.writeText(v); toast.success("Copied"); };
  const anim = reduce ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } };

  return (
    <div className="mt-4">
      <AnimatePresence mode="wait">
        {step === "ready" && (
          <motion.button key="ready" {...anim} type="button" onClick={() => onStep("pay")}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-flame/50 bg-flame/5 py-4 font-display text-xs font-extrabold uppercase tracking-[0.16em] text-flame">
            <Wallet className="h-4 w-4" aria-hidden="true" /> Ready for payment · Rs {amount}
          </motion.button>
        )}

        {step === "pay" && (
          <motion.div key="pay" {...anim} className="space-y-3">
            <div className="relative overflow-hidden rounded-2xl bg-charcoal p-5 text-cream shadow-[0_18px_40px_rgba(20,14,10,0.3)]">
              <motion.span aria-hidden="true" className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-flame/40 blur-2xl"
                animate={reduce ? undefined : { x: [0, -14, 0], y: [0, 10, 0] }} transition={{ duration: 6, repeat: Infinity }} />
              <div className="relative flex items-center justify-between">
                <span className="font-display text-sm font-extrabold uppercase tracking-[0.18em]">{label}</span>
                <Sparkles className="h-4 w-4 text-flame" aria-hidden="true" />
              </div>
              <p className="relative mt-5 font-body text-[10px] uppercase tracking-[0.2em] text-cream/55">Account / Till ID</p>
              <button type="button" onClick={() => copy("0300 0000000")} className="relative mt-1 flex items-center gap-2 font-display text-xl font-extrabold tracking-widest">
                0300 0000000 <Copy className="h-4 w-4 text-cream/60" aria-hidden="true" />
              </button>
              <div className="relative mt-4 flex items-end justify-between">
                <div><p className="font-body text-[10px] uppercase tracking-[0.2em] text-cream/55">Title</p><p className="font-display text-sm font-extrabold">Moon Grill</p></div>
                <div className="text-right"><p className="font-body text-[10px] uppercase tracking-[0.2em] text-cream/55">Send</p><p className="font-display text-lg font-extrabold text-flame">Rs {amount}</p></div>
              </div>
            </div>
            <p className="font-body text-[11px] text-charcoal/60">Send the exact amount from your {label} app, then confirm below.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => onStep("ready")} className="rounded-xl border-2 border-charcoal/12 px-4 font-display text-xs font-extrabold uppercase tracking-[0.14em] text-charcoal/70">Back</button>
              <button type="button" onClick={() => onStep("upload")} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-charcoal py-3 font-display text-xs font-extrabold uppercase tracking-[0.14em] text-cream">
                <Check className="h-4 w-4" aria-hidden="true" /> I've paid
              </button>
            </div>
          </motion.div>
        )}

        {(step === "upload" || step === "done") && (
          <motion.div key="upload" {...anim}>
            <input ref={inputRef} type="file" accept="image/*,application/pdf" className="sr-only" id="pay-proof" onChange={(e) => pick(e.target.files?.[0])} />
            {!file ? (
              <label htmlFor="pay-proof"
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center transition-colors ${drag ? "border-flame bg-flame/10" : "border-charcoal/20 bg-cream"}`}>
                <motion.span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-flame text-cream"
                  animate={reduce ? undefined : drag ? { scale: 1.15, rotate: [0, -8, 8, 0] } : { y: [0, -6, 0] }}
                  transition={{ duration: drag ? 0.5 : 2.2, repeat: drag ? 0 : Infinity }}>
                  <Bot className="h-7 w-7" aria-hidden="true" />
                </motion.span>
                <span className="font-display text-xs font-extrabold uppercase tracking-[0.16em] text-charcoal">Hand your receipt to caddy</span>
                <span className="flex items-center gap-1 font-body text-[11px] text-charcoal/60"><FileUp className="h-3.5 w-3.5" aria-hidden="true" /> Screenshot or PDF · max 8 MB</span>
              </label>
            ) : (
              <div className="rounded-2xl border-2 border-charcoal/10 bg-cream p-3">
                <div className="flex items-center gap-3">
                  {preview ? <img src={preview} alt="Payment proof" className="h-14 w-14 rounded-xl object-cover" /> :
                    <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-charcoal/5"><FileUp className="h-6 w-6 text-charcoal/60" aria-hidden="true" /></span>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-xs font-extrabold text-charcoal">{file.name}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-charcoal/10">
                      <motion.div className="h-full bg-flame" animate={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-1 font-body text-[11px] text-charcoal/60" role="status">
                      {step === "done" ? "Caddy got it — ready to place order" : "Caddy is carrying your file…"}
                    </p>
                  </div>
                  {step === "done" ? <CheckCircle2 className="h-5 w-5 shrink-0 text-flame" aria-hidden="true" /> : null}
                  <button type="button" aria-label="Remove file" onClick={clear} className="rounded-full p-1 text-charcoal/50 hover:text-flame"><X className="h-4 w-4" aria-hidden="true" /></button>
                </div>
              </div>
            )}
            <p className="mt-2 flex items-center gap-1.5 font-body text-[11px] text-charcoal/55"><ShieldCheck className="h-3.5 w-3.5 text-flame" aria-hidden="true" /> The kitchen verifies your payment before cooking.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
