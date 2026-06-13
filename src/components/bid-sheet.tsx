"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createBidSchema, type CreateBidInput } from "@/lib/validation/bid";
import { submitBidAction } from "@/lib/actions/bids";

export function BidSheet({
  shootId,
  budgetRange,
}: {
  shootId: string;
  budgetRange: string;
}) {
  const t = useTranslations("bidSheet");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateBidInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createBidSchema) as any,
  });

  function onSubmit(values: CreateBidInput) {
    setError(null);
    startTransition(async () => {
      const res = await submitBidAction(shootId, values);
      if (res.ok) {
        router.refresh();
      } else if (res.error === "already_bid") {
        setError(t("alreadyBid"));
      } else {
        setError(t("errorSubmit"));
      }
    });
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-lg font-medium tracking-tight">{t("submitTitle")}</h2>
      <p className="mt-1 text-sm text-mute">
        {t("clientBudget", { range: budgetRange })}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="bid-amount" className="label text-mute">
            {t("yourPrice")}
          </label>
          <input
            id="bid-amount"
            data-testid="bid-amount"
            type="number"
            inputMode="numeric"
            {...register("amountChf", { valueAsNumber: true })}
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink focus:outline-none focus:border-ink"
          />
          {errors.amountChf ? (
            <p className="text-sm text-accent">{errors.amountChf.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="bid-message" className="label text-mute">
            {t("yourMessage")}
          </label>
          <textarea
            id="bid-message"
            data-testid="bid-message"
            rows={5}
            placeholder={t("messagePlaceholder")}
            {...register("message")}
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink focus:outline-none focus:border-ink"
          />
          {errors.message ? (
            <p className="text-sm text-accent">{errors.message.message}</p>
          ) : null}
        </div>

        <button
          type="submit"
          data-testid="bid-submit"
          disabled={isPending}
          className="press bg-ink px-4 py-2.5 text-paper disabled:opacity-50"
        >
          {t("send")}
        </button>

        {error ? <p className="text-sm text-accent">{error}</p> : null}
      </form>
    </section>
  );
}
