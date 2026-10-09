import { Link, useRouterState } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { Bike, ChevronLeft, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchOrders, type DbOrder } from "@/lib/account";
import { STATUS_LABEL } from "@/lib/order-status";

const ACTIVE_STATUSES = new Set(["pending", "confirmed", "kitchen", "packed", "onway"]);

export function ActiveOrderTab() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const reduceMotion = useReducedMotion();
  const [order, setOrder] = useState<DbOrder | null>(null);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      const orders = await fetchOrders();
      if (!mounted) return;
      setOrder(orders.find((item) => ACTIVE_STATUSES.has(item.status)) ?? null);
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const hidden =
    pathname.startsWith("/track/") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/rider") ||
    pathname === "/cart" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup");

  if (!order || hidden) return null;

  const label = STATUS_LABEL[order.status] ?? "Order live";

  return (
    <motion.div
      initial={reduceMotion ? false : { x: 90, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="group fixed right-0 top-[42%] z-[150] -translate-y-1/2"
    >
      <div>
        <Link
          to="/profile"
          search={{ tab: "live" }}
          aria-label={`Track order ${order.order_code}: ${label}`}
          className="active-order-tab flex min-h-20 w-[4.75rem] items-center overflow-hidden rounded-l-2xl border-2 border-r-0 border-cream/70 bg-flame text-cream shadow-[0_16px_34px_rgba(20,14,10,0.35)] transition-[width,transform] duration-300 hover:w-[17.5rem] focus-visible:w-[17.5rem] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold/55 sm:w-[5.25rem]"
        >
          <span className="relative grid h-full min-w-[4.75rem] place-items-center px-3 py-3 sm:min-w-[5.25rem]">
            <span className="absolute left-2 top-2 flex h-2.5 w-2.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-70 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold" />
            </span>
            <Bike className="h-6 w-6 text-cream" aria-hidden="true" />
            <span className="mt-1 text-center font-display text-[10px] font-extrabold uppercase leading-tight tracking-[0.12em]">
              Order live
            </span>
            <ChevronLeft className="absolute bottom-2 right-1.5 h-3.5 w-3.5 text-cream/60 transition-transform group-hover:-translate-x-1" aria-hidden="true" />
          </span>

          <span className="min-w-0 flex-1 border-l border-cream/15 py-3 pl-4 pr-4 opacity-0 transition-opacity delay-75 duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
            <span className="block truncate font-display text-xs font-extrabold uppercase text-cream">
              {label}
            </span>
            <span className="mt-1 flex items-center gap-1.5 whitespace-nowrap font-body text-xs text-cream/85">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              ETA {order.eta_minutes} min · #{order.order_code}
            </span>
            <span className="mt-2 block font-display text-[10px] font-extrabold uppercase tracking-[0.14em] text-cream">
              Click to track →
            </span>
          </span>
        </Link>
      </div>
    </motion.div>
  );
}