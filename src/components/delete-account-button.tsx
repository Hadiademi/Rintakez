"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { deleteAccount } from "@/lib/actions/profile";
import { errorKey } from "@/lib/error-messages";
import { useConfirm } from "@/components/ui/confirm";

export function DeleteAccountButton() {
  const t = useTranslations("profile");
  const tErr = useTranslations("errors");
  const tc = useTranslations("confirm");
  const { confirm } = useConfirm();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onDelete() {
    const ok = await confirm({
      title: tc("deleteAccountTitle"),
      body: t("deleteWarning"),
      confirmLabel: tc("deleteAccountAction"),
      tone: "danger",
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteAccount();
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError(tErr(errorKey(res.error)));
      }
    });
  }

  return (
    <div className="space-y-3 border-t border-line pt-8">
      <p className="label text-mute">{t("dangerZone")}</p>
      <p className="text-[14px] text-mute">{t("deleteWarning")}</p>
      <button
        type="button"
        data-testid="delete-account"
        onClick={onDelete}
        disabled={isPending}
        className="press border border-accent px-5 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-paper disabled:opacity-50"
      >
        {isPending ? t("deleting") : t("deleteAccount")}
      </button>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
    </div>
  );
}
