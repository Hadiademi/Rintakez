"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ChipMultiSelect } from "@/components/chip-multi-select";
import { savePhotographerDetails } from "@/lib/actions/photographer";
import {
  SHOOT_TYPES,
  CANTONS,
  DISCIPLINES,
} from "@/lib/validation/photographer";
import { errorKey } from "@/lib/error-messages";
import { formatCHF } from "@/lib/format";
import { useToast } from "@/components/ui/toaster";

const inputClass =
  "border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-mute-2 transition-colors focus:border-ink focus:outline-none";

/** Anchors the profile checklist deep-links into ("#profile.<anchor>"): each
 * marks the edit surface for one checklist item, so the editor must open
 * itself when the hash asks for any of them (the fields don't exist while the
 * summary view is shown — same pattern as ProfileBasicsEditor's bio). */
const OPEN_ANCHORS = [".pro-rate", ".pro-cantons", ".pro-specialties"];

export type ProfessionalDetails = {
  disciplines: string[];
  specialties: string[];
  cantons: string[];
  hourlyRate: string;
  website: string;
  instagram: string;
};

/**
 * In-place editor for the photographer's professional details (disciplines,
 * specialties, coverage cantons, hourly rate, links) as a settings card body —
 * the summary chips with an Edit button, expanding to the same controls the
 * onboarding wizard uses. Before this, editing meant leaving settings for the
 * /onboarding wizard.
 */
