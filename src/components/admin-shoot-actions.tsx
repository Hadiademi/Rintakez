"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { deleteShoot, setShootSuspension } from "@/lib/actions/admin";
import { errorKey } from "@/lib/error-messages";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toaster";

/**
 * Admin moderation for one shoot: suspend / lift the suspension, and delete
 * permanently. Used in the admin shoots list and on the shoot page itself.
 *
 * `afterDelete` is where to go once the shoot is gone: the shoot page passes
 * "/admin/shoots" (its own URL would 404); the list stays put and refreshes.
 */
export function AdminShootActions({
  id,
  title,
  isSuspended,
  deletable,
  afterDelete,
}: {
  id: string;
  title: string;
  isSuspended: boolean;
  /** False for booked shoots: the server refuses their deletion anyway. */
  deletable: boolean;
  afterDelete?: string;
}) {
  const t = useTranslations("admin");
  const tErr = useTranslations("errors");
  const tc = useTranslations("confirm");
  const tToast = useTranslations("toast");
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [suspended, setSuspended] = useState(isSuspended);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function toggleSuspend() {
    if (
      !suspended &&
      !(await confirm({
        title: t("confirmSuspendShoot", { title }),
        confirmLabel: t("suspendShoot"),
        tone: "danger",
      }))
    ) {
      return;
    }
    setError(null);
    start(async () => {
      const r = await setShootSuspension(id, !suspended, note);
      if (r.ok) {
        setSuspended((v) => !v);
        toast(tToast("saved"));
        router.refresh();
      } else setError(tErr(errorKey(r.error)));
    });
  }

  async function handleDelete() {
    if (
      !(await confirm({
        title: t("confirmDeleteShoot", { title }),
        body: t("confirmDeleteShootBody"),
        confirmLabel: tc("removeAction"),
        tone: "danger",
      }))
    ) {
      return;
    }
    setError(null);
    start(async () => {
      const r = await deleteShoot(id);
      if (r.ok) {
        toast(t("shootDeleted"));
        if (afterDelete) router.push(afterDelete);
        router.refresh();
      } else setError(tErr(errorKey(r.error)));
    });
  }

  return (
    <div className="space-y-3" data-testid={`admin-shoot-actions-${id}`}>
      {!suspended && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder={t("notePlaceholder")}
          aria-label={t("notePlaceholder")}
          className="w-full border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-mute-2 focus:border-ink focus:outline-none sm:text-sm"
        />
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggleSuspend}
          disabled={pending}
          data-testid="admin-shoot-suspend"
          className="press min-h-11 border border-line px-4 py-2 text-sm text-ink disabled:opacity-50"
        >
          {suspended ? t("unsuspendShoot") : t("suspendShoot")}
        </button>
        {deletable ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            data-testid="admin-shoot-delete"
            className="press min-h-11 border border-accent px-4 py-2 text-sm text-accent disabled:opacity-50"
          >
            {t("deleteShoot")}
          </button>
        ) : (
          <span className="self-center text-[13px] text-mute">{t("shootNotDeletableHint")}</span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
