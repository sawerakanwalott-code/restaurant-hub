# Backend work list — Platform Owner Console

The platform owner page (`/platform`) is now a full SaaS-owner console. It reads your Django
API at `VITE_API_BASE_URL`. Everything below is listed by endpoint: **what to build, method,
request and response JSON**, so each item can be implemented one at a time.

Endpoints already working (do not change):

| Endpoint | Used for |
|---|---|
| `GET /platform/stats/` | Overview numbers |
| `GET /platform/tenants/` · `POST /platform/tenants/` | Restaurant list · add restaurant |
| `GET /platform/tenants/{slug}/` · `PATCH` · `DELETE` | Detail · pause/resume/profile/plan · delete |
| `PATCH /platform/tenants/{slug}/subscription/` | Change plan / status |
| `GET /platform/invoices/` · `POST /platform/invoices/{id}/verify/` | Invoices · approve/reject proof |
| `GET /whatsapp/qr/` · `POST /whatsapp/restart/` · `POST /whatsapp/logout/` | WhatsApp connect |

Today the UI calls these **new** endpoints too. Until each one exists, the page keeps the
change on screen only (sample data) and shows the owner a "backend isn't ready yet" note.
The console detects 404/405/501 as "not built" — so ship them in any order.

---

## 1. `GET /platform/stats/trend/` — charts
Response:
```json
[{"month": "Nov", "mrr": 12000, "orders": 4200, "signups": 3, "churn": 0}]
```
Last 12 months, `mrr` = subscription income in PKR for that month.

## 2. Plans
- `GET /platform/plans/` → list (already called; return full objects, see model below)
- `POST /platform/plans/` · `PATCH /platform/plans/{slug}/` · `DELETE`
```json
{"slug":"growth-plan","name":"Growth","price_pkr":10000,"interval":"month",
 "orders_per_day":500,"staff_seats":15,"branches":3,
 "features":["WhatsApp ordering","AI voice orders"],"is_public":true}
```

## 3. `GET /platform/tenants/{slug}/users/` — restaurant staff
```json
[{"id":1,"name":"Hussnain","username":"hussnain","role":"owner","phone":"+92…","last_login":"…","is_active":true}]
```
Also: `PATCH .../users/{id}/` (`is_active` lock/unlock) and
`POST .../users/{id}/reset-password/` (sets a temporary password, forces change at next login).

## 4. `PATCH /platform/tenants/{slug}/features/` — feature switches & limits
```json
{"ai_voice": true, "whatsapp": false, "riders": true, "pos": true, "multi_branch": false, "coupons": true,
 "limits": {"orders_per_day": 500, "staff_seats": 15, "branches": 3}}
```
Feature keys must apply in the tenant's app: `ai_voice`, `whatsapp`, `riders`, `pos`,
`multi_branch`, `coupons`. `limits` override the plan (null = use plan default).
Enforce `limits.orders_per_day` when the tenant takes orders.

## 5. `POST /platform/tenants/{slug}/impersonate/` — "Open their admin"
Response: `{"token": "…", "expire_seconds": 3600}` — a short-lived superuser-signed token
that authenticates the console as that tenant's owner. Log the impersonation in the audit log.

## 6. Invoices
- `GET /platform/invoices/` (already used) — add optional `?status=`
- `POST /platform/invoices/` — `{"tenant_slug": "…", "amount_pkr": 6000, "admin_notes": "…"}`
- `POST /platform/invoices/{id}/remind/` — sends WhatsApp + email reminder
- Extend `verify` payload to `{"action": "approve"|"reject", "admin_notes": "…"}` (approve must
  mark the subscription `active` and push `current_period_end` forward)

## 7. `GET/POST /platform/tickets/` — support requests
```json
{"id":"T-311","tenant_slug":"…","tenant_name":"…","subject":"…","body":"…",
 "priority":"low|normal|high|urgent","status":"open|pending|resolved",
 "created_at":"…","assignee":"…","replies":[{"from":"…","body":"…","at":"…"}]}
```
Also: `PATCH /platform/tickets/{id}/` (priority, status, assignee) and
`POST /platform/tickets/{id}/reply/` `{"body": "…"}` — reply must reach the restaurant owner
on WhatsApp and email.

