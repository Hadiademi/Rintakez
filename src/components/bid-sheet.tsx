"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { createBidSchema, type CreateBidInput } from "@/lib/validation/bid";
import { submitBidAction } from "@/lib/actions/bids";
import { errorKey } from "@/lib/error-messages";
import { track } from "@/lib/track";
import { useToast } from "@/components/ui/toaster";

export function BidSheet({
  shootId,
  budgetRange,
  quota,
}: {
  shootId: string;
  budgetRange: string;
  quota: { used: number; limit: number | null }; // limit null = unlimited (premium)
}) {
  const t = useTranslations("bidSheet");
  const reached = quota.limit !== null && quota.used >= quota.limit;
  const tErr = useTranslations("errors");
  const tToast = useTranslations("toast");
  const { toast } = useToast();
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
        track("bid");
        toast(tToast("bidSubmitted"));
        router.refresh();
      } else {
        setError(tErr(errorKey(res.error)));
      }
    });
  }

  return (
    // Bare — the only caller (the shoot detail sidebar) already renders its
    // own bordered box and places this directly inside it, below the budget
    // line, so this doesn't repeat the border/background/padding.
    <div>
      <h2 className="label text-mute">{t("submitTitle")}</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-8">
        <div className="space-y-2">
          <label htmlFor="bid-amount" className="label text-mute">
            {t("yourPrice")}
          </label>
          <div className="flex items-baseline gap-3 border-b border-ink pb-2">
            <span className="text-2xl font-medium text-mute">CHF</span>
            <input
              id="bid-amount"
              data-testid="bid-amount"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              {...register("amountChf", { valueAsNumber: true })}
              className="tabular w-full bg-transparent text-4xl font-semibold tracking-tight text-ink focus:outline-none"
            />
          </div>
          <p className="text-sm text-mute">
            {t("clientBudget", { range: budgetRange })}
          </p>
          {errors.amountChf ? (
            <p className="text-sm text-accent">{errors.amountChf.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label htmlFor="bid-message" className="label text-mute">
            {t("yourMessage")}
          </label>
          <textarea
            id="bid-message"
            data-testid="bid-message"
            rows={5}
            placeholder={t("messagePlaceholder")}
            {...register("message")}
            className="w-full border border-line bg-surface px-3.5 py-2.5 text-ink focus:border-ink focus:outline-none"
          />
          {errors.message ? (
            <p className="text-sm text-accent">{errors.message.message}</p>
          ) : null}
        </div>

        {quota.limit !== null ? (
          <p className="label text-mute">
            <span className="tabular">
              {t("quotaThisMonth", { used: quota.used, limit: quota.limit })}
            </span>
          </p>
        ) : null}

        <button
          type="submit"
          data-testid="bid-submit"
          disabled={isPending || reached}
          className="press w-full bg-ink px-4 py-3 label text-paper disabled:opacity-50"
        >
          {t("send")}
        </button>

        {reached ? (
          <p className="text-sm text-accent">
            {t("quotaReached")}{" "}
            <Link href="/pricing" className="underline">
              {t("viewPlans")}
            </Link>
          </p>
        ) : null}

        {error ? <p className="text-sm text-accent">{error}</p> : null}
      </form>
    </div>
  );
}
