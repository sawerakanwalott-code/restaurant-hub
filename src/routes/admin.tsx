import { createFileRoute, Link, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bike,
  Boxes,
  Calculator,
  ClipboardList,
  CreditCard,
  Crown,
  FileBarChart2,
  GitBranch,
  LogOut,
  MessageCircle,
  QrCode,
  RotateCcw,
  Store,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";

import { ConsoleShell } from "@/components/admin/console-shell";
import { resetDemoData, useAdmin, orderStats } from "@/lib/admin-store";
import { readAccount, signOut, ROLE_HOME } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guard";
import { ADMIN_ROLES } from "@/lib/roles";
import { readTenant, currentTenantSlug } from "@/lib/tenant";
import { api, tokens } from "@/lib/api/client";
import { fetchWhatsAppStatus } from "@/lib/whatsapp";

export const Route = createFileRoute("/admin")({
  ssr: false,
  // SLICE 1.2 — cashier, manager, admin and owner may open the console.
  // Everyone else is sent to their own home screen.
  beforeLoad: requireRole(ADMIN_ROLES),
  head: () => ({
    meta: [
      { title: "Owner Console — Kennedy Moon Grill" },
      {
        name: "description",
        content:
          "Luxury owner console for Kennedy Moon Grill: live orders, revenue graphs, payment verification, rider assignment and delivery tracking.",
      },
      { property: "og:title", content: "Owner Console — Kennedy Moon Grill" },
      {
        property: "og:description",
        content: "Live orders, revenue graphs, payment verification and rider dispatch.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const ADMIN_NAV = [
  { to: "/admin", label: "Dashboard", icon: BarChart3, exact: true },
  { to: "/admin/pos", label: "Counter POS", icon: Calculator },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
  { to: "/admin/dishes", label: "Dishes", icon: UtensilsCrossed },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes },
  { to: "/admin/whatsapp", label: "WhatsApp", icon: QrCode },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/riders", label: "Riders", icon: Bike },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/staff", label: "Staff", icon: Users },
  { to: "/admin/branches", label: "Branches", icon: GitBranch },
  { to: "/admin/billing", label: "Billing & Z-Report", icon: FileBarChart2 },
] as const;

const CASHIER_NAV = [
  { to: "/admin/pos", label: "Counter POS", icon: Calculator },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
  { to: "/admin/customers", label: "Customers", icon: Users },
] as const;

const KITCHEN_NAV = [
  { to: "/admin", label: "Kitchen Shift", icon: BarChart3, exact: true },
  { to: "/admin/orders", label: "Live Orders", icon: ClipboardList },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes },
] as const;

function AdminLayout() {
  const state = useAdmin();
  const stats = orderStats(state.orders);
  const account = readAccount();
  const role = account?.role;
  const isKitchen = role === "kitchen" || role === "staff";
  const isOwner = role === "owner";
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isCashier = role === "cashier";
  const nav = isKitchen ? KITCHEN_NAV : isCashier ? CASHIER_NAV : ADMIN_NAV;

  const consoleTitle = isKitchen
    ? "Kitchen KDS"
    : isOwner
    ? "Restaurant Owner Console"
    : isAdmin
    ? "Store Admin Console"
    : isManager
    ? "Branch Manager Console"
    : isCashier
    ? "Cashier POS Console"
    : "Operations Console";

  const badgeText = isKitchen
    ? "Kitchen Staff"
    : isOwner
    ? "Restaurant Owner • Full Control"
    : isAdmin
    ? "Store Administrator"
    : isManager
    ? "Branch Manager"
    : isCashier
    ? "Cashier POS"
    : "Operations";

  const tenant = readTenant();
  const restaurantName = tenant?.name || "Kennedy Moon Grill";
  const tenantSlug = currentTenantSlug() || "moon-grill-narowal";

  const [waConnected, setWaConnected] = useState<boolean | null>(null);
  const [waPhone, setWaPhone] = useState<string | null>(null);

  const isWaAdmin = isOwner || isAdmin || isManager;

  useEffect(() => {
    if (!isWaAdmin) return;
    let alive = true;
    let timer: any = null;

    const scheduleNext = (delayMs: number) => {
      if (!alive) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(checkWa, delayMs);
    };

    const checkWa = async () => {
      if (typeof document !== "undefined" && document.hidden) {
        scheduleNext(30000);
        return;
      }
      if (!tokens.access()) return;

      try {
        const res = await fetchWhatsAppStatus(tenantSlug);
        if (alive) {
          setWaConnected(res.is_connected);
          setWaPhone(res.phone ?? null);
          if (res.is_connected === false && !sessionStorage.getItem(`kmg_wa_alert_${tenantSlug}`)) {
            sessionStorage.setItem(`kmg_wa_alert_${tenantSlug}`, "1");
            toast.warning("WhatsApp Gateway Not Connected", {
              description: `Guest OTPs and order notifications for ${restaurantName} require WhatsApp. Click to scan QR code.`,
              action: {
                label: "Scan QR",
                onClick: () => {
                  window.location.href = "/admin/whatsapp";
                },
              },
              duration: 8000,
            });
          }
          // Back off to 180s once connected; 60s when disconnected
          scheduleNext(res.is_connected ? 180000 : 60000);
        }
      } catch {
        if (alive) {
          setWaConnected(false);
          scheduleNext(60000);
        }
      }
    };

    checkWa();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [tenantSlug, restaurantName, isWaAdmin]);

  return (
    <ConsoleShell
      className="admin-caddy-shell"
      brand={restaurantName}
      title={consoleTitle}
      nav={nav}
      badge={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-lux/40 bg-lux/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-lux">
          <Crown className="h-3 w-3" /> {badgeText}
        </span>
      }
      sidebar={
        <div className="space-y-3">
          <div className="panel-lux p-4 text-xs">
            <p className="eyebrow">Right now</p>
            <p className="mt-2 flex items-center justify-between">
              <span className="text-mist">Live orders</span>
              <span className="num-lux text-lg text-lux">{stats.live}</span>
            </p>
            <p className="flex items-center justify-between">
              <span className="text-mist">Unassigned</span>
              <span className="num-lux text-lg text-ruby">{stats.unassigned}</span>
            </p>
            <p className="flex items-center justify-between">
              <span className="text-mist">To verify</span>
              <span className="num-lux text-lg text-amber-lux">{stats.unverified}</span>
            </p>
          </div>

          {/* Luxury WhatsApp Sidebar Shortcut Card */}
          <Link
            to="/admin/whatsapp"
            className={`block rounded-2xl border p-3.5 text-xs transition-all hover:scale-[1.02] shadow-md ${
              waConnected
                ? "border-emerald-500/30 bg-emerald-950/20 hover:border-emerald-500/50 hover:bg-emerald-950/30"
                : "border-amber-500/30 bg-amber-950/20 hover:border-amber-500/50 hover:bg-amber-950/30"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  {waConnected ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </>
                  ) : (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                    </>
                  )}
                </span>
                <span className="font-bold text-white flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-amber-400" />
                  WhatsApp
                </span>
              </div>
              <span
                className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  waConnected
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse"
                }`}
              >
                {waConnected === null ? "Checking" : waConnected ? "Online" : "Scan QR"}
              </span>
            </div>
            <p className="text-[11px] text-[#8a7e6e] truncate">
              {waConnected && waPhone ? `+${waPhone}` : "Tap to open QR & connect"}
            </p>
          </Link>
        </div>
      }
      footer={
        <>
          {account?.isSuperuser && (
            <Link
              to="/platform"
              className="btn-ghost-lux w-full border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
            >
              <Crown className="h-3.5 w-3.5 text-amber-400" /> Platform SaaS
            </Link>
          )}
          {!isKitchen && (
            <Link to="/rider" className="btn-ghost-lux w-full">
              <Bike className="h-3.5 w-3.5" /> Rider app
            </Link>
          )}
          <Link to="/" className="btn-ghost-lux w-full">
            <Store className="h-3.5 w-3.5" /> Storefront
          </Link>
          <button
            onClick={() => {
              resetDemoData();
              toast.success("Sample data restored");
            }}
            className="btn-ghost-lux w-full"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset data
          </button>
          <button
            onClick={() => {
              signOut();
              toast.success("Signed out");
              window.location.href = "/login";
            }}
            className="btn-ghost-lux w-full text-ruby hover:border-ruby/40 hover:text-ruby"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </>
      }
    >
      <Outlet />
    </ConsoleShell>
  );
}
