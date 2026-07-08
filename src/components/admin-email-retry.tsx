"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { retryFailedEmail } from "@/lib/actions/admin";

export function AdminEmailRetry({ id }: { id: number }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await retryFailedEmail(id);
          router.refresh();
        })
      }
      className="press border border-line px-3 py-1 text-[13px] text-ink disabled:opacity-50"
    >
      {t("retry")}
    </button>
  );
}
