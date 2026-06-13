"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { submitReviewAction } from "@/lib/actions/reviews";
import { errorKey } from "@/lib/error-messages";

export function ReviewForm({ shootId }: { shootId: string }) {
  const t = useTranslations("review");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit() {
    if (rating < 1) return;
    setError(null);
    startTransition(async () => {
      const res = await submitReviewAction(shootId, {
        rating,
        comment: comment.trim() || undefined,
      });
      if (res.ok) router.refresh();
      else setError(tErr(errorKey(res.error)));
    });
  }

  const shown = hover || rating;

  return (
    <div className="space-y-4">
      <p className="label text-mute">{t("leaveReview")}</p>

      {/* Star picker */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            data-testid={`review-star-${i}`}
            onClick={() => setRating(i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${i} / 5`}
            className="press"
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill={i <= shown ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.5"
              className={i <= shown ? "text-accent" : "text-line"}
            >
              <path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 21l1.4-6.8L2.2 9.6l6.9-.7z" />
            </svg>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="review-comment" className="label text-mute">
          {t("comment")}
        </label>
        <textarea
          id="review-comment"
          data-testid="review-comment"
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("commentPlaceholder")}
          className="w-full resize-y border border-line bg-surface px-4 py-3 text-ink placeholder:text-mute-2 focus:border-ink focus:outline-none"
        />
      </div>

      <button
        type="button"
        data-testid="review-submit"
        onClick={onSubmit}
        disabled={isPending || rating < 1}
        className="press bg-ink px-6 py-3 text-sm font-medium text-paper disabled:opacity-40"
      >
        {t("submit")}
      </button>

      {error ? <p className="text-sm text-accent">{error}</p> : null}
    </div>
  );
}
