import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  QrCode,
  Smartphone,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
  Send,
  LogOut,
  Power,
  ShieldCheck,
  Zap,
  Info,
  ChevronRight,
  Flame,
  KeyRound,
  Loader2,
  Copy,
  Check,
  Store,
  Building2,
  UtensilsCrossed,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api/client";
import { fetchWhatsAppStatus, invalidateWhatsAppCache } from "@/lib/whatsapp";
import { Panel } from "@/components/admin/bits";
import { currentTenantSlug } from "@/lib/tenant";

export const Route = createFileRoute("/admin/whatsapp")({
  ssr: false,
  component: AdminWhatsAppPage,
});

interface WhatsAppStatusData {
  state: "open" | "connecting" | "close" | "error" | "offline";
  status: "CONNECTED" | "SCAN_QR" | "STARTING" | "STOPPED" | "LOGGED_OUT" | "UNAVAILABLE" | string;
  is_connected: boolean;
  phone?: string | null;
  user_name?: string | null;
  uptime: number;
  session_id: string;
  restaurant_name: string;
  qrcode?: string | null;
  pairing_code?: string | null;
}

function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return "0m";
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function AdminWhatsAppPage() {
  const [data, setData] = useState<WhatsAppStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Multi-tenant: allow managing QR for any restaurant
  const [tenants, setTenants] = useState<Array<{ id: number | string; name: string; slug: string }>>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>(
    currentTenantSlug() || "moon-grill-narowal"
  );

  // Phone pairing
  const [pairPhone, setPairPhone] = useState("");
  const [generatedPairCode, setGeneratedPairCode] = useState<string | null>(null);
  const [pairLoading, setPairLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Test OTP Dispatch
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);

  // Menu Preview
  const [menuData, setMenuData] = useState<{
    item_count: number;
    items: Array<{ code: number; name: string; category: string; base_price: string; sizes: Array<{ size: string; price: string }> }>;
    formatted_text: string;
  } | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);

  const fetchMenu = useCallback(async () => {
    setMenuLoading(true);
    try {
      const res = await api.get<typeof menuData>(`/whatsapp/menu/?tenant=${selectedTenant}`);
      setMenuData(res);
    } catch {
      // Menu preview is optional â€” don't toast on failure
    } finally {
      setMenuLoading(false);
    }
  }, [selectedTenant]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  // Load active tenants for restaurant switcher
  useEffect(() => {
    api.get<Array<{ id: number | string; name: string; slug: string }>>("/tenants/")
      .then((res) => {
        if (Array.isArray(res) && res.length > 0) {
          setTenants(res);
        }
      })
      .catch(() => {});
  }, []);

  const fetchStatus = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      // Calls fetchWhatsAppStatus with force=!quiet which auto-deduplicates and caches
      const res = await fetchWhatsAppStatus(selectedTenant, !quiet);
      setData(res as any);
      if (res.pairing_code) {
        setGeneratedPairCode(res.pairing_code);
      }
    } catch (err: any) {
      if (!quiet) {
        toast.error("Failed to fetch WhatsApp gateway status", {
          description: err?.message || "Make sure WA-AKG container is running.",
        });
      }
    } finally {
      setLoading(false);
      if (!quiet) setRefreshing(false);
    }
  }, [selectedTenant]);

  useEffect(() => {
    fetchStatus();
    // Fast poll (4s) only while waiting for QR scan / pairing
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (!data?.is_connected) {
        fetchStatus(true);
      }
    }, 4000);

    // Slow health-check (60s) once already connected
    const slowSync = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (data?.is_connected) {
        fetchStatus(true);
      }
    }, 60000);

    return () => {
      clearInterval(interval);
      clearInterval(slowSync);
    };
  }, [fetchStatus, data?.is_connected]);

  const handleRestart = async () => {
    setActionLoading("restart");
    invalidateWhatsAppCache();
    try {
      await api.post(`/whatsapp/restart/?tenant=${selectedTenant}`, {});
      toast.success("WhatsApp Gateway socket restarted. Generating fresh QR...");
      await fetchStatus();
    } catch (err: any) {
      toast.error("Restart failed: " + (err?.message || "Unknown error"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async () => {
    setActionLoading("logout");
    invalidateWhatsAppCache();
    try {
      await api.post(`/whatsapp/logout/?tenant=${selectedTenant}`, {});
      toast.success("WhatsApp session disconnected.");
      await fetchStatus();
    } catch (err: any) {
      toast.error("Disconnect failed: " + (err?.message || "Unknown error"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleGeneratePairCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairPhone.trim()) {
      toast.error("Please enter a valid WhatsApp phone number.");
      return;
    }
    setPairLoading(true);
    try {
      const res = await api.post<{ pairing_code: string }>(`/whatsapp/pair/?tenant=${selectedTenant}`, {
        phone: pairPhone.trim(),
      });
      if (res.pairing_code) {
        setGeneratedPairCode(res.pairing_code);
        toast.success(`Pairing code generated: ${res.pairing_code}`);
      }
    } catch (err: any) {
      toast.error("Failed to generate pairing code", {
        description: err?.message || "Please restart the session and try again.",
      });
    } finally {
      setPairLoading(false);
    }
  };

  const handleSendTestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) {
      toast.error("Enter a recipient phone number");
      return;
    }
    setTestSending(true);
    try {
      const res = await api.post<{ sent_via_whatsapp?: boolean; message?: string }>(
        "/auth/phone-otp/",
        { phone: testPhone.trim() }
      );
      toast.success(`WhatsApp OTP transmitted to ${testPhone}!`, {
        description: res?.message || "Verified OTP message sent successfully to customer phone.",
      });
    } catch (err: any) {
      toast.error("Failed to send test OTP: " + (err?.message || "WhatsApp gateway may be disconnected"));
    } finally {
      setTestSending(false);
    }
  };

  const copyPairingCode = () => {
    if (!generatedPairCode) return;
    navigator.clipboard.writeText(generatedPairCode);
    setCopiedCode(true);
    toast.success("Pairing code copied to clipboard!");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const isConnected = data?.is_connected === true;
  const isScanning = !isConnected && (data?.status === "SCAN_QR" || !!data?.qrcode);

  return (
    <div className="space-y-8 p-1 md:p-2">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2e2a24] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/5">
              <QrCode className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                  WhatsApp OTP Gateway
                </h1>
                <span className="text-[11px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                  WA-AKG Multi-Device
                </span>
              </div>
              <p className="text-sm text-[#8a7e6e] mt-1">
                Each restaurant maintains its own dedicated WhatsApp account for automated guest OTPs &amp; order updates.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchStatus()}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-[#1a1815] text-[#a09484] hover:text-white border border-[#2e2a24] hover:border-amber-500/30 transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-amber-400" : ""}`} />
            Refresh Status
          </button>

          <button
            onClick={handleRestart}
            disabled={actionLoading === "restart"}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 transition-all shadow-sm"
          >
            {actionLoading === "restart" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Power className="w-3.5 h-3.5 text-amber-400" />
            )}
            Restart Gateway Socket
          </button>

          {isConnected && (
            <button
              onClick={handleLogout}
              disabled={actionLoading === "logout"}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-red-950/40 text-red-300 hover:bg-red-900/50 border border-red-800/40 transition-all shadow-sm"
            >
              {actionLoading === "logout" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LogOut className="w-3.5 h-3.5 text-red-400" />
              )}
              Disconnect Account
            </button>
          )}
        </div>
      </div>

      {/* Restaurant Instance Selector for Multi-Tenant QR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#161413] border border-[#2e2a24] shadow-md">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Store className="w-5 h-5" />
          </span>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#8a7e6e] block">
              Multi-Restaurant Account Manager
            </span>
            <p className="text-sm font-bold text-white">
              Linked Store: <span className="text-amber-400">{data?.restaurant_name || selectedTenant}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <label className="text-xs text-[#8a7e6e] font-semibold whitespace-nowrap">Switch Restaurant:</label>
          <select
            value={selectedTenant}
            onChange={(e) => {
              setSelectedTenant(e.target.value);
              setData(null);
              setLoading(true);
            }}
            className="bg-[#0e0d0b] border border-amber-500/40 text-amber-300 font-bold text-xs rounded-xl px-3.5 py-2 focus:outline-none focus:border-amber-400 cursor-pointer shadow-inner"
          >
            {tenants.map((t) => (
              <option key={t.slug} value={t.slug} className="bg-[#161413] text-white">
                {t.name} ({t.slug})
              </option>
            ))}
            {tenants.length === 0 && (
              <option value={selectedTenant} className="bg-[#161413] text-white">
                {selectedTenant}
              </option>
            )}
          </select>
        </div>
      </div>

      {/* Main Status & QR Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Live Status & Details (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Main Health Card */}
          <div className="bg-[#161413] border border-[#2e2a24] rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-[#7a6e5e]">
                Connection Status
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold font-mono text-[#5a5248]">
                Session: <span className="text-amber-400">{selectedTenant}</span>
              </span>
            </div>

            {loading ? (
              <div className="py-8 flex items-center justify-center gap-3 text-[#7a6e5e]">
                <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                <span>Synchronizing with WhatsApp Gateway...</span>
              </div>
            ) : isConnected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3.5 p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                  <div className="w-4 h-4 rounded-full bg-emerald-400 animate-pulse flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-emerald-100" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      WhatsApp Connected
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    </h3>
                    <p className="text-xs text-emerald-300/80 mt-0.5">
                      Ready to automatically dispatch customer OTPs from your official number.
                    </p>
                  </div>
                </div>

                <div className="bg-[#0e0d0b] border border-[#2a2620] rounded-xl p-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#7a6e5e]">Linked Number</span>
                    <span className="font-mono font-bold text-amber-300">
                      +{data?.phone || "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#7a6e5e]">WhatsApp Name</span>
                    <span className="font-semibold text-white">
                      {data?.user_name || "Official Business Account"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#7a6e5e]">Socket Uptime</span>
                    <span className="font-mono text-emerald-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {formatUptime(data?.uptime || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#7a6e5e]">Assigned Tenant</span>
                    <span className="text-xs text-[#9a8e7e]">
                      {data?.restaurant_name || "Moon Grill"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3.5 p-4 rounded-xl bg-amber-950/30 border border-amber-500/30">
                  <div className="w-3.5 h-3.5 rounded-full bg-amber-400 animate-ping" />
                  <div>
                    <h3 className="text-base font-bold text-amber-300 flex items-center gap-2">
                      Scan Required to Link
                      <Radio className="w-4 h-4 text-amber-400" />
                    </h3>
                    <p className="text-xs text-amber-200/70 mt-0.5">
                      Scan the live QR code on the right with your restaurant's WhatsApp app.
                    </p>
                  </div>
                </div>

                <div className="bg-[#0e0d0b] border border-[#2a2620] rounded-xl p-4 space-y-2.5 text-xs text-[#8a7e6e]">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 font-bold flex items-center justify-center shrink-0">1</span>
                    <span>Open WhatsApp on your phone â†’ Tap <b>Linked Devices</b>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 font-bold flex items-center justify-center shrink-0">2</span>
                    <span>Tap <b>Link a Device</b> and point camera at the QR code.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 font-bold flex items-center justify-center shrink-0">3</span>
                    <span>Connection synchronizes automatically in 2-3 seconds.</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Test OTP Dispatch Card */}
          <div className="bg-[#161413] border border-[#2e2a24] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-2.5 mb-3">
              <Send className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-white text-sm">Live OTP Dispatch Test</h3>
            </div>
            <p className="text-xs text-[#7a6e5e] mb-4">
              Enter any WhatsApp phone number to test real-time OTP transmission.
            </p>

            <form onSubmit={handleSendTestOTP} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="03001234567"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-[#0e0d0b] border border-[#2e2a24] rounded-xl text-sm font-mono text-white placeholder-[#5a5248] focus:outline-none focus:border-amber-500/50"
                />
                <button
                  type="submit"
                  disabled={testSending}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-[#0e0d0b] font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {testSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Test
                </button>
              </div>
            </form>
          </div>

          {/* 8-Digit Phone Pairing Alternative */}
          {!isConnected && (
            <div className="bg-[#161413] border border-[#2e2a24] rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-white text-sm">Pair with Phone Number (No Camera)</h3>
              </div>
              <p className="text-xs text-[#7a6e5e]">
                If camera is unavailable, generate an 8-character pairing code to enter inside WhatsApp.
              </p>

              <form onSubmit={handleGeneratePairCode} className="flex gap-2">
                <input
                  type="text"
                  placeholder="03001234567"
                  value={pairPhone}
                  onChange={(e) => setPairPhone(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-[#0e0d0b] border border-[#2e2a24] rounded-xl text-sm font-mono text-white placeholder-[#5a5248] focus:outline-none focus:border-amber-500/50"
                />
                <button
                  type="submit"
                  disabled={pairLoading}
                  className="px-4 py-2.5 bg-[#24201a] hover:bg-[#2e2922] text-amber-300 font-bold text-xs rounded-xl border border-amber-500/30 transition-colors"
                >
                  {pairLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Get Code"}
                </button>
              </form>

              {generatedPairCode && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[#7a6e5e] block">
                      Pairing Code:
                    </span>
                    <span className="text-2xl font-black font-mono tracking-widest text-amber-300">
                      {generatedPairCode}
                    </span>
                  </div>
                  <button
                    onClick={copyPairingCode}
                    className="p-2.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
                    title="Copy code"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: High-Res Interactive QR Card (7 cols) */}
        <div className="lg:col-span-7">
          <div className="bg-[#161413] border border-[#2e2a24] rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[500px]">
            {/* Background luxury gradient glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />

            {isConnected ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="py-12 flex flex-col items-center space-y-4 max-w-sm"
              >
                <div className="w-24 h-24 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-2xl shadow-emerald-500/20 mb-2">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <h2 className="text-2xl font-black text-white">Live &amp; Operational</h2>
                <p className="text-sm text-[#8a7e6e] leading-relaxed">
                  Your WhatsApp instance is permanently linked. Customers placing orders will receive instant verified WhatsApp OTP messages from this number.
                </p>

                <div className="pt-4 flex items-center gap-3">
                  <button
                    onClick={handleRestart}
                    className="px-5 py-2.5 bg-[#221f1b] hover:bg-[#2d2822] text-white text-xs font-bold rounded-xl border border-[#3e362e] transition-colors"
                  >
                    Reconnect / Switch Number
                  </button>
                </div>
              </motion.div>
            ) : data?.qrcode ? (
              <div className="flex flex-col items-center space-y-6 w-full max-w-md">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
                    Live Baileys Gateway QR
                  </span>
                  <h2 className="text-2xl font-black text-white">Scan with WhatsApp</h2>
                  <p className="text-xs text-[#8a7e6e]">
                    Code refreshes automatically to prevent expiration.
                  </p>
                </div>

                {/* QR Code Container with Gold Caddy Frame */}
                <div className="relative p-5 rounded-3xl bg-white shadow-2xl shadow-amber-500/10 border-4 border-amber-500/40">
                  <img
                    src={data.qrcode}
                    alt="WhatsApp Pairing QR Code"
                    className="w-64 h-64 md:w-72 md:h-72 object-contain"
                  />
                  {/* Subtle animated scanline */}
                  <motion.div
                    className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent shadow-lg shadow-amber-500"
                    animate={{ top: ["8%", "92%", "8%"] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => fetchStatus()}
                    disabled={refreshing}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#0e0d0b] font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                    Refresh QR Code
                  </button>
                  <button
                    onClick={handleRestart}
                    className="px-4 py-2.5 rounded-xl bg-[#221f1b] text-[#a09484] hover:text-white text-xs font-bold border border-[#2e2a24] transition-colors"
                  >
                    Reset Socket
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-16 flex flex-col items-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
                <h3 className="text-lg font-bold text-white">Generating Gateway QR Code...</h3>
                <p className="text-xs text-[#7a6e5e] max-w-xs">
                  Launching Baileys WhatsApp container instance for <b>{selectedTenant}</b>.
                </p>
                <button
                  onClick={handleRestart}
                  className="mt-2 px-4 py-2 text-xs font-bold bg-amber-500/20 text-amber-300 rounded-lg hover:bg-amber-500/30 transition-colors"
                >
                  Force Start Instance
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

