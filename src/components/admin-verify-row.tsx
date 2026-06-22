"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { setPhotographerVerification } from "@/lib/actions/admin";

export function AdminVerifyRow({
  id,
  name,
  city,
}: {
  id: string;
  name: string;
  city: string | null;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");

  function decide(status: "verified" | "rejected") {
    startTransition(async () => {
      await setPhotographerVerification(id, status, note);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 border border-line p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-mute">
        <Link
          href={`/photographers/${id}`}
          className="font-medium text-accent hover:opacity-70"
        >
          {name}
        </Link>
        {city ? <span>{city}</span> : null}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("notePlaceholder")}
        rows={2}
        className="w-full resize-none border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-mute-2"
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => decide("verified")}
          disabled={isPending}
          className="press border border-line px-4 py-2 text-sm text-ink disabled:opacity-50"
        >
          {t("approveVerification")}
        </button>
        <button
          type="button"
          onClick={() => decide("rejected")}
          disabled={isPending}
          className="press label text-mute hover:text-ink disabled:opacity-50"
        >
          {t("rejectVerification")}
        </button>
      </div>
    </div>
  );
}
