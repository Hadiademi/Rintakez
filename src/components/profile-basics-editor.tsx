"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CANTONS } from "@/lib/validation/photographer";
import { updateProfileBasics } from "@/lib/actions/profile";
import { errorKey } from "@/lib/error-messages";
import { useToast } from "@/components/ui/toaster";

const inputClass =
  "w-full border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-mute-2 transition-colors focus:border-ink focus:outline-none";

export function ProfileBasicsEditor({
  displayName,
  city,
  canton,
  bio,
}: {
  displayName: string;
  city: string;
  canton: string;
  bio: string;
}) {
  const t = useTranslations("profileBasics");
  const tErr = useTranslations("errors");
  const { toast } = useToast();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const bioRef = useRef<HTMLTextAreaElement>(null);

  // Deep link from the profile checklist ("write a short bio" →
  // #profile.basics-bio): the editor sits closed by default and the bio field
  // doesn't exist until it opens, so honour the anchor by opening ourselves
  // and focusing the field once it renders.
  useEffect(() => {
    const wantBio = () => window.location.hash.endsWith(".basics-bio");
    const maybeOpen = () => {
      if (wantBio()) setOpen(true);
    };
    maybeOpen();
    window.addEventListener("hashchange", maybeOpen);
    return () => window.removeEventListener("hashchange", maybeOpen);
  }, []);
  useEffect(() => {
    if (!open) return;
    if (!window.location.hash.endsWith(".basics-bio")) return;
    bioRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    bioRef.current?.focus({ preventScroll: true });
  }, [open]);
  const [name, setName] = useState(displayName);
  const [cityValue, setCityValue] = useState(city);
  const [cantonValue, setCantonValue] = useState(canton);
  const [bioValue, setBioValue] = useState(bio);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function onSave() {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await updateProfileBasics({
        displayName: name,
        city: cityValue,
        canton: cantonValue,
        bio: bioValue,
      });
      if (res.ok) {
        setSaved(true);
        setOpen(false);
        toast(t("saved"));
        router.refresh();
      } else {
        setError(tErr(errorKey(res.error)));
      }
    });
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          data-testid="profile-basics-edit"
          onClick={() => setOpen(true)}
          className="press border border-line px-4 py-2 label text-ink"
        >
          {t("edit")}
        </button>
        {saved && <span className="text-[13px] text-mute">{t("saved")}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 border border-line bg-surface p-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="basics-name" className="label text-mute">
          {t("displayName")}
        </label>
        <input
          id="basics-name"
          data-testid="basics-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="basics-city" className="label text-mute">
            {t("city")}
          </label>
          <input
            id="basics-city"
            data-testid="basics-city"
            value={cityValue}
            onChange={(e) => setCityValue(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="basics-canton" className="label text-mute">
            {t("canton")}
          </label>
          <select
            id="basics-canton"
            data-testid="basics-canton"
            value={cantonValue}
            onChange={(e) => setCantonValue(e.target.value)}
            className={inputClass}
          >
            <option value="">—</option>
            {CANTONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="basics-bio" className="label text-mute">
          {t("bio")}
        </label>
        <textarea
          ref={bioRef}
          id="basics-bio"
          data-testid="basics-bio"
          rows={4}
          value={bioValue}
          placeholder={t("bioPlaceholder")}
          onChange={(e) => setBioValue(e.target.value)}
          className={`${inputClass} resize-y`}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="basics-save"
          onClick={onSave}
          disabled={pending}
          className="press bg-ink px-4 py-2.5 label text-paper disabled:opacity-50"
        >
          {t("save")}
        </button>
        <button
          type="button"
          onClick={() => {
            setName(displayName);
            setCityValue(city);
            setCantonValue(canton);
            setBioValue(bio);
            setError(null);
            setOpen(false);
          }}
          disabled={pending}
          className="press border border-line px-4 py-2.5 label text-mute disabled:opacity-50"
        >
          {t("cancel")}
        </button>
      </div>

      {error && <p className="text-sm text-accent">{error}</p>}
    </div>
  );
}
