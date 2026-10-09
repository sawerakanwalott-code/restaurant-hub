import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Sparkles,
  Phone,
  Store,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ChefHat,
  Bike,
  QrCode,
  Check,
  RefreshCw,
  Building2,
  Flame,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import { api, tokens } from "@/lib/api/client";
import { rememberTenant } from "@/lib/tenant";
import { publish, type AuthAccount } from "@/lib/auth";

export const Route = createFileRoute("/onboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Onboard Your Restaurant — 14-Day Free SaaS Trial" },
      { name: "description", content: "Self-service restaurant onboarding with KDS kitchen screen, WhatsApp till, and rider fleet." },
    ],
  }),
  component: OnboardPage,
});

const POPULAR_CITIES = [
  "Narowal",
  "Lahore",
  "Karachi",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Sialkot",
  "Gujranwala",
  "Multan",
  "Peshawar",
  "Other",
];

function OnboardPage() {
  const navigate = useNavigate();

  // Step state: 1 = Phone/OTP, 2 = Restaurant Details, 3 = Credentials & Launch
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Phone & OTP
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [channel, setChannel] = useState("whatsapp");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");

  // Step 2: Restaurant & Branch Details
  const [restaurantName, setRestaurantName] = useState("");
  const [branchName, setBranchName] = useState("Main Branch");
  const [city, setCity] = useState("Narowal");
  const [customCity, setCustomCity] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchPhone, setBranchPhone] = useState("");

  // Step 3: Owner Account
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Countdown timer for OTP
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Step 1: Send OTP
  const handleSendOtp = async () => {
    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.replace(/\D/g, "").length < 10) {
      toast.error("Valid 10-11 digit Pakistani phone number darj karein.");
      return;
    }

    setSendingOtp(true);
    try {
      const res = await api.post<{ message: string; channel: string; expires_in_seconds: number }>(
        "/onboard/initiate/",
        { phone: cleanPhone }
      );
      setOtpSent(true);
      setChannel(res.channel || "whatsapp");
      setCountdown(res.expires_in_seconds || 600);
      toast.success(
        res.channel === "whatsapp"
          ? "WhatsApp par 6-digit verification code bhej diya gaya hai! 📱"
          : "SMS ke zariye verification code bhej diya gaya hai."
      );
    } catch (err: any) {
      toast.error(err?.error || err?.message || "Code send karne mein masla aaya. Dobara koshish karein.");
    } finally {
      setSendingOtp(false);
    }
  };

  // Step 1: Verify OTP
  const handleVerifyOtp = async () => {
    const cleanCode = otpCode.trim();
    if (cleanCode.length !== 6) {
      toast.error("6-digit code darj karein.");
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await api.post<{ verification_token: string; identifier: string }>(
        "/onboard/verify/",
        { phone: phone.trim(), code: cleanCode }
      );
      setVerificationToken(res.verification_token);
      toast.success("Phone number verified successfully! ✅");
      setStep(2);
    } catch (err: any) {
      toast.error(err?.error || "Ghalat ya expire code. Baraye meherbani dobara check karein.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Step 2 -> Step 3 Validation
  const handleProceedToCredentials = () => {
    if (!restaurantName.trim()) {
      toast.error("Restaurant ka naam darj karna lazmi hai.");
      return;
    }
    const finalCity = city === "Other" ? customCity.trim() : city;
    if (!finalCity) {
      toast.error("Shehar (City) select ya darj karein.");
      return;
    }
    setStep(3);
  };

  // Step 3: Complete Onboarding & Auto-Login
  const handleComplete = async () => {
    if (!ownerName.trim()) {
      toast.error("Owner ka pura naam darj karein.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password kam az kam 8 characters ka hona chahiye.");
      return;
    }

    setCompleting(true);
    try {
      const finalCity = city === "Other" ? customCity.trim() : city;
      const res = await api.post<{
        tokens: { access: string; refresh: string };
        access: string;
        refresh: string;
        tenant: { id: string; name: string; slug: string };
        branch: { id: number; name: string; slug: string };
        user: { id: number; username: string; email: string; full_name: string; phone: string; role: string };
      }>("/onboard/complete/", {
        verification_token: verificationToken,
        restaurant_name: restaurantName.trim(),
        owner_name: ownerName.trim(),
        owner_password: password,
        owner_email: ownerEmail.trim() || undefined,
        owner_phone: phone.trim(),
        branch_name: branchName.trim() || "Main Branch",
        branch_city: finalCity,
        branch_address: branchAddress.trim() || undefined,
        branch_phone: branchPhone.trim() || phone.trim(),
      });

      // 1. Save JWT Tokens
      const accessToken = res.tokens?.access || res.access;
      const refreshToken = res.tokens?.refresh || res.refresh;
      tokens.set(accessToken, refreshToken);

      // 2. Remember Tenant
      rememberTenant({
        id: res.tenant.id,
        name: res.tenant.name,
        slug: res.tenant.slug,
      });

      // 3. Publish Auth Session
      const account: AuthAccount = {
        id: String(res.user.id),
        name: res.user.full_name || ownerName,
        email: res.user.email || ownerEmail,
        phone: res.user.phone || phone,
        role: "owner",
        isSuperuser: false,
        status: "active",
        createdAt: new Date().toISOString(),
      };
      publish(account);

      toast.success(
        `Mubarak ho! ${res.tenant.name} ka 14-day free trial active ho gaya hai! 🎉`,
        { duration: 6000 }
      );

      // Redirect directly to admin dashboard
      navigate({ to: "/admin" });
    } catch (err: any) {
      toast.error(err?.error || err?.message || "Onboarding complete karne mein masla aaya.");
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080706] text-[#eae5df] flex flex-col justify-between selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Navigation */}
      <header className="border-b border-[#231f1a] bg-[#0e0d0b]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-black shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
              <Flame className="w-5 h-5 fill-black" />
            </span>
            <div>
              <span className="font-serif text-lg font-black tracking-tight text-white block">
                Kennedy SaaS
              </span>
              <span className="text-[10px] text-amber-400/90 font-mono uppercase tracking-widest block -mt-1">
                Restaurant OS
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4 text-xs">
            <span className="text-[#8a7e6e] hidden sm:inline">Already registered?</span>
            <Link
              to="/login"
              className="px-3.5 py-1.5 rounded-lg border border-[#332e26] text-white hover:border-amber-500/40 hover:text-amber-400 transition-colors font-medium"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12 flex flex-col items-center">
        {/* Step Indicator */}
        <div className="w-full max-w-2xl mb-10">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[#231f1a] -translate-y-1/2 z-0" />
            <div
              className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-amber-500 to-amber-400 -translate-y-1/2 z-0 transition-all duration-500"
              style={{ width: step === 1 ? "0%" : step === 2 ? "50%" : "100%" }}
            />

            {/* Step 1 Node */}
            <div className="relative z-10 flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step > 1
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                    : step === 1
                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20 ring-4 ring-amber-500/20"
                    : "bg-[#1c1915] text-[#8a7e6e] border border-[#2a2620]"
                }`}
              >
                {step > 1 ? <Check className="w-5 h-5 stroke-[3]" /> : "1"}
              </div>
              <span className={`text-[11px] font-bold mt-2 ${step >= 1 ? "text-white" : "text-[#7a6e5e]"}`}>
                Phone & OTP
              </span>
            </div>

            {/* Step 2 Node */}
            <div className="relative z-10 flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step > 2
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                    : step === 2
                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20 ring-4 ring-amber-500/20"
                    : "bg-[#1c1915] text-[#8a7e6e] border border-[#2a2620]"
                }`}
              >
                {step > 2 ? <Check className="w-5 h-5 stroke-[3]" /> : "2"}
              </div>
              <span className={`text-[11px] font-bold mt-2 ${step >= 2 ? "text-white" : "text-[#7a6e5e]"}`}>
                Restaurant
              </span>
            </div>

            {/* Step 3 Node */}
            <div className="relative z-10 flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step === 3
                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20 ring-4 ring-amber-500/20"
                    : "bg-[#1c1915] text-[#8a7e6e] border border-[#2a2620]"
                }`}
              >
                "3"
              </div>
              <span className={`text-[11px] font-bold mt-2 ${step === 3 ? "text-white" : "text-[#7a6e5e]"}`}>
                Launch OS
              </span>
            </div>
          </div>
        </div>

        {/* Card Container */}
        <div className="w-full max-w-xl bg-[#110f0d] border border-[#26211a] rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden">
          {/* Subtle gold glow at top */}
          <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

          {/* ── STEP 1: Phone Verification ─────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" /> 14-Day Free SaaS Trial
                </span>
                <h1 className="text-2xl sm:text-3xl font-serif font-black text-white">
                  Apne Restaurant Ko Register Karein
                </h1>
                <p className="text-sm text-[#8a7e6e]">
                  Sirf 2 minutes mein automated WhatsApp ordering, kitchen screen aur rider fleet shuru karein.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-[#b5a999] mb-1.5 uppercase tracking-wider">
                    WhatsApp / Mobile Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a7e6e]" />
                    <input
                      type="tel"
                      value={phone}
                      disabled={otpSent}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0300 1234567"
                      className="w-full bg-[#080706] border border-[#2b251e] rounded-xl pl-10 pr-4 py-3 text-white font-mono placeholder:text-[#5a5247] focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-[#7a6e5e] mt-1.5">
                    Is number par 6-digit WhatsApp OTP verification code ayega.
                  </p>
                </div>

                {!otpSent ? (
                  <button
                    onClick={handleSendOtp}
                    disabled={sendingOtp}
                    className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                  >
                    {sendingOtp ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Code Bheja Ja Raha Hai...
                      </>
                    ) : (
                      <>
                        Send Verification Code
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-4 pt-2 border-t border-[#231f1a]">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-[#b5a999] uppercase tracking-wider">
                          6-Digit Code
                        </label>
                        {countdown > 0 ? (
                          <span className="text-xs text-amber-400 font-mono">
                            Expires in {Math.floor(countdown / 60)}:
                            {String(countdown % 60).padStart(2, "0")}
                          </span>
                        ) : (
                          <button
                            onClick={handleSendOtp}
                            className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                          >
                            <RefreshCw className="w-3 h-3" /> Resend Code
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="••••••"
                        className="w-full bg-[#080706] border border-[#2b251e] rounded-xl text-center py-3 text-2xl font-mono tracking-widest text-amber-400 focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => {
                          setOtpSent(false);
                          setOtpCode("");
                        }}
                        className="px-4 py-3 rounded-xl border border-[#2b251e] text-[#8a7e6e] hover:text-white text-xs font-bold transition-colors"
                      >
                        Change Number
                      </button>
                      <button
                        onClick={handleVerifyOtp}
                        disabled={verifyingOtp || otpCode.length !== 6}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                      >
                        {verifyingOtp ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            Verify & Continue
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 2: Restaurant & Branch Details ────────────────────────── */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold">
                  Step 2 of 3
                </span>
                <h2 className="text-2xl font-serif font-black text-white">
                  Restaurant Information
                </h2>
                <p className="text-sm text-[#8a7e6e]">
                  Aapka online storefront aur receipt branding is naam se banegi.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#b5a999] mb-1.5 uppercase tracking-wider">
                    Restaurant Name *
                  </label>
                  <div className="relative">
                    <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a7e6e]" />
                    <input
                      type="text"
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                      placeholder="e.g. Moon Grill Narowal"
                      className="w-full bg-[#080706] border border-[#2b251e] rounded-xl pl-10 pr-4 py-2.5 text-white placeholder:text-[#5a5247] focus:outline-none focus:border-amber-500 transition-colors text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#b5a999] mb-1.5 uppercase tracking-wider">
                      City *
                    </label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-[#080706] border border-[#2b251e] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-amber-500 transition-colors text-sm"
                    >
                      {POPULAR_CITIES.map((c) => (
                        <option key={c} value={c} className="bg-[#110f0d]">
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#b5a999] mb-1.5 uppercase tracking-wider">
                      First Branch Name
                    </label>
                    <input
                      type="text"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      placeholder="e.g. Main Branch / Saddar"
                      className="w-full bg-[#080706] border border-[#2b251e] rounded-xl px-3.5 py-2.5 text-white placeholder:text-[#5a5247] focus:outline-none focus:border-amber-500 transition-colors text-sm"
                    />
                  </div>
                </div>

                {city === "Other" && (
                  <div>
                    <label className="block text-xs font-bold text-[#b5a999] mb-1.5 uppercase tracking-wider">
                      Specify City Name *
                    </label>
                    <input
                      type="text"
                      value={customCity}
                      onChange={(e) => setCustomCity(e.target.value)}
                      placeholder="e.g. Bahawalpur"
                      className="w-full bg-[#080706] border border-[#2b251e] rounded-xl px-3.5 py-2.5 text-white placeholder:text-[#5a5247] focus:outline-none focus:border-amber-500 transition-colors text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-[#b5a999] mb-1.5 uppercase tracking-wider">
                    Branch Address (Street / Area)
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a7e6e]" />
                    <input
                      type="text"
                      value={branchAddress}
                      onChange={(e) => setBranchAddress(e.target.value)}
                      placeholder="e.g. Circular Road, Near Kachehri Chowk"
                      className="w-full bg-[#080706] border border-[#2b251e] rounded-xl pl-10 pr-4 py-2.5 text-white placeholder:text-[#5a5247] focus:outline-none focus:border-amber-500 transition-colors text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#231f1a]">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#2b251e] text-[#8a7e6e] hover:text-white text-xs font-bold transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <button
                  onClick={handleProceedToCredentials}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm transition-all shadow-lg shadow-amber-500/20"
                >
                  Next: Account Setup
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Owner Credentials & Launch ────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold">
                  Step 3 of 3
                </span>
                <h2 className="text-2xl font-serif font-black text-white">
                  Owner Account & Password
                </h2>
                <p className="text-sm text-[#8a7e6e]">
                  Aap is login se poora restaurant management console control karenge.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#b5a999] mb-1.5 uppercase tracking-wider">
                    Owner Full Name *
                  </label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Mian Muhammad Rafy"
                    className="w-full bg-[#080706] border border-[#2b251e] rounded-xl px-3.5 py-2.5 text-white placeholder:text-[#5a5247] focus:outline-none focus:border-amber-500 transition-colors text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#b5a999] mb-1.5 uppercase tracking-wider">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="e.g. owner@restaurant.pk"
                    className="w-full bg-[#080706] border border-[#2b251e] rounded-xl px-3.5 py-2.5 text-white placeholder:text-[#5a5247] focus:outline-none focus:border-amber-500 transition-colors text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#b5a999] mb-1.5 uppercase tracking-wider">
                    Admin Password (Minimum 8 Characters) *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a7e6e]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[#080706] border border-[#2b251e] rounded-xl pl-10 pr-10 py-2.5 text-white placeholder:text-[#5a5247] focus:outline-none focus:border-amber-500 transition-colors text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8a7e6e] hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 14-Day Free Trial Highlight Box */}
                <div className="bg-gradient-to-br from-amber-500/10 via-[#16130f] to-amber-500/5 border border-amber-500/30 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                    <BadgeCheck className="w-4 h-4" /> 14-Day Full Access Trial Included
                  </div>
                  <ul className="text-xs text-[#a09484] space-y-1.5 pl-1">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      Live KDS Kitchen Screen & Sound Notifications
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      Counter POS + Thermal Receipt Printing
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      WhatsApp Automated Ordering & Order Tracking
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      Rider Fleet GPS Sharing & COD Cash Reconciliation
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#231f1a]">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#2b251e] text-[#8a7e6e] hover:text-white text-xs font-bold transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-black text-sm transition-all shadow-xl shadow-amber-500/25 disabled:opacity-50"
                >
                  {completing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Launching Restaurant OS...
                    </>
                  ) : (
                    <>
                      Launch Restaurant & Start Free Trial
                      <Sparkles className="w-4 h-4 fill-black" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1c1915] py-6 text-center text-xs text-[#6a5e4f]">
        <p>
          Kennedy Moon Grill Restaurant SaaS Engine · Built for Pakistani Food Outlets · Narowal, PK
        </p>
      </footer>
    </div>
  );
}
