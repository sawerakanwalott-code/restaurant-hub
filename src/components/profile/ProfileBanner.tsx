/**
 * Customer profile banner: charcoal-grill hero image, ringed avatar and stats.
 * Presentation only — all data arrives as props from src/routes/profile.tsx.
 */
import { useRef } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Camera, ChevronLeft, LogOut } from "lucide-react";

import bannerImage from "@/assets/profile-banner.webp";
import customerAvatar from "@/assets/customer-avatar.webp";

export type ProfileStat = { label: string; value: string };

type Props = {
  name: string;
  email: string;
  joined?: string | null;
  avatarUrl?: string | null;
  tier?: string;
  stats: ProfileStat[];
  onChangeAvatar?: () => void;
  onPickAvatar?: (file: File) => void;
  onSignOut?: () => void;
};

export function ProfileBanner({
  name,
  email,
  joined,
  avatarUrl,
  stats,
  onChangeAvatar,
  onPickAvatar,
  onSignOut,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canEditPhoto = !!(onPickAvatar || onChangeAvatar);

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-[1.25rem] bg-charcoal text-cream shadow-[0_26px_60px_rgba(20,14,10,0.28)]"
    >
      {/* banner */}
      <div className="relative h-36 w-full sm:h-48">
        <img
          src={bannerImage}
          alt="Charcoal grill embers"
          width={1920}
          height={560}
          className="h-full w-full object-cover" loading="lazy" decoding="async" />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/30 to-transparent" />
        {/* top-left notch: Menu */}
        <div className="absolute left-0 top-0 z-10 rounded-br-[1.25rem] bg-cream pb-2 pr-2">
          <Link
            to="/"
            className="flex h-10 items-center gap-1 rounded-full bg-flame pl-2 pr-4 font-body text-xs font-bold text-cream shadow-[var(--shadow-pill)] transition-transform active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Menu
          </Link>
          <span aria-hidden="true" className="notch-tl absolute left-full top-0 h-5 w-5 [--notch-r:1.25rem]" />
          <span aria-hidden="true" className="notch-tl absolute left-0 top-full h-5 w-5 [--notch-r:1.25rem]" />
        </div>
        {/* top-right notch: Sign out */}
        {onSignOut && (
          <div className="absolute right-0 top-0 z-10 rounded-bl-[1.25rem] bg-cream pb-2 pl-2">
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              className="grid h-10 w-10 place-items-center rounded-full bg-flame text-cream shadow-[var(--shadow-pill)] transition-transform active:scale-95"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
            <span aria-hidden="true" className="notch-tr absolute right-full top-0 h-5 w-5 [--notch-r:1.25rem]" />
            <span aria-hidden="true" className="notch-tr absolute right-0 top-full h-5 w-5 [--notch-r:1.25rem]" />
          </div>
        )}
      </div>

      {/* identity row */}
      <div className="relative -mt-10 px-4 pb-4 sm:-mt-12 sm:px-8 sm:pb-8">
        <div className="flex items-end gap-3 text-left sm:gap-5">
          <div className="relative shrink-0">
            <span className="block rounded-2xl bg-charcoal p-1.5 shadow-[0_18px_40px_rgba(20,14,10,0.45)]">
              <img
                src={avatarUrl || customerAvatar}
                alt={name}
                width={816}
                height={816}
                loading="lazy"
                decoding="async"
                className="h-16 w-16 rounded-xl border-2 border-flame object-cover sm:h-24 sm:w-24 sm:rounded-xl"
              />
            </span>
            {canEditPhoto && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onPickAvatar?.(file);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => (onPickAvatar ? fileRef.current?.click() : onChangeAvatar?.())}
                  aria-label="Change profile photo"
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-charcoal bg-flame text-cream transition-transform hover:scale-105 sm:h-9 sm:w-9"
                >
                  <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          <div className="min-w-0 flex-1 pb-0.5">
            <h1 className="truncate font-display text-lg font-extrabold uppercase leading-tight sm:text-2xl">
              {name}
            </h1>
            {email && <p className="truncate font-body text-[13px] text-cream/70 sm:text-sm">{email}</p>}
            {joined && (
              <p className="mt-0.5 font-body text-[11px] text-cream/45">
                Member since {new Date(joined).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
              </p>
            )}
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-3 divide-x divide-cream/10 overflow-hidden rounded-2xl border border-cream/10 bg-cream/[0.07] text-center sm:mt-6">
          {stats.map((stat) => (
            <div key={stat.label} className="flex min-w-0 flex-col-reverse px-2 py-2 sm:py-2.5">
              <dt className="mt-0.5 font-body text-[10px] uppercase tracking-widest text-cream/55">{stat.label}</dt>
              <dd className="truncate font-display text-sm font-extrabold leading-tight sm:text-base">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </motion.section>
  );
}
