"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { setUserSuspension, setUserAdmin, grantComp, revokeComp } from "@/lib/actions/admin";
import { errorKey } from "@/lib/error-messages";
import { formatSwissDate } from "@/lib/format";

export function AdminUserRow({
  id,
  name,
  email,
  role,
  isAdmin,
  isSuspended,
  isSelf,
  comp,
}: {
  id: string;
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
  isSuspended: boolean;
  isSelf: boolean;
  comp: { plan: string; until: string } | null;
}) {
  const t = useTranslations("admin");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [admin, setAdminState] = useState(isAdmin);
  const [suspended, setSuspended] = useState(isSuspended);
  const [error, setError] = useState<string | null>(null);
  const [compPlan, setCompPlan] = useState<"basic" | "standard" | "premium">(
    "basic"
  );
  const [compMonths, setCompMonths] = useState(1);

  function toggleSuspend() {
    // High blast radius — confirm the destructive direction, name-interpolated.
    if (
      !suspended &&
      typeof window !== "undefined" &&
      !window.confirm(t("confirmSuspend", { name }))
    ) {
      return;
    }
    setError(null);
    start(async () => {
      const r = await setUserSuspension(id, !suspended, note);
      if (r.ok) {
        setSuspended((v) => !v);
        router.refresh();
      } else setError(tErr(errorKey(r.error)));
    });
  }

  function toggleAdmin() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(t(admin ? "confirmRevokeAdmin" : "confirmMakeAdmin", { name }))
    ) {
      return;
    }
    setError(null);
    start(async () => {
      const r = await setUserAdmin(id, !admin);
      if (r.ok) {
        setAdminState((v) => !v);
        router.refresh();
      } else setError(tErr(errorKey(r.error)));
    });
  }

  function handleGrantComp() {
    setError(null);
    start(async () => {
      const r = await grantComp(id, compPlan, compMonths);
      if (r.ok) router.refresh();
      else setError(tErr(errorKey(r.error)));
    });
  }

  function handleRevokeComp() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(t("confirmRevokeComp", { name }))
    ) {
      return;
    }
    setError(null);
    start(async () => {
      const r = await revokeComp(id);
      if (r.ok) router.refresh();
      else setError(tErr(errorKey(r.error)));
    });
  }

  return (
    <div className="flex flex-col gap-3 border border-line p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium text-ink">{name}</span>
        <span className="text-[13px] text-mute">{email}</span>
        <span className="label rounded bg-chip px-1.5 py-0.5 text-mute">
          {role}
        </span>
        {admin ? (
          <span className="label rounded bg-ink px-1.5 py-0.5 text-paper">
            {t("badgeAdmin")}
          </span>
        ) : null}
        {suspended ? (
          <span className="label rounded bg-red-100 px-1.5 py-0.5 text-red-800 dark:bg-red-950/50 dark:text-red-200">
            {t("suspended")}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("notePlaceholder")}
          className="min-w-0 flex-1 border border-line bg-paper px-3 py-1.5 text-sm text-ink placeholder:text-mute-2"
        />
        <button
          type="button"
          onClick={toggleSuspend}
          disabled={pending}
          className="press border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-300"
        >
          {suspended ? t("unsuspendUser") : t("suspendUser")}
        </button>
        <button
          type="button"
          onClick={toggleAdmin}
          disabled={pending || (isSelf && admin)}
          title={isSelf && admin ? t("cannotRevokeSelf") : undefined}
          className="press border border-line px-3 py-1.5 text-sm text-ink disabled:opacity-50"
        >
          {admin ? t("revokeAdmin") : t("makeAdmin")}
        </button>
        <Link
          href={`/photographers/${id}`}
          className="press label text-mute hover:text-ink"
        >
          {t("viewTarget")}
        </Link>
      </div>

      {role === "photographer" ? (
        <div className="flex flex-wrap items-center gap-2">
          {comp ? (
            <>
              <span className="label rounded bg-chip px-1.5 py-0.5 text-mute">
                {t("compChip", {
                  plan: comp.plan.toUpperCase(),
                  date: formatSwissDate(comp.until.slice(0, 10)),
                })}
              </span>
              <button
                type="button"
                onClick={handleRevokeComp}
                disabled={pending}
                className="press border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-300"
              >
                {t("compRevoke")}
              </button>
            </>
          ) : null}
          <select
            value={compPlan}
            onChange={(e) =>
              setCompPlan(e.target.value as "basic" | "standard" | "premium")
            }
            className="border border-line bg-paper px-3 py-1.5 text-sm text-ink"
          >
            <option value="basic">{t("tierBasic")}</option>
            <option value="standard">{t("tierStandard")}</option>
            <option value="premium">{t("tierPremium")}</option>
          </select>
          <input
            type="number"
            min={1}
            max={24}
            value={compMonths}
            onChange={(e) => setCompMonths(Number(e.target.value))}
            placeholder={t("compMonths")}
            aria-label={t("compMonths")}
            className="w-20 border border-line bg-paper px-3 py-1.5 text-sm text-ink placeholder:text-mute-2"
          />
          <button
            type="button"
            onClick={handleGrantComp}
            disabled={pending}
            title={t("compGrant")}
            className="press border border-line px-3 py-1.5 text-sm text-ink disabled:opacity-50"
          >
            {t("compGrantButton")}
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-accent">{error}</p> : null}
    </div>
  );
}
