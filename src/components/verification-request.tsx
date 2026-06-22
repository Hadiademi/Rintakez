"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { requestVerification } from "@/lib/actions/photographer";

type Status = "unverified" | "pending" | "verified" | "rejected";

export function VerificationRequest({ status }: { status: Status }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function request() {
    startTransition(async () => {
      await requestVerification();
      router.refresh();
    });
  }

  const canRequest = status === "unverified" || status === "rejected";

  return (
    <div className="flex flex-wrap items-center gap-3 border border-line p-4">
      <div className="flex flex-col">
        <span className="label text-mute">{t("verificationLabel")}</span>
        <span className="text-[14px] text-ink">
          {t(`verificationStatus.${status}`)}
        </span>
      </div>
      {canRequest ? (
        <button
          type="button"
          onClick={request}
          disabled={isPending}
          className="press ml-auto border border-line px-4 py-2 text-sm text-ink disabled:opacity-50"
        >
          {t("requestVerification")}
        </button>
      ) : null}
    </div>
  );
}
