"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { invitePhotographerAction } from "@/lib/actions/invites";
import { useToast } from "@/components/ui/toaster";

type OpenShoot = { id: string; title: string; shoot_date: string };

export function InvitePhotographerButton({
  photographerId,
  openShoots,
  unavailableDates = [],
}: {
  photographerId: string;
  openShoots: OpenShoot[];
  unavailableDates?: string[];
}) {
  const t = useTranslations("profile");
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null); // shootId invited
  const [error, setError] = useState<string | null>(null);

  async function invite(shootId: string) {
    setPending(shootId);
    setError(null);
    const res = await invitePhotographerAction(photographerId, shootId);
    setPending(null);
    if (res.ok) {
      setDone(shootId);
      // Keep the inline ✓ state on the row AND surface a toast confirmation.
      toast(t("inviteSuccess"));
    } else {
      setError(res.error === "already_invited" ? t("inviteAlready") : t("inviteError"));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="press bg-ink px-5 py-3 text-center text-sm font-medium text-paper"
      >
        {t("inviteCta")}
      </button>

      {open && (
        <div className="space-y-2 rounded-md border border-line bg-surface p-3">
          <p className="label text-mute">{t("invitePickTitle")}</p>
          {openShoots.length === 0 ? (
            <div className="space-y-2">
              <p className="text-[13px] text-mute">{t("inviteNoOpenShoots")}</p>
              <Link
                href="/shoots/new"
                className="text-[14px] text-accent underline underline-offset-2"
              >
                {t("inviteCreateShoot")}
              </Link>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {openShoots.map((s) => {
                const isUnavailable = unavailableDates.includes(s.shoot_date);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={pending === s.id || done === s.id || isUnavailable}
                      onClick={() => invite(s.id)}
                      className="press w-full truncate rounded border border-line bg-paper px-3 py-2 text-left text-[14px] text-ink disabled:opacity-60"
                    >
                      {done === s.id ? `✓ ${t("inviteSuccess")}` : s.title}
                    </button>
                    {isUnavailable && !done && (
                      <p className="mt-1 text-[12px] text-mute">
                        {t("inviteUnavailableDate")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {error ? <p className="text-[13px] text-accent">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
