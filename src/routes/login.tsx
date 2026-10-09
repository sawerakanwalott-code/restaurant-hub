import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Eye, EyeOff, KeyRound, Lock, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

import { VoltScene, VoltStrength } from "@/components/auth/chef-volt";
import { OtpCodeFields } from "@/components/kennedy/OtpCodeFields";
import { EMAIL_RE, pickLine, useChefVolt } from "@/hooks/use-chef-volt";
import {
  ROLE_HOME,
  phoneProblem,
  requestPhoneCode,
  signIn,
  verifyPhoneCode,
} from "@/lib/auth";
import { API_SLOW_DONE_EVENT, API_SLOW_EVENT, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { SendPlaneButton } from "@/components/auth/SendPlaneButton";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — Kennedy Moon Grill Account" },
      {
        name: "description",
        content:
          "Sign in to Kennedy Moon Grill — track live charcoal-grilled orders, saved addresses and rider updates in one place.",
      },
      { property: "og:title", content: "Sign In — Kennedy Moon Grill" },
      {
        property: "og:description",
        content: "One account for guests, kitchen staff, delivery riders and admin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const volt = useChefVolt("Welcome back — the charcoal is already glowing.");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWaking, setIsWaking] = useState(false);

  // SLICE 2.1 — customers sign in with a phone number and a 6-digit code.
  // Staff keep the password form.
  const [mode, setMode] = useState<"phone" | "password">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [otpChannel, setOtpChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [lastUsedChannel, setLastUsedChannel] = useState<string>("whatsapp");
  // SLICE 2.1b — sign-in is throttled to 5 attempts a minute. On a 429 we lock the
  // button and count down instead of letting the user hammer a blocked endpoint.
  const [lockedFor, setLockedFor] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (lockedFor <= 0) return;
    const t = setTimeout(() => setLockedFor((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [lockedFor]);

  // Railway free tier sleeps: the first request can take 10-30s. Show it.
  useEffect(() => {
    const slow = () => setIsWaking(true);
    const done = () => setIsWaking(false);
    window.addEventListener(API_SLOW_EVENT, slow);
    window.addEventListener(API_SLOW_DONE_EVENT, done);
    return () => {
      window.removeEventListener(API_SLOW_EVENT, slow);
      window.removeEventListener(API_SLOW_DONE_EVENT, done);
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (volt.done || isSubmitting) return;
    if (!email.trim()) {
      volt.complain("Enter your username or email first.");
      return;
    }
    if (!pass) {
      volt.complain("A password would help. Even a small one.");
      return;
    }

    setIsSubmitting(true);
    try {
      const account = await signIn(email, pass);
      // If superuser (Platform Owner), navigate directly to platform SaaS manager
      const target = account.isSuperuser ? "/platform" : (ROLE_HOME[account.role] || "/profile");
      volt.celebrate("Grill's hot. Welcome back to Kennedy Moon Grill!");
      toast.success(`Welcome back, ${account.name}`);
      navigate({ to: target });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 429) {
        setLockedFor(60);
        const friendlyMsg = "Too many login attempts! Please wait 1 minute before trying again.";
        volt.complain("Hold on! Too many attempts. Try again in 60 seconds.");
        toast.error(friendlyMsg);
      } else {
        const msg = err instanceof ApiError ? err.message : (err as Error)?.message || "Sign in failed";
        if (msg.toLowerCase().includes("approval") || msg.toLowerCase().includes("intezar")) {
          volt.complain("Application under review! Please wait for admin approval.");
        } else {
          volt.complain(msg);
        }
        toast.error(msg);
      }
      setIsSubmitting(false);
      setIsWaking(false);
    }

  }

  /** Friendly wording when the phone-code feature isn't switched on yet. */
  function phoneError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 404 || err.status === 501)
        return "Sign in by code isn't switched on yet. Use your password for now.";
      if (err.status === 429) return "Too many code requests. Please wait a minute.";
      return err.message;
    }
    return (err as Error)?.message || "Something went wrong. Please try again.";
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (isSubmitting || lockedFor > 0) return;
    const problem = phoneProblem(phone);
    if (problem) {
      volt.complain(problem);
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await requestPhoneCode(phone, otpChannel);
      const actualChannel = res?.channel ?? (res?.sent_via_whatsapp ? "whatsapp" : "sms");
      setLastUsedChannel(actualChannel);
      setCodeSent(true);
      setResendIn(45);
      if (actualChannel === "sms") {
        volt.say("Code sent via SMS. Check your messages.");
        toast.success("6-digit code sent via SMS (TextBee).");
      } else {
        volt.say("Code sent on WhatsApp. Check your chats.");
        toast.success("6-digit code sent to your WhatsApp.");
      }
    } catch (err) {
      const msg = phoneError(err);
      if (err instanceof ApiError && err.status === 429) setLockedFor(60);
      volt.complain(msg);
      toast.error(msg);
      if (msg.startsWith("Sign in by code")) setMode("password");
    } finally {
      setIsSubmitting(false);
      setIsWaking(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting || volt.done) return;
    if (code.trim().length < 4) {
      volt.complain("Enter the 6-digit code we sent on WhatsApp.");
      return;
    }
    setIsSubmitting(true);
    const minPending = new Promise((r) => setTimeout(r, 550));
    try {
      const [{ account, isNewCustomer }] = await Promise.all([
        verifyPhoneCode(phone, code),
        minPending,
      ]);
      const target = ROLE_HOME[account.role] || "/profile";
      volt.celebrate(isNewCustomer ? "Welcome to Kennedy! You're in." : "Grill's hot. Welcome back!");
      toast.success(isNewCustomer ? "Account ready — welcome!" : `Welcome back, ${account.name}`);
      setTimeout(() => navigate({ to: target }), 800);
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 400
          ? "That code doesn't match. Check it and try again."
          : phoneError(err);
      volt.complain(msg);
      toast.error(msg);
      setIsSubmitting(false);
      setIsWaking(false);
    }
  }

  return (
    <VoltScene
      volt={volt}
      eyebrow="Welcome back"
      title="Sign in"
      subtitle="Sign in and we'll open the console that matches your account."
      footer={
        <>
          New to the grill?{" "}
          <Link to="/signup" className="font-extrabold text-flame hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-md bg-charcoal/5 p-1">
        {(["phone", "password"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              volt.say(
                m === "phone"
                  ? "Just your number — we'll send a WhatsApp code."
                  : "Staff sign-in. Username and password.",
              );
            }}
            className={cn(
              "rounded-md px-3 py-2 text-[12px] font-extrabold transition",
              mode === m ? "bg-white text-flame shadow-sm" : "text-charcoal/55 hover:text-charcoal",
            )}
          >
            {m === "phone" ? "WhatsApp code" : "Password"}
          </button>
        ))}
      </div>

      {mode === "phone" && (
        <form onSubmit={codeSent ? submitCode : sendCode} className="space-y-5">
          <label className="auth-field-wrap block">
            <Phone className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-charcoal/40" />
            <input
              type="tel"
              value={phone}
              placeholder="Mobile number (e.g. 0300 1234567)"
              className="auth-field"
              autoComplete="tel"
              inputMode="tel"
              disabled={codeSent}
              onFocus={() => {
                volt.setTurned(false);
                volt.setMoodSafe("watching");
                volt.say("Your WhatsApp number — no password needed.");
                volt.follow(phone);
              }}
              onChange={(e) => {
                setPhone(e.target.value);
                volt.follow(e.target.value);
                volt.setMoodSafe(e.target.value.length > 5 ? "happy" : "watching");
              }}
            />
          </label>

          {codeSent && (
            <>
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-md border border-flame/20 bg-flame/5 p-3"
              >
                <div className="mb-2 flex items-center gap-2 font-display text-[11px] font-extrabold uppercase text-charcoal/70">
                  <KeyRound className="h-4 w-4 text-flame" aria-hidden="true" />
                  Enter your {lastUsedChannel === "sms" ? "SMS" : "WhatsApp"} code
                </div>
                <OtpCodeFields value={code} onChange={setCode} />
              </motion.div>
              <div className="flex items-center justify-between text-[12px] font-bold">
                <button
                  type="button"
                  className="text-charcoal/55 hover:text-charcoal"
                  onClick={() => {
                    setCodeSent(false);
                    setCode("");
                  }}
                >
                  Change number
                </button>
                <button
                  type="button"
                  disabled={resendIn > 0 || isSubmitting}
                  className="text-flame disabled:text-charcoal/35"
                  onClick={() => void sendCode()}
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                </button>
              </div>
            </>
          )}

          {/* Channel selector — shown only before code is sent */}
          {!codeSent && (
            <div className="otp-switch-row">
              <span className="text-[12px] font-semibold text-charcoal/60">Send via</span>
              <div className="otp-switch" data-active={otpChannel} role="radiogroup" aria-label="Code delivery">
                <span className="otp-switch-pill" aria-hidden />
                {(["whatsapp", "sms"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={otpChannel === c}
                    onClick={() => setOtpChannel(c)}
                    className="otp-switch-opt"
                    data-on={otpChannel === c || undefined}
                  >
                    <span key={`${c}-${otpChannel === c}`} className="otp-switch-ico" aria-hidden>
                      {c === "whatsapp" ? "📱" : "💬"}
                    </span>
                    {c === "whatsapp" ? "WhatsApp" : "SMS"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p key={otpChannel} className="otp-switch-hint text-[12px] font-semibold text-charcoal/55">
            {otpChannel === "sms"
              ? "Code arrives by SMS. If WhatsApp fails, SMS fallback is automatic."
              : "Code arrives on WhatsApp. No account needed — your number is your login."}
          </p>

          <SendPlaneButton
            sending={isSubmitting}
            sent={codeSent}
            doneLabel="Sent!"
            showPlane={lockedFor <= 0}
            disabled={isSubmitting || lockedFor > 0}
          >
            {lockedFor > 0
              ? `Too many tries — wait ${lockedFor}s`
              : codeSent
                ? "Verify & sign in"
                : `Send me a code via ${otpChannel === "sms" ? "SMS" : "WhatsApp"}`}
          </SendPlaneButton>
        </form>
      )}

      <form onSubmit={submit} className={cn("space-y-5", mode !== "password" && "hidden")}>
        <label className="auth-field-wrap block">
          <Mail className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-charcoal/40" />
          <input
            type="text"
            value={email}
            placeholder="Username or email (e.g. kennedy_admin)"
            className="auth-field"
            autoComplete="username"
            onFocus={() => {
              volt.setTurned(false);
              volt.setMoodSafe("watching");
              volt.say("Username or email first.");
              volt.follow(email);
            }}
            onChange={(e) => {
              setEmail(e.target.value);
              volt.follow(e.target.value);
              if (e.target.value.trim().length > 2) {
                volt.setMoodSafe("happy");
              } else {
                volt.setMoodSafe("watching");
              }
            }}
          />
        </label>

        <div>
          <label className="auth-field-wrap block">
            <Lock className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-charcoal/40" />
            <input
              type={showPass ? "text" : "password"}
              value={pass}
              placeholder="Password"
              className="auth-field pr-12"
              autoComplete="current-password"
              onFocus={() => {
                volt.setMoodSafe("shy");
                volt.setTurned(true);
                volt.resetLook();
                volt.say("A secret? Say no more. *turns around*");
              }}
              onBlur={(e) => {
                if ((e.relatedTarget as HTMLElement | null)?.dataset?.["peek"]) return;
                volt.setTurned(false);
              }}
              onChange={(e) => {
                setPass(e.target.value);
                volt.scorePassword(e.target.value);
              }}
            />
            <button
              type="button"
              data-peek="1"
              aria-label={showPass ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-4 -translate-y-1/2 text-charcoal/45 transition hover:text-flame"
              onClick={() => {
                setShowPass((s) => !s);
                if (!showPass) volt.say("Revealing it? Good thing I'm facing the wall.");
              }}
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </label>
          <VoltStrength volt={volt} />
        </div>

        {isWaking && (
          <p className="rounded-md bg-flame/10 px-3 py-2 text-[12px] font-semibold text-charcoal/80">
            Waking up the kitchen… our server was asleep, this can take up to 30 seconds.
          </p>
        )}

        <div className="text-right">
          <Link to="/forgot-password" className="text-[12px] font-bold text-flame hover:underline">
            Forgot password?
          </Link>
        </div>

        <button
          ref={volt.btnRef}
          type="submit"
          disabled={isSubmitting || lockedFor > 0}
          aria-busy={isSubmitting}
          className={cn("auth-cta", isSubmitting && "btn-pending")}
          onMouseEnter={() => volt.hype(true)}
          onMouseLeave={() => volt.hype(false)}
          onFocus={() => volt.hype(true)}
          onBlur={() => volt.hype(false)}
          onPointerDown={() => {
            volt.setPressedMood(true);
            volt.say(pickLine(["Ahh. That's the stuff.", "Mmm. Satisfying.", "Beep. Do that again."]));
          }}
          onPointerUp={() => volt.setPressedMood(false)}
        >
          {isSubmitting ? <span className="btn-spinner" aria-hidden /> : <span aria-hidden>🍕</span>}
          {isSubmitting ? (
            <span className="btn-dots">{isWaking ? "Waking the kitchen" : "Checking your pass"}</span>
          ) : lockedFor > 0 ? (
            `Too many tries — wait ${lockedFor}s`
          ) : volt.done ? (
            "Order up ✓"
          ) : (
            "Sign in"
          )}
        </button>

        <div className="pt-2 text-center">
          <Link
            to="/onboard"
            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-amber-500 hover:text-amber-400 hover:underline transition-colors"
          >
              <span>🍽️ Register a new restaurant — 14-day free trial</span>
          </Link>
        </div>
      </form>
    </VoltScene>
  );
}
