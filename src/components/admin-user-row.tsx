"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { setUserSuspension, setUserAdmin } from "@/lib/actions/admin";

export function AdminUserRow({
  id,
  name,
  email,
  role,
  isAdmin,
  isSuspended,
  isSelf,
}: {
  id: string;
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
  isSuspended: boolean;
  isSelf: boolean;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [admin, setAdminState] = useState(isAdmin);
  const [suspended, setSuspended] = useState(isSuspended);

  function toggleSuspend() {
    start(async () => {
      const r = await setUserSuspension(id, !suspended, note);
      if (r.ok) {
        setSuspended((v) => !v);
        router.refresh();
      }
    });
  }

  function toggleAdmin() {
    start(async () => {
      const r = await setUserAdmin(id, !admin);
      if (r.ok) {
        setAdminState((v) => !v);
        router.refresh();
      }
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
    </div>
  );
}
