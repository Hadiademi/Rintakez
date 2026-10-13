"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { removeQueryParam, useMoment } from "@/components/ui/moment";
import { MONTHLY_BID_QUOTA, type Plan } from "@/lib/billing/plans";

/**
 * Stripe Checkout returns to /profile?checkout=success. Say thank you and
 * name what was unlocked. The webhook that activates the plan usually beats
 * the redirect, but not always — then we say it's being activated instead of
 * claiming a plan the page doesn't show yet.
 */
export function CheckoutReturnMoment({
  plan,
  active,
}: {
  plan: Plan;
  /** A live Stripe subscription is already on file. */
  active: boolean;
}) {
  const t = useTranslations("moments.planActive");
  const tp = useTranslations("moments.planPending");
  const tPlan = useTranslations("billing.plan");
  const tMoments = useTranslations("moments");
  const { celebrate } = useMoment();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("checkout") !== "success") {
      return;
    }
    removeQueryParam("checkout");
    const close = { label: tMoments("close") };
    if (active && plan !== "free") {
      const quota = MONTHLY_BID_QUOTA[plan];
      celebrate({
        eyebrow: t("eyebrow"),
        title: t("title", { plan: tPlan(`${plan}.name`) }),
        body: t("body"),
        details: [
          {
            label: t("quota"),
            value: Number.isFinite(quota) ? String(quota) : t("unlimited"),
          },
        ],
        primary: { label: t("browse"), href: "/shoots" },
        secondary: close,
      });
    } else {
      celebrate({
        tone: "calm",
        eyebrow: tp("eyebrow"),
        title: tp("title"),
        body: tp("body"),
        primary: { label: tp("reload"), onClick: () => window.location.reload() },
        secondary: close,
      });
    }
    // Runs once on arrival; the flag is removed from the URL right away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