## 8. `GET/POST /platform/announcements/`
```json
{"id":"A-1","title":"…","body":"…","audience":"all|active|trialing|past_due|<slug>",
 "channels":["banner","whatsapp","email"],"status":"draft|scheduled|sent","send_at":"…"}
```
`banner` shows a dismissible banner inside each restaurant's admin page — the tenant app needs
a `GET /announcements/` (tenant-scoped) to fetch active banners.

## 9. `GET/POST /platform/team/` · `PATCH /platform/team/{id}/` — platform staff
```json
{"id":"u1","name":"…","email":"…","role":"super_owner|finance|support|sales|viewer",
 "two_factor":true,"last_active":"…","status":"active|invited|disabled"}
```
Roles must be enforced server-side on the platform endpoints (finance → billing only, etc.).
POST sends an email invite. `two_factor` comes from the auth system.

## 10. `GET /platform/audit/` — activity log
```json
[{"id":"…","at":"…","actor":"…","action":"Approved invoice #1043","target":"Kennedy Moon Grill",
  "category":"tenant|billing|team|security|settings|support","ip":"…"}]
```
Write one row for every platform-owner action (backend should log its own mutations too).

## 11. `GET/PATCH /platform/settings/`
```json
{"platform_name":"Kennedy SaaS","support_email":"…","support_whatsapp":"…",
 "default_plan":"free-trial","trial_days":15,"grace_days":5,"auto_pause_unpaid":true,
 "signup_mode":"open|approval|closed","maintenance_mode":false,
 "payout_jazzcash":"…","payout_bank":"…","terms_url":"…"}
```
`grace_days` + `auto_pause_unpaid` should drive a scheduled job: unpaid past grace → pause tenant.

## 12. `GET /platform/integrations/` — service health
```json
[{"key":"whatsapp","name":"WhatsApp (Evolution)","description":"…",
  "status":"connected|degraded|disconnected","last_check":"…","detail":"4 of 6 restaurants connected"}]
```
Keys used by the UI: `api`, `whatsapp`, `elevenlabs`, `jazzcash`, `email`, `sms`.
The `api` entry is overwritten client-side by a live ping — the rest come from here.

## 13. Extend tenant list/detail payloads
So the console can stop sampling, include on each tenant object:
```json
{"city":"…","owner_name":"…","owner_email":"…","owner_phone":"…","domain":"…",
 "orders_today":64,"orders_total":18420,"revenue_today":92000,"revenue_total":5200000,
 "staff_count":12,"branch_count":2,"whatsapp_connected":true,"health_score":92,
 "features":{"ai_voice":true,"whatsapp":true,"riders":true,"pos":false,"multi_branch":true,"coupons":true},
 "limits":{"orders_per_day":500,"staff_seats":15,"branches":3}}
```
`health_score` (0–100) suggestion: 100 − 30×past_due − 20×whatsapp_disconnected − 15×(orders<25% of usual) …

---

### Priority order
1. Tenant payload extensions + `users/` + `features/` (biggest owner value)
2. `impersonate/` (fast to build, huge convenience)
3. `plans/` CRUD + `stats/trend/`
4. `settings/` + `audit/`
5. `tickets/` + `announcements/` + `team/` + `integrations/` + invoice additions

## WhatsApp own-number policy (OTP + order messages)

Each restaurant links its own WhatsApp number by scanning the QR in its admin (`/whatsapp/qr/?tenant=`). Add these fields to `GET/PATCH /platform/settings/`:

| Field | Type | Meaning |
|---|---|---|
| `wa_require_own_number` | bool | Restaurant must link its own number; never send from a shared platform number |
| `wa_sms_fallback` | bool | If tenant WhatsApp is not connected or a send fails, send the OTP by SMS |
| `wa_block_until_linked` | bool | After `wa_link_grace_days`, restaurant admin shows a blocking "Link WhatsApp" screen |
| `wa_link_grace_days` | int | Days after signup to link before blocking/strict reminders |
| `wa_reminder_hours` | int | Remind disconnected restaurant owners every N hours (0 = off) |