export function ProfessionalDetailsEditor({
  initial,
}: {
  initial: ProfessionalDetails;
}) {
  const t = useTranslations("profile");
  const tOnb = useTranslations("onboarding");
  const tBasics = useTranslations("profileBasics");
  const tShoot = useTranslations("shoot");
  const tErr = useTranslations("errors");
  const { toast } = useToast();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const rateRef = useRef<HTMLInputElement>(null);

  const [disciplines, setDisciplines] = useState(initial.disciplines);
  const [specialties, setSpecialties] = useState(initial.specialties);
  const [cantons, setCantons] = useState(initial.cantons);
  const [rate, setRate] = useState(initial.hourlyRate);
  const [website, setWebsite] = useState(initial.website);
  const [instagram, setInstagram] = useState(initial.instagram);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Checklist deep-links (#profile.pro-*) land on fields that only exist in
  // edit mode — open ourselves when the hash asks for one.
  useEffect(() => {
    const maybeOpen = () => {
      if (OPEN_ANCHORS.some((a) => window.location.hash.endsWith(a)))
        setOpen(true);
    };
    maybeOpen();
    window.addEventListener("hashchange", maybeOpen);
    return () => window.removeEventListener("hashchange", maybeOpen);
  }, []);
  useEffect(() => {
    if (!open) return;
    const hash = window.location.hash;
    const target = OPEN_ANCHORS.find((a) => hash.endsWith(a));
    if (!target) return;
    const el = document.getElementById(target.slice(1));
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (target === ".pro-rate") rateRef.current?.focus({ preventScroll: true });
  }, [open]);

  function reset() {
    setDisciplines(initial.disciplines);
    setSpecialties(initial.specialties);
    setCantons(initial.cantons);
    setRate(initial.hourlyRate);
    setWebsite(initial.website);
    setInstagram(initial.instagram);
    setError(null);
  }

  async function onSave() {
    setError(null);
    setSaving(true);
    const res = await savePhotographerDetails({
      specialties,
      disciplines,
      coverageCantons: cantons,
      hourlyRateChf: rate ? Number(rate) : undefined,
      websiteUrl: website,
      instagramUrl: instagram,
    });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      toast(tBasics("saved"));
      router.refresh();
    } else {
      setError(tErr(errorKey(res.error)));
    }
  }

  const canSave =
    specialties.length > 0 && disciplines.length > 0 && cantons.length > 0;

  if (!open) {
    const hasAny =
      disciplines.length > 0 ||
      specialties.length > 0 ||
      cantons.length > 0 ||
      initial.hourlyRate ||
      website ||
      instagram;
    return (
      <div className="space-y-5">
        {hasAny ? (
          <div className="grid gap-6 sm:grid-cols-2">
            {initial.disciplines.length > 0 && (
              <div className="space-y-2">
                <p className="label text-mute">{t("disciplines")}</p>
                <div className="flex flex-wrap gap-2">
                  {initial.disciplines.map((d) => (
                    <span
                      key={d}
                      className="rounded-full border border-line px-3 py-1 text-[13px] text-ink"
                    >
                      {tShoot(`disciplines.${d}`)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {initial.hourlyRate && (
              <div className="space-y-2">
                <p className="label text-mute">{t("hourlyRate")}</p>
                <p className="tabular text-[15px] text-ink">
                  {t("hourlyFrom", {
                    amount: formatCHF(Number(initial.hourlyRate)),
                  })}
                </p>
              </div>
            )}

            {initial.specialties.length > 0 && (
              <div className="space-y-2">
                <p className="label text-mute">{t("specialties")}</p>
                <div className="flex flex-wrap gap-2">
                  {initial.specialties.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-chip px-3 py-1 text-[13px] text-ink"
                    >
                      {tShoot(`types.${s}`)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {initial.cantons.length > 0 && (
              <div className="space-y-2">
                <p className="label text-mute">{t("coverage")}</p>
                <div className="flex flex-wrap gap-2">
                  {initial.cantons.map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-chip px-3 py-1 text-[13px] text-ink"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(website || instagram) && (
              <div className="flex flex-wrap gap-4 sm:col-span-2">
                {website && (
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] text-accent underline underline-offset-2 hover:opacity-70"
                  >
                    {t("website")}
                  </a>
                )}
                {instagram && (
                  <a
                    href={instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] text-accent underline underline-offset-2 hover:opacity-70"
                  >
                    {t("instagram")}
                  </a>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-[14px] text-mute">{t("proDetailsEmpty")}</p>
        )}

        <button
          type="button"
          data-testid="pro-details-edit"
          onClick={() => setOpen(true)}
          className="press border border-line px-4 py-2 label text-ink"
        >
          {tBasics("edit")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <label className="label text-mute">{tOnb("disciplines")}</label>
        <ChipMultiSelect
          options={DISCIPLINES.map((v) => ({
            value: v,
            label: tShoot(`disciplines.${v}`),
          }))}
          value={disciplines}
          onChange={setDisciplines}
          data-testid="pro-details-disciplines"
        />
      </div>

      <div id="pro-specialties" className="flex scroll-mt-24 flex-col gap-3">
        <label className="label text-mute">{tOnb("specialties")}</label>
        <ChipMultiSelect
          options={SHOOT_TYPES.map((v) => ({
            value: v,
            label: tShoot(`types.${v}`),
          }))}
          value={specialties}
          onChange={setSpecialties}
          data-testid="pro-details-specialties"
        />
      </div>

      <div id="pro-cantons" className="flex scroll-mt-24 flex-col gap-3">
        <label className="label text-mute">{tOnb("cantons")}</label>
        <ChipMultiSelect
          options={CANTONS.map((v) => ({ value: v, label: v }))}
          value={cantons}
          onChange={setCantons}
          data-testid="pro-details-cantons"
        />
      </div>

      <div id="pro-rate" className="flex scroll-mt-24 flex-col gap-1.5">
        <label htmlFor="pro-rate-input" className="label text-mute">
          {tOnb("hourlyRate")}
        </label>
        <input
          ref={rateRef}
          id="pro-rate-input"
          data-testid="pro-details-rate"
          type="number"
          min={1}
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="—"
          className={`${inputClass} w-48`}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pro-website" className="label text-mute">
            {tOnb("website")}
          </label>
          <input
            id="pro-website"
            data-testid="pro-details-website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://example.com"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pro-instagram" className="label text-mute">
            {tOnb("instagram")}
          </label>
          <input
            id="pro-instagram"
            data-testid="pro-details-instagram"
            type="url"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="https://instagram.com/username"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="pro-details-save"
          onClick={onSave}
          disabled={!canSave || saving}
          className="press bg-ink px-4 py-2.5 label text-paper disabled:opacity-50"
        >
          {tOnb("save")}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          disabled={saving}
          className="press border border-line px-4 py-2.5 label text-mute disabled:opacity-50"
        >
          {tBasics("cancel")}
        </button>
      </div>

      {error && <p className="text-sm text-accent">{error}</p>}
    </div>
  );
}
