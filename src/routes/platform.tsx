import { createFileRoute, redirect } from "@tanstack/react-router";

import { readAccount } from "@/lib/auth";
import { Shell } from "@/components/platform/Shell";
import { PlatformProvider } from "@/components/platform/store";
import "@/styles/platform.css";

export const Route = createFileRoute("/platform")({
  ssr: false,
  beforeLoad: () => {
    const acct = readAccount();
    if (!acct || !acct.isSuperuser) {
      throw redirect({ to: "/login" });
    }
  },
  head: () => ({
    meta: [
      { title: "Platform Owner Console" },
      { name: "description", content: "Control every restaurant, plan, invoice and connection on the platform." },
      { property: "og:title", content: "Platform Owner Console" },
      { property: "og:description", content: "Control every restaurant, plan, invoice and connection on the platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PlatformProvider>
      <Shell />
    </PlatformProvider>
  ),
});
