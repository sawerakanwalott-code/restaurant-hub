import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, KeyRound, Loader2, Lock, MessageSquare, Phone, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OtpCodeFields } from "@/components/kennedy/OtpCodeFields";
import { fetchPhoneOtpConfig, requestPhoneCode, verifyPhoneCode, type PhoneOtpConfig } from "@/lib/auth";
import { normalizePkPhone } from "@/lib/validation";

interface LuxuryOtpWidgetProps {
  phone: string;
  name?: string;
  isVerified: boolean;
  onVerified: (account: any) => void;
  className?: string;
}

export function LuxuryOtpWidget({
  phone,
  name,
  isVerified,
  onVerified,
  className = "",
}: LuxuryOtpWidgetProps) {
  const reduceMotion = useReducedMotion();
  const [config, setConfig] = useState<PhoneOtpConfig>({
    whatsapp_connected: true, // optimistic default
    default_channel: "whatsapp",
    channels: ["whatsapp", "sms"],
  });
  const [selectedChannel, setSelectedChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [actualSentChannel, setActualSentChannel] = useState<"whatsapp" | "sms">("whatsapp");

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const cleanPhone = normalizePkPhone(phone.trim());

  // Check WhatsApp connection status on mount
  useEffect(() => {
    let active = true;
    void fetchPhoneOtpConfig().then((cfg) => {
      if (!active) return;
      setConfig(cfg);
      if (!cfg.whatsapp_connected) {
        setSelectedChannel("sms");
      } else {
        setSelectedChannel(cfg.default_channel || "whatsapp");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const isWaAvailable = config.whatsapp_connected;

  const handleSend = async (overrideChannel?: "whatsapp" | "sms") => {
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error("Enter phone number", {
        description: "Please enter your 11-digit mobile number above first.",
      });
      return;
    }

    const channelToUse = overrideChannel || (isWaAvailable ? selectedChannel : "sms");
    setSending(true);
    try {
      const res = await requestPhoneCode(cleanPhone, channelToUse);
      const usedChannel = (res.channel === "sms" || !res.sent_via_whatsapp) ? "sms" : "whatsapp";
      setActualSentChannel(usedChannel);
      setSent(true);
      setCode("");

      toast.success("Code sent", { description: `Check ${usedChannel === "whatsapp" ? "WhatsApp" : "your SMS messages"}.` });
    } catch (err: any) {
      toast.error("Could not send OTP", {
        description: err?.message || "Please check your number and try again.",
      });
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (explicitCode?: string) => {
    const finalCode = (explicitCode ?? code).trim();
    if (!cleanPhone) return;
    if (!finalCode || finalCode.length < 6) {
      toast.error("Incomplete Code", {
        description: "Please enter the full 6-digit OTP code received on your phone.",
      });
      return;
    }

    setVerifying(true);
    try {
      const res = await verifyPhoneCode(cleanPhone, finalCode, name);
      onVerified(res.account);

      toast.success("Phone verified");
    } catch (err: any) {
      toast.error("Verification Failed", {
        description: err?.message || "Invalid or expired OTP code. Please check the code and try again.",
      });
    } finally {
      setVerifying(false);
    }
  };

  if (isVerified) {
    return (
      <motion.div initial={reduceMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`checkout-otp checkout-otp--verified ${className}`} role="status">
        <ShieldCheck className="h-5 w-5 shrink-0 text-flame" aria-hidden="true" />
        <span className="flex-1 font-body text-sm text-charcoal">Phone verified <span className="text-charcoal/60">· {phone}</span></span>
        <Lock className="h-4 w-4 shrink-0 text-flame" aria-label="Phone locked" />
      </motion.div>
    );
  }

  return (
    <div className={`checkout-otp ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-flame" aria-hidden="true" />
          <span className="font-body text-sm font-bold text-charcoal">Verify phone</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isWaAvailable && (
            <div className="checkout-otp__channels" role="group" aria-label="Code delivery method">
              <Button variant="ghost" type="button" disabled={sending || verifying} aria-pressed={selectedChannel === "whatsapp"} onClick={() => setSelectedChannel("whatsapp")}><MessageSquare aria-hidden="true" /> WhatsApp</Button>
              <Button variant="ghost" type="button" disabled={sending || verifying} aria-pressed={selectedChannel === "sms"} onClick={() => setSelectedChannel("sms")}><Phone aria-hidden="true" /> SMS</Button>
            </div>
          )}
          <Button variant="ghost" type="button" disabled={sending || verifying} onClick={() => void handleSend()} className="checkout-otp__send">
            {sending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
            {sending ? "Sending…" : sent ? "Resend code" : "Send code"}
          </Button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {sent && (
          <motion.div initial={reduceMotion ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: reduceMotion ? 0 : 0.22 }} className="overflow-hidden">
            <div className="space-y-3 pt-4">
              <p className="font-body text-xs text-charcoal/65" role="status">Code sent to {phone} via {actualSentChannel === "whatsapp" ? "WhatsApp" : "SMS"}.</p>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <OtpCodeFields value={code} onChange={setCode} onComplete={(value) => void handleVerify(value)} disabled={verifying || sending} />
                <Button variant="ghost" type="button" disabled={verifying || sending || code.length < 6} onClick={() => void handleVerify()} className="checkout-otp__send">
                  {verifying ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                  {verifying ? "Verifying…" : "Verify"}
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 font-body text-xs text-charcoal/60">
                <span>Expires in 10 minutes</span>
                {actualSentChannel === "whatsapp" && <Button variant="ghost" type="button" disabled={sending || verifying} onClick={() => { setSelectedChannel("sms"); void handleSend("sms"); }} className="h-auto px-0 py-1 text-xs text-flame"><RotateCcw aria-hidden="true" /> Send via SMS instead</Button>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
