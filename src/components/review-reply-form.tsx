"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { replyToReview } from "@/lib/actions/reviews";
import { errorKey } from "@/lib/error-messages";
import { useToast } from "@/components/ui/toaster";

export function ReviewReplyForm({ reviewId }: { reviewId: string }) {
  const t = useTranslations("review");
  const tErr = useTranslations("errors");
  const tToast = useTranslations("toast");
  const { toast } = useToast();
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit() {
    const trimmed = text.trim();
    if (trimmed.length < 1) return;
    setError(null);
    startTransition(async () => {
      const res = await replyToReview(reviewId, { text: trimmed });
      if (res.ok) {
        toast(tToast("replySubmitted"));
        router.refresh();
      } else setError(tErr(errorKey(res.error)));
    });
  }

  return (
    <div className="mt-3 space-y-2 border-l-2 border-line pl-4">
      <label htmlFor={`reply-${reviewId}`} className="label text-mute">
        {t("replyLabel")}
      </label>
      <textarea
        id={`reply-${reviewId}`}
        data-testid="review-reply-text"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("replyPlaceholder")}
        // text-base = 16px: keeps iOS from zooming the viewport on focus.
        className="w-full resize-y border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-mute-2 focus:border-ink focus:outline-none"
      />
      <button
        type="button"
        data-testid="review-reply-submit"
        onClick={onSubmit}
        disabled={isPending || text.trim().length < 1}
        className="press inline-flex min-h-[44px] items-center bg-ink px-6 text-sm font-medium text-paper disabled:opacity-40"
      >
        {t("replySubmit")}
      </button>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
    </div>
  );
}
