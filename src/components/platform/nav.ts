import { Building2, CreditCard, Gauge, LifeBuoy, Megaphone, Plug, Receipt, ScrollText, Settings, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type View = "overview" | "restaurants" | "plans" | "billing" | "support" | "announcements" | "team" | "integrations" | "audit" | "settings";

export const NAV: { group: string; items: { id: View; label: string; icon: LucideIcon }[] }[] = [
  { group: "Business", items: [
    { id: "overview", label: "Dashboard", icon: Gauge },
    { id: "restaurants", label: "Restaurants", icon: Building2 },
    { id: "plans", label: "Plans", icon: CreditCard },
    { id: "billing", label: "Invoices", icon: Receipt },
  ] },
  { group: "Customers", items: [
    { id: "support", label: "Support", icon: LifeBuoy },
    { id: "announcements", label: "Announcements", icon: Megaphone },
  ] },
  { group: "Control", items: [
    { id: "team", label: "Team & access", icon: UsersRound },
    { id: "integrations", label: "Connections", icon: Plug },
    { id: "audit", label: "Activity log", icon: ScrollText },
    { id: "settings", label: "Settings", icon: Settings },
  ] },
];
