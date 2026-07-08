"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { requestVerification } from "@/lib/actions/photographer";
import { errorKey } from "@/lib/error-messages";

type Status = "unverified" | "pending" | "verified" | "rejected";

export function VerificationRequest({ status }: { status: Status }) {
  const t = useTranslations("profile");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function request() {
    setError(null);
    startTransition(async () => {
      const res = await requestVerification(note);
      if (res.ok) router.refresh();
      else setError(tErr(errorKey(res.error)));
    });
  }

  const canRequest = status === "unverified" || status === "rejected";

  return (
    <div className="flex flex-col gap-3 border border-line p-4">
      <div className="flex flex-col">
        <span className="label text-mute">{t("verificationLabel")}</span>
        <span className="text-[14px] text-ink">
          {t(`verificationStatus.${status}`)}
        </span>
      </div>
      {canRequest ? (
        <>
          <p className="text-[13px] text-mute">
            {t("verificationEvidenceHint")}
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("verificationEvidencePlaceholder")}
            rows={3}
            className="w-full resize-y border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-mute-2 focus:border-ink focus:outline-none"
          />
          <button
            type="button"
            onClick={request}
            disabled={isPending || !note.trim()}
            className="press w-full border border-line px-4 py-2 text-sm text-ink disabled:opacity-50 sm:w-auto sm:self-start"
          >
            {t("requestVerification")}
          </button>
          {error && <p className="text-[12px] text-accent">{error}</p>}
        </>
      ) : null}
    </div>
  );
}
