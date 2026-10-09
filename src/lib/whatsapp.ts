import { api } from "@/lib/api/client";

export interface WhatsAppStatus {
  is_connected: boolean;
  status: string;
  phone?: string | null;
  user_name?: string | null;
  uptime?: number;
  qrcode?: string | null;
  pairing_code?: string | null;
  restaurant_name?: string;
}

// Module-level in-flight promise coalescing and short-term cache
let inFlight: Promise<WhatsAppStatus> | null = null;
let cachedStatus: { data: WhatsAppStatus; expiresAt: number } | null = null;

export async function fetchWhatsAppStatus(
  tenantSlug: string,
  force = false
): Promise<WhatsAppStatus> {
  const now = Date.now();
  if (!force && cachedStatus && cachedStatus.expiresAt > now) {
    return cachedStatus.data;
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    try {
      const url = `/whatsapp/qr/?tenant=${encodeURIComponent(tenantSlug)}${force ? "&force=1" : ""}`;
      const data = await api.get<WhatsAppStatus>(url);
      cachedStatus = {
        data,
        // Cache for 30s when connected, 5s when disconnected
        expiresAt: Date.now() + (data.is_connected ? 30000 : 5000),
      };
      return data;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function invalidateWhatsAppCache() {
  cachedStatus = null;
}
