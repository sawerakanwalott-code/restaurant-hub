/**
 * Clearly-labelled sample data for the platform owner console.
 * Used only when the matching backend endpoint does not exist yet (see do_backend.md).
 * Built lazily via functions — never at module scope (Workers disallow Date/random there).
 */
import type {
  Announcement,
  AuditEvent,
  Integration,
  Invoice,
  Plan,
  PlatformSettings,
  PlatformStats,
  PlatformTenant,
  TeamMember,
  Ticket,
} from "./types";

const day = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();

export function samplePlans(): Plan[] {
  return [
    { slug: "free-trial", name: "Free Trial", price_pkr: 0, interval: "month", orders_per_day: 50, staff_seats: 3, branches: 1, features: ["Online menu", "Orders", "Kitchen screen"], is_public: true },
    { slug: "basic-plan", name: "Basic", price_pkr: 6000, interval: "month", orders_per_day: 100, staff_seats: 6, branches: 1, features: ["Online menu", "Orders", "Kitchen screen", "Riders", "POS"], is_public: true },
    { slug: "growth-plan", name: "Growth", price_pkr: 10000, interval: "month", orders_per_day: 500, staff_seats: 15, branches: 3, features: ["Everything in Basic", "WhatsApp ordering", "AI voice orders", "Coupons", "Analytics"], is_public: true },
    { slug: "enterprise-plan", name: "Enterprise", price_pkr: 25000, interval: "month", orders_per_day: 99999, staff_seats: 99, branches: 20, features: ["Everything in Growth", "Custom domain", "Priority support", "Dedicated manager"], is_public: false },
  ];
}

export function sampleTenants(): PlatformTenant[] {
  const base = [
    ["Kennedy Moon Grill", "moon-grill-narowal", "Narowal", "growth-plan", "Growth", "active", true, 64, 18420, 92000, 5200000, 12, 2, true, 92],
    ["Lahore Tikka House", "lahore-tikka", "Lahore", "basic-plan", "Basic", "active", true, 31, 6110, 41000, 1900000, 7, 1, true, 78],
    ["Karachi Biryani Co.", "karachi-biryani", "Karachi", "growth-plan", "Growth", "past_due", true, 12, 9020, 15000, 3100000, 9, 2, false, 41],
    ["Sialkot Pizza Point", "sialkot-pizza", "Sialkot", "free-trial", "Free Trial", "trialing", true, 8, 140, 9000, 82000, 3, 1, true, 66],
    ["Islamabad Grill Hub", "isb-grill-hub", "Islamabad", "enterprise-plan", "Enterprise", "active", true, 140, 52300, 260000, 18900000, 34, 6, true, 97],
    ["Multan Sajji Point", "multan-sajji", "Multan", "basic-plan", "Basic", "cancelled", false, 0, 2300, 0, 610000, 4, 1, false, 12],
  ] as const;
  return base.map((r, i) => ({
    id: String(i + 1),
    name: r[0],
    slug: r[1],
    city: r[2],
    plan_slug: r[3],
    plan_name: r[4],
    subscription_status: r[5],
    is_active: r[6],
    orders_today: r[7],
    orders_total: r[8],
    revenue_today: r[9],
    revenue_total: r[10],
    staff_count: r[11],
    branch_count: r[12],
    whatsapp_connected: r[13],
    health_score: r[14],
    created_at: iso(-200 + i * 30),
    trial_ends_at: r[5] === "trialing" ? iso(4) : null,
    current_period_end: iso(r[5] === "past_due" ? -6 : 12 + i),
    owner_name: ["Hussnain Ali", "Bilal Ahmed", "Sana Raza", "Usman Tariq", "Ayesha Khan", "Kamran Javed"][i],
    owner_email: `owner@${r[1]}.pk`,
    owner_phone: `+92 30${i} 555 01${i}${i}`,
    domain: `${r[1]}.kennedy.app`,
    features: { ai_voice: i % 2 === 0, whatsapp: true, riders: true, pos: i !== 3, multi_branch: r[12] > 1, coupons: true },
    limits: { orders_per_day: [500, 100, 500, 50, 99999, 100][i]!, staff_seats: [15, 6, 15, 3, 99, 6][i]!, branches: [3, 1, 3, 1, 20, 1][i]! },
  }));
}

