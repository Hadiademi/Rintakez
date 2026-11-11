"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ChipMultiSelect } from "@/components/chip-multi-select";
import { savePhotographerDetails } from "@/lib/actions/photographer";
import {
  SHOOT_TYPES,
  DISCIPLINES,
  checkDetailsForm,
} from "@/lib/validation/photographer";
import { toLinkPayload, type LinkRow, type ProfileLink } from "@/lib/links";
import { LinksEditor, linkUrlInputId } from "@/components/links-editor";
import { ProfileLinkList } from "@/components/profile-links";
import { errorKey } from "@/lib/error-messages";
import { formatCHF } from "@/lib/format";
import { useToast } from "@/components/ui/toaster";
import { cantonOptions } from "@/lib/canton-names";

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
  links: ProfileLink[];
};

function toRows(links: ProfileLink[]): LinkRow[] {
  return links.map((l) => ({ label: l.label ?? "", url: l.url }));
}

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
  const locale = useLocale();
  const { toast } = useToast();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const rateRef = useRef<HTMLInputElement>(null);

  const [disciplines, setDisciplines] = useState(initial.disciplines);
  const [specialties, setSpecialties] = useState(initial.specialties);
  const [cantons, setCantons] = useState(initial.cantons);
  const [rate, setRate] = useState(initial.hourlyRate);
  const [linkRows, setLinkRows] = useState<LinkRow[]>(toRows(initial.links));
  const [linkErrors, setLinkErrors] = useState<Record<number, string>>({});
  const [rateError, setRateError] = useState<string | null>(null);
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
    setLinkRows(toRows(initial.links));
    setLinkErrors({});
    setRateError(null);
    setError(null);
  }

  function onLinksChange(rows: LinkRow[], changed: number | "all") {
    setLinkRows(rows);
    setLinkErrors((prev) => {
      if (changed === "all") return {};
      if (!(changed in prev)) return prev;
      const next = { ...prev };
      delete next[changed];
      return next;
    });
  }

  async function onSave() {
    setError(null);
    const { payload, rowOf } = toLinkPayload(linkRows);
    const input = {
      specialties,
      disciplines,
      coverageCantons: cantons,
      hourlyRateChf: rate ? Number(rate) : undefined,
      links: payload,
    };

    // Same schema as the server, so the error lands on the field that caused
    // it instead of one generic line under the buttons.
    const check = checkDetailsForm(input, rowOf);
    if (!check.ok) {
      setRateError(check.hourlyRate ? tErr(check.hourlyRate) : null);
      setLinkErrors(
        Object.fromEntries(
          Object.entries(check.links).map(([row, code]) => [row, tErr(code)])
        )
      );
      setError(check.general ? tErr("invalid_input") : tOnb("fixFields"));
      const firstLinkRow = Object.keys(check.links).map(Number).sort((a, b) => a - b)[0];
      const focusId = check.hourlyRate
        ? "pro-rate-input"
        : firstLinkRow !== undefined
          ? linkUrlInputId("pro-details", firstLinkRow)
          : null;
      if (focusId) document.getElementById(focusId)?.focus();
      return;
    }
    setRateError(null);
    setLinkErrors({});

    setSaving(true);
    const res = await savePhotographerDetails(input);
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
      initial.links.length > 0;
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

            {initial.links.length > 0 && (
              <div className="space-y-2 sm:col-span-2">
                <p className="label text-mute">{t("links")}</p>
                <ProfileLinkList links={initial.links} />
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
          options={cantonOptions(locale)}
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
          step={1}
          inputMode="numeric"
          onChange={(e) => {
            setRate(e.target.value);
            setRateError(null);
          }}
          aria-invalid={rateError ? true : undefined}
          aria-describedby={rateError ? "pro-rate-error" : undefined}
          placeholder="—"
          className={`${inputClass} w-48 ${rateError ? "border-accent" : ""}`}
        />
        {rateError ? (
          <p id="pro-rate-error" className="text-[13px] text-accent">
            {rateError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="label text-mute">{tOnb("links")}</p>
        <LinksEditor
          rows={linkRows}
          onChange={onLinksChange}
          errors={linkErrors}
          idPrefix="pro-details"
        />
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

      {error && (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
