"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { acceptBidAction, declineBidAction } from "@/lib/actions/shoots";
import { errorKey } from "@/lib/error-messages";
import { formatCHF } from "@/lib/format";
import { track } from "@/lib/track";
import { useConfirm } from "@/components/ui/confirm";
import { useMoment } from "@/components/ui/moment";
import { useToast } from "@/components/ui/toaster";

/**
 * The owner's accept / decline flow for one offer, shared by the single
 * BidCard and the side-by-side BidCompare so both behave identically:
 * branded confirmation → server action → the booking moment (accept) or a
 * toast (decline) → refresh.
 */
export function useBidDecision({
  bidId,
  photographerName,
  amountChf,
  shootDateLabel,
}: {
  bidId: string;
  /** Null when the bidder's profile is gone; a neutral label is used. */
  photographerName: string | null;
  amountChf: number;
  /** Already formatted on the server (Swiss date). */
  shootDateLabel: string;
}) {
  const tDetail = useTranslations("shootDetail");
  const tc = useTranslations("confirm");
  const tm = useTranslations("moments.booked");
  const tToast = useTranslations("toast");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const { confirm } = useConfirm();
  const { celebrate } = useMoment();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const name = photographerName ?? tDetail("byPhotographer");

  async function accept() {
    const ok = await confirm({
      title: tc("acceptTitle", { name }),
      body: tc("acceptBody"),
      confirmLabel: tc("acceptAction"),
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await acceptBidAction(bidId);
      if (!res.ok) {
        setError(tErr(errorKey(res.error)));
        return;
      }
      track("accept_bid");
      celebrate({
        eyebrow: tm("eyebrow"),
        title: tm("title", { name }),
        body: tm("body", { name }),
        details: [
          { label: tm("date"), value: shootDateLabel },
          { label: tm("price"), value: formatCHF(amountChf) },
        ],
        stepsTitle: tm("stepsTitle"),
        steps: [tm("step1", { name }), tm("step2"), tm("step3")],
        primary: {
          label: tm("message", { name }),
          href: res.conversationId ? `/messages/${res.conversationId}` : "/messages",
        },
        secondary: { label: tm("toShoot") },
      });
      router.refresh();
    });
  }

  async function decline() {
    const ok = await confirm({
      title: tc("declineTitle", { name }),
      body: tc("declineBody", { name }),
      confirmLabel: tc("declineAction"),
      tone: "danger",
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await declineBidAction(bidId);
      if (!res.ok) {
        setError(tErr(errorKey(res.error)));
        return;
      }
      toast(tToast("bidDeclined"), {
        description: tToast("bidDeclinedDesc", { name }),
      });
      router.refresh();
    });
  }

  return { accept, decline, isPending, error };
}