export function sampleStats(t: PlatformTenant[]): PlatformStats {
  const by = (s: string) => t.filter((x) => x.subscription_status === s).length;
  return {
    tenants: { total: t.length, active: t.filter((x) => x.is_active).length, paused: t.filter((x) => !x.is_active).length },
    orders: { today: t.reduce((a, x) => a + x.orders_today, 0), total: t.reduce((a, x) => a + x.orders_total, 0) },
    revenue_pkr: { today: t.reduce((a, x) => a + x.revenue_today, 0), total: t.reduce((a, x) => a + x.revenue_total, 0) },
    subscriptions: { trialing: by("trialing"), active: by("active"), past_due: by("past_due"), cancelled: by("cancelled") },
    pending_invoices_count: 2,
    mrr_pkr: 51000,
  };
}

export function sampleInvoices(): Invoice[] {
  const rows: [string, string, string, string, Invoice["status"], number][] = [
    ["moon-grill-narowal", "Kennedy Moon Grill", "Growth", "10000", "paid", -20],
    ["karachi-biryani", "Karachi Biryani Co.", "Growth", "10000", "under_review", -3],
    ["lahore-tikka", "Lahore Tikka House", "Basic", "6000", "pending", -1],
    ["isb-grill-hub", "Islamabad Grill Hub", "Enterprise", "25000", "paid", -12],
    ["multan-sajji", "Multan Sajji Point", "Basic", "6000", "rejected", -40],
  ];
  return rows.map((r, i) => ({
    id: 1040 + i,
    subscription: { tenant: { slug: r[0], name: r[1] }, plan: { name: r[2] } },
    amount_pkr: r[3],
    status: r[4],
    period_start: iso(r[5] - 30),
    period_end: iso(r[5]),
    jazzcash_transaction_id: r[4] === "pending" ? "" : `JC${880120 + i * 7}`,
    payment_proof_url: r[4] === "under_review" || r[4] === "paid" ? "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800" : "",
    paid_at: r[4] === "paid" ? iso(r[5] + 2) : null,
    created_at: iso(r[5]),
    due_date: iso(r[5] + 7),
    admin_notes: r[4] === "rejected" ? "Transaction ID not found in JazzCash statement." : "",
  }));
}

export function sampleTickets(): Ticket[] {
  return [
    { id: "T-311", tenant_slug: "karachi-biryani", tenant_name: "Karachi Biryani Co.", subject: "WhatsApp orders stopped arriving", body: "Since this morning no WhatsApp orders reach the kitchen.", priority: "urgent", status: "open", created_at: iso(-0.1), replies: [] },
    { id: "T-309", tenant_slug: "sialkot-pizza", tenant_name: "Sialkot Pizza Point", subject: "How do I add a second branch?", body: "We are opening in Daska next month.", priority: "normal", status: "pending", created_at: iso(-1), assignee: "Support Desk", replies: [{ from: "Support Desk", body: "Branches are available on Growth. Want us to upgrade you?", at: iso(-0.8) }] },
    { id: "T-302", tenant_slug: "lahore-tikka", tenant_name: "Lahore Tikka House", subject: "Invoice shows wrong amount", body: "We were charged for Growth but we are on Basic.", priority: "high", status: "open", created_at: iso(-2), replies: [] },
    { id: "T-288", tenant_slug: "moon-grill-narowal", tenant_name: "Kennedy Moon Grill", subject: "Menu photos upload slowly", body: "Large photos take a minute.", priority: "low", status: "resolved", created_at: iso(-6), assignee: "Support Desk", replies: [{ from: "Support Desk", body: "Fixed — images are now compressed on upload.", at: iso(-5) }] },
  ];
}

export function sampleAnnouncements(): Announcement[] {
  return [
    { id: "A-12", title: "Eid opening hours reminder", body: "Set your Eid timings from Admin → Settings before Friday.", audience: "all", channels: ["banner", "whatsapp"], status: "sent", send_at: iso(-4) },
    { id: "A-13", title: "Your trial ends soon", body: "Upgrade to Basic to keep taking orders.", audience: "trialing", channels: ["email", "whatsapp"], status: "scheduled", send_at: iso(2) },
  ];
}

