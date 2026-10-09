/**
 * ============================================================================
 * SLICE 1.4 — FORCED PASSWORD CHANGE
 * ============================================================================
 * When an owner creates a staff account the backend returns a one-time temp
 * password and sets `must_change_password: true`. Until that flag clears, the
 * route guard bounces every other page here — this screen is the only way out.
 */
import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api/client";
import { PROFILE } from "@/lib/api/endpoints";
import { clearMustChangePassword, passwordProblem, readAccount, signOut } from "@/lib/auth";
import { roleHome } from "@/lib/roles";
import { validateRedirectSearch } from "@/lib/auth-guard";

export const Route = createFileRoute("/change-password")({
  ssr: false,
  validateSearch: validateRedirectSearch,
  head: () => ({
    meta: [
      { title: "Set a New Password — Kennedy Moon Grill" },
      {
        name: "description",
        content: "Replace your temporary staff password before using the Kennedy Moon Grill console.",
      },
      { property: "og:title", content: "Set a New Password — Kennedy Moon Grill" },
      {
        property: "og:description",
        content: "Staff accounts must replace their one-time password before the console unlocks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const account = readAccount();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const problem = passwordProblem(next);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (next !== confirm) {
      toast.error("Both new password fields must match.");
      return;
    }
    if (next === current) {
      toast.error("Choose a password different from the temporary one.");
      return;
    }

    setBusy(true);
    try {
      await api.post(PROFILE.changePassword, {
        current_password: current,
        new_password: next,
      });
      clearMustChangePassword();
      toast.success("Password updated — welcome aboard.");
      const target = search.redirect ?? roleHome(account?.role);
      void navigate({ to: target, replace: true });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Could not update the password. Please try again.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center gap-6 px-5 py-12">
      <header className="space-y-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          <ShieldAlert className="size-3.5" aria-hidden />
          One step before you start
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">Set your own password</h1>
        <p className="text-sm text-muted-foreground">
          {account?.name ? `${account.name}, your` : "Your"} account was created with a temporary
          password. Choose a new one to unlock the console.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current">Temporary password</Label>
          <Input
            id="current"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="next">New password</Label>
          <div className="relative">
            <Input
              id="next"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide passwords" : "Show passwords"}
              className="absolute inset-y-0 right-3 flex items-center text-muted-foreground"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            At least 8 characters, with one letter and one number.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm">Repeat new password</Label>
          <Input
            id="confirm"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={busy}>
          <KeyRound className="mr-2 size-4" aria-hidden />
          {busy ? "Saving…" : "Save and continue"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          signOut();
          void navigate({ to: "/login", replace: true });
        }}
        className="text-center text-xs text-muted-foreground underline underline-offset-4"
      >
        Sign out instead
      </button>
    </main>
  );
}
