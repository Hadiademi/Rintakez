"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { formatCHF } from "@/lib/format";
import { updateBidAction, withdrawBidAction } from "@/lib/actions/bids";

type BidStatus = "pending" | "accepted" | "declined" | "withdrawn";

export function MyBidPanel({
  bid,
  canEdit,
}: {
  bid: {
    id: string;
    amount_chf: number;
    message: string;
    status: BidStatus;
  };
  canEdit: boolean;
}) {
  const t = useTranslations("bidSheet");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(bid.amount_chf));
  const [message, setMessage] = useState(bid.message);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const statusLabel =
    bid.status === "accepted"
      ? t("bidStatusAccepted")
      : bid.status === "declined"
        ? t("bidStatusDeclined")
        : bid.status === "withdrawn"
          ? t("bidStatusWithdrawn")
          : t("bidStatusPending");

  const dotClass =
    bid.status === "pending"
      ? "bg-accent"
      : bid.status === "accepted"
        ? "bg-ink"
        : "bg-mute";

  const statusTextClass =
    bid.status === "accepted" ? "text-ink" : "text-mute";

  function onSave() {
    setError(null);
    startTransition(async () => {
      const res = await updateBidAction(bid.id, {
        amountChf: Number(amount),
        message,
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(t("errorSubmit"));
      }
    });
  }

  function onCancel() {
    setAmount(String(bid.amount_chf));
    setMessage(bid.message);
    setError(null);
    setEditing(false);
  }

  function onWithdraw() {
    if (typeof window !== "undefined" && !window.confirm(t("withdraw") + "?")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await withdrawBidAction(bid.id);
      if (res.ok) {
        router.refresh();
      } else {
        setError(t("errorSubmit"));
      }
    });
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-lg font-medium tracking-tight">{t("yourBid")}</h2>

      {editing ? (
        <div className="mt-5 space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="mybid-amount-input" className="label text-mute">
              {t("yourPrice")}
            </label>
            <input
              id="mybid-amount-input"
              data-testid="mybid-amount"
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink focus:outline-none focus:border-ink"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="mybid-message-input" className="label text-mute">
              {t("yourMessage")}
            </label>
            <textarea
              id="mybid-message-input"
              data-testid="mybid-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink focus:outline-none focus:border-ink"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              data-testid="mybid-save"
              onClick={onSave}
              disabled={isPending}
              className="press bg-ink px-4 py-2.5 text-paper disabled:opacity-50"
            >
              {t("save")}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="press border border-line px-4 py-2.5 label text-mute disabled:opacity-50"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-3 tabular text-lg font-medium text-ink">
            {formatCHF(bid.amount_chf)}
          </p>
          <p className="mt-3 whitespace-pre-line text-sm text-mute">
            {bid.message}
          </p>

          <div
            data-testid="mybid-status"
            className={`mt-4 flex items-center gap-2 text-sm ${statusTextClass}`}
          >
            <span className={`h-2 w-2 rounded-full ${dotClass}`} />
            {statusLabel}
          </div>

          {canEdit ? (
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                data-testid="mybid-edit"
                onClick={() => setEditing(true)}
                disabled={isPending}
                className="press border border-line px-3 py-1.5 label text-ink disabled:opacity-50"
              >
                {t("edit")}
              </button>
              <button
                type="button"
                data-testid="mybid-withdraw"
                onClick={onWithdraw}
                disabled={isPending}
                className="press border border-line px-3 py-1.5 label text-mute disabled:opacity-50"
              >
                {t("withdraw")}
              </button>
            </div>
          ) : null}
        </>
      )}

      {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}
    </section>
  );
}