export function sampleTeam(): TeamMember[] {
  return [
    { id: "u1", name: "Platform Owner", email: "owner@kennedy.app", role: "super_owner", two_factor: true, last_active: iso(0), status: "active" },
    { id: "u2", name: "Fatima Noor", email: "finance@kennedy.app", role: "finance", two_factor: true, last_active: iso(-0.3), status: "active" },
    { id: "u3", name: "Ali Hassan", email: "support@kennedy.app", role: "support", two_factor: false, last_active: iso(-1), status: "active" },
    { id: "u4", name: "Zara Malik", email: "sales@kennedy.app", role: "sales", two_factor: false, last_active: iso(-9), status: "invited" },
  ];
}

export function sampleAudit(): AuditEvent[] {
  const e: [string, string, string, AuditEvent["category"], number][] = [
    ["Platform Owner", "Approved invoice #1043", "Islamabad Grill Hub", "billing", -0.05],
    ["Fatima Noor", "Rejected invoice #1044", "Multan Sajji Point", "billing", -0.3],
    ["Platform Owner", "Paused restaurant", "Multan Sajji Point", "tenant", -1],
    ["Ali Hassan", "Replied to ticket T-309", "Sialkot Pizza Point", "support", -0.8],
    ["Platform Owner", "Extended trial by 7 days", "Sialkot Pizza Point", "tenant", -2],
    ["System", "Failed unlock attempt", "Platform console", "security", -2.4],
    ["Platform Owner", "Changed Growth plan price", "Growth plan", "settings", -5],
    ["Platform Owner", "Invited team member", "zara@kennedy.app", "team", -9],
  ];
  return e.map((r, i) => ({ id: `e${i}`, actor: r[0], action: r[1], target: r[2], category: r[3], at: iso(r[4]), ip: `39.40.12.${10 + i}` }));
}

export function sampleIntegrations(): Integration[] {
  return [
    { key: "api", name: "API server", description: "Your Django backend", status: "connected", last_check: iso(0), detail: "Checked live on load" },
    { key: "whatsapp", name: "WhatsApp (Evolution)", description: "Order + OTP messages for every restaurant", status: "degraded", last_check: iso(0), detail: "4 of 6 restaurants connected" },
    { key: "elevenlabs", name: "AI voice ordering", description: "ElevenLabs voice agent", status: "connected", last_check: iso(0), detail: "Signed URLs issuing normally" },
    { key: "jazzcash", name: "JazzCash payments", description: "Subscription payment proofs", status: "connected", last_check: iso(0), detail: "Manual verification" },
    { key: "email", name: "Email sending", description: "Password resets, invoices, announcements", status: "disconnected", last_check: iso(0), detail: "No mail provider configured" },
    { key: "sms", name: "SMS fallback", description: "When WhatsApp is down", status: "disconnected", last_check: iso(0), detail: "Not set up" },
  ];
}

export function sampleSettings(): PlatformSettings {
  return {
    platform_name: "Kennedy SaaS",
    support_email: "support@kennedy.app",
    support_whatsapp: "+92 300 0000000",
    default_plan: "free-trial",
    trial_days: 15,
    grace_days: 5,
    auto_pause_unpaid: true,
    signup_mode: "approval",
    maintenance_mode: false,
    payout_jazzcash: "0300-0000000 (Kennedy SaaS)",
    payout_bank: "Meezan Bank — PK00 MEZN 0000 0000 0000",
    terms_url: "https://kennedy.app/terms",
    wa_require_own_number: true,
    wa_sms_fallback: true,
    wa_block_until_linked: false,
    wa_link_grace_days: 3,
    wa_reminder_hours: 24,
  };
}

/** 12 months of trend points for the charts. */
export function sampleTrend() {
  const m = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
  return m.map((month, i) => ({
    month,
    mrr: 12000 + i * 3600 + (i % 3) * 1500,
    orders: 4200 + i * 1100 + (i % 2) * 600,
    signups: 1 + (i % 4),
    churn: i % 5 === 0 ? 1 : 0,
  }));
}
