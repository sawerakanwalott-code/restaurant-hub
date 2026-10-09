export type SubStatus = "trialing" | "active" | "past_due" | "cancelled" | "none";

export type PlatformStats = {
  tenants: { total: number; active: number; paused: number };
  orders: { today: number; total: number };
  revenue_pkr: { today: number; total: number };
  subscriptions: { trialing: number; active: number; past_due: number; cancelled: number };
  pending_invoices_count: number;
  mrr_pkr?: number;
};

export type PlatformTenant = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  subscription_status: SubStatus;
  plan_name: string;
  plan_slug: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  orders_today: number;
  orders_total: number;
  revenue_today: number;
  revenue_total: number;
  staff_count: number;
  branch_count: number;
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  city?: string;
  domain?: string;
  whatsapp_connected?: boolean;
  features?: Record<string, boolean>;
  limits?: { orders_per_day: number; staff_seats: number; branches: number };
  health_score?: number;
};

export type InvoiceStatus = "pending" | "under_review" | "paid" | "rejected";

export type Invoice = {
  id: number;
  subscription: { tenant: { slug: string; name: string }; plan: { name: string } };
  amount_pkr: string;
  status: InvoiceStatus;
  period_start: string;
  period_end: string;
  jazzcash_transaction_id: string;
  payment_proof_url: string;
  paid_at: string | null;
  created_at: string;
  admin_notes: string;
  due_date?: string;
};

export type Plan = {
  slug: string;
  name: string;
  price_pkr: number;
  interval: "month" | "year";
  orders_per_day: number;
  staff_seats: number;
  branches: number;
  features: string[];
  is_public: boolean;
  tenant_count?: number;
};

export type Ticket = {
  id: string;
  tenant_slug: string;
  tenant_name: string;
  subject: string;
  body: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "pending" | "resolved";
  created_at: string;
  assignee?: string;
  replies: { from: string; body: string; at: string }[];
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: "all" | "trialing" | "active" | "past_due" | string;
  channels: ("banner" | "email" | "whatsapp")[];
  status: "draft" | "scheduled" | "sent";
  send_at: string;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "super_owner" | "finance" | "support" | "sales" | "viewer";
  two_factor: boolean;
  last_active: string;
  status: "active" | "invited" | "disabled";
};

export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  category: "tenant" | "billing" | "team" | "security" | "settings" | "support";
  ip?: string;
};

export type Integration = {
  key: string;
  name: string;
  description: string;
  status: "connected" | "degraded" | "disconnected";
  last_check: string;
  detail: string;
};

export type PlatformSettings = {
  platform_name: string;
  support_email: string;
  support_whatsapp: string;
  default_plan: string;
  trial_days: number;
  grace_days: number;
  auto_pause_unpaid: boolean;
  signup_mode: "open" | "approval" | "closed";
  maintenance_mode: boolean;
  payout_jazzcash: string;
  payout_bank: string;
  terms_url: string;
  /** Each restaurant must scan a QR to link its own WhatsApp number for OTP/order messages. */
  wa_require_own_number: boolean;
  /** When a restaurant's WhatsApp isn't linked or a send fails, send by text (SMS) instead. */
  wa_sms_fallback: boolean;
  /** Block the restaurant admin until they link WhatsApp (after the grace days). */
  wa_block_until_linked: boolean;
  wa_link_grace_days: number;
  /** How often restaurants are reminded to relink when disconnected (hours, 0 = never). */
  wa_reminder_hours: number;
};

export type DataSource = "live" | "sample";
