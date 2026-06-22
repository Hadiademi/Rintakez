"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateNotificationPrefs } from "@/lib/actions/settings";

function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex flex-col">
        <span className="text-[15px] text-ink">{label}</span>
        <span className="text-[13px] text-mute">{hint}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
          checked ? "border-ink bg-ink" : "border-line bg-surface"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${
            checked ? "left-[22px] bg-paper" : "left-0.5 bg-mute"
          }`}
        />
      </button>
    </div>
  );
}

export function NotificationPrefs({
  notifyBids,
  notifyShootUpdates,
}: {
  notifyBids: boolean;
  notifyShootUpdates: boolean;
}) {
  const t = useTranslations("profile");
  const [bids, setBids] = useState(notifyBids);
  const [shoots, setShoots] = useState(notifyShootUpdates);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function persist(nextBids: boolean, nextShoots: boolean) {
    setSaved(false);
    start(async () => {
      const r = await updateNotificationPrefs({
        notifyBids: nextBids,
        notifyShootUpdates: nextShoots,
      });
      if (r.ok) setSaved(true);
    });
  }

  return (
    <div className="divide-y divide-line">
      <Toggle
        checked={bids}
        disabled={pending}
        label={t("notifyBidsLabel")}
        hint={t("notifyBidsHint")}
        onChange={(v) => {
          setBids(v);
          persist(v, shoots);
        }}
      />
      <Toggle
        checked={shoots}
        disabled={pending}
        label={t("notifyShootUpdatesLabel")}
        hint={t("notifyShootUpdatesHint")}
        onChange={(v) => {
          setShoots(v);
          persist(bids, v);
        }}
      />
      {saved && <p className="pt-3 text-[13px] text-mute">{t("prefsSaved")}</p>}
    </div>
  );
}