Backend behaviour for `POST /auth/phone/request-code/`: use the tenant's own WhatsApp session; if disconnected or the send errors and `wa_sms_fallback` is true, send SMS and return `channel: "sms"`, `sent_via_whatsapp: false`. If fallback is off, return 503 with a clear message. `/auth/phone/config/` must return `whatsapp_connected` per tenant. Log each fallback in audit (`category: "integrations"`).

---

## Restaurant admin — still missing on the backend (appended)

Each restaurant has its own admin. These are needed by the admin console and are not covered above:

### A. Payment receipt on orders (JazzCash / EasyPaisa)
- Customer checkout uploads a screenshot/PDF: `POST /orders/{id}/payment-proof/` (multipart `file`, max 8 MB, image/* or pdf).
- Every order payload must include `payment_proof_url` (absolute https URL, or null) plus `payment_reference`, `amount_paid`, `paid_at`, `verified_by`.
- Store files per tenant (`tenants/{slug}/receipts/...`), served via signed URL; only that tenant's admin/cashier may read.
- `POST /orders/{id}/verify-payment/` already exists — log approve/reject in the tenant audit log with who and when.

### B. Other admin gaps
- Tenant audit log: `GET /admin/audit/` (staff actions on orders, menu, prices, refunds).
- Refunds: `POST /orders/{id}/refund/` with amount + reason; sets `payment_status=refunded`.
- Opening hours & holiday closures: `GET/PATCH /admin/settings/hours/`; checkout must reject orders when closed.
- Delivery zones & fees per branch: `GET/POST/PATCH /branches/{id}/zones/`.
- Restaurant settings: `GET/PATCH /admin/settings/` (name, logo, tax %, service charge, min order, wallet numbers for JazzCash/EasyPaisa shown at checkout).
- Reports export: `GET /admin/reports/sales/?from=&to=&format=csv`.
- Subscription view for the owner: `GET /admin/subscription/` (plan, limits used, next invoice) mirroring platform data.
- Notifications feed: `GET /admin/notifications/` + WebSocket event `payment_proof_uploaded` so admins see new receipts live.

### C. Restaurant admin endpoints the new admin pages call (scoped to the signed-in tenant)
Until each exists the page shows "Preview data" and keeps changes on screen only (404/405/501 = not built).

| Page | Endpoint | Notes |
|---|---|---|
| Settings | `GET/PATCH /admin/settings/` | Body below. Checkout must read wallet numbers, fees, tax, min order, hours, `pause_online_orders` from here |
| Coupons | `GET/POST /admin/coupons/` · `PATCH/DELETE /admin/coupons/{id}/` | Validate at `/coupons/preview/`: dates, `max_uses`, `per_customer`, `min_order`, `max_discount` |
| Reviews | `GET /admin/reviews/` · `POST /admin/reviews/{id}/reply/` `{reply}` · `PATCH /admin/reviews/{id}/` `{hidden}` | Create a review when the customer rates a delivered order (food, delivery, comment) |
| Activity log | `GET /admin/audit/?category=&q=` | Write a row on every staff mutation (orders, payments, refunds, menu/price, staff, settings) |
| Sales reports | (optional) `GET /admin/reports/sales/?from=&to=&format=csv` | Page computes from loaded orders today; a server version is needed for long ranges |

Settings body:
```json
{"name":"…","phone":"…","address":"…","logo_url":"…","tax_percent":16,"service_charge_percent":0,
 "min_order":500,"delivery_fee":150,"free_delivery_over":3000,"delivery_radius_km":6,
 "jazzcash_number":"…","jazzcash_title":"…","easypaisa_number":"…","easypaisa_title":"…",
 "accept_cod":true,"accept_wallets":true,"require_receipt":true,"auto_accept_orders":false,"pause_online_orders":false,
 "hours":[{"day":"Monday","open":"12:00","close":"00:00","closed":false}],
 "holidays":[{"date":"2026-10-30","note":"Eid — closed"}]}
```
Coupon: `{"id","code","kind":"percent|flat|free_delivery","value","min_order","max_discount","uses","max_uses","per_customer","starts","ends","active"}`
Review: `{"id","order_code","customer","rating","food","delivery","comment","at","reply","hidden"}`
Audit: `{"id","at","actor","role","action","target","category":"order|payment|menu|staff|settings|refund"}`
