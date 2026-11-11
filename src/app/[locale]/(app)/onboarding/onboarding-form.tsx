"use client";

import { useState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ChipMultiSelect } from "@/components/chip-multi-select";
import {
  savePhotographerDetails,
  addPortfolioImage,
  removePortfolioImage,
} from "@/lib/actions/photographer";
import {
  SHOOT_TYPES,
  DISCIPLINES,
  checkDetailsForm,
} from "@/lib/validation/photographer";
import { toLinkPayload, type LinkRow, type ProfileLink } from "@/lib/links";
import { LinksEditor, linkUrlInputId } from "@/components/links-editor";
import { downscaleImage } from "@/lib/image-downscale";
import { errorKey } from "@/lib/error-messages";
import { cantonOptions } from "@/lib/canton-names";
import { useMoment } from "@/components/ui/moment";
import { useToast } from "@/components/ui/toaster";

type PortfolioItem = { id: string; url: string };

// Soft client-side cap mirroring the server limit; prevents obvious over-upload.
const MAX_PORTFOLIO = 20;

type InitialDetails = {
  specialties: string[];
  disciplines: string[];
  cantons: string[];
  hourlyRate: string;
  links: ProfileLink[];
  portfolio: PortfolioItem[];
};

const EMPTY_INITIAL: InitialDetails = {
  specialties: [],
  disciplines: ["photo"],
  cantons: [],
  hourlyRate: "",
  links: [],
  portfolio: [],
};

export default function OnboardingForm({
  initial = EMPTY_INITIAL,
  isEdit = false,
}: {
  initial?: InitialDetails;
  isEdit?: boolean;
}) {
  const t = useTranslations("onboarding");
  const tShoot = useTranslations("shoot");
  const tErr = useTranslations("errors");
  const tCommon = useTranslations("common");
  const tWelcome = useTranslations("moments.welcome");
  const tToast = useTranslations("toast");
  const { celebrate } = useMoment();
  const { toast } = useToast();
  const locale = useLocale();
  const router = useRouter();

  const [specialties, setSpecialties] = useState<string[]>(initial.specialties);
  const [disciplines, setDisciplines] = useState<string[]>(initial.disciplines);
  const [cantons, setCantons] = useState<string[]>(initial.cantons);
  const [hourlyRate, setHourlyRate] = useState(initial.hourlyRate);
  const [linkRows, setLinkRows] = useState<LinkRow[]>(
    initial.links.map((l) => ({ label: l.label ?? "", url: l.url }))
  );
  // Field-level errors. A failed save used to show one generic "please check
  // your input" under the button, and a photographer could not find what to
  // fix (she had typed her website without https://).
  const [linkErrors, setLinkErrors] = useState<Record<number, string>>({});
  const [rateError, setRateError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(
    initial.portfolio
  );
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const specialtyOptions = SHOOT_TYPES.map((v) => ({
    value: v,
    label: tShoot(`types.${v}`),
  }));

  const cantonChoices = cantonOptions(locale);

  const disciplineOptions = DISCIPLINES.map((v) => ({
    value: v,
    label: tShoot(`disciplines.${v}`),
  }));

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setSaveError(null);
    setUploading(true);
    for (const file of files) {
      try {
        const fd = new FormData();
        // Downscale client-side like the profile portfolio editor does — a
        // photographer batch-selecting full-resolution JPEGs (8–15 MB each)
        // would otherwise have most of them rejected by the server's 5 MB cap.
        fd.append("file", await downscaleImage(file), "photo.jpg");
        const result = await addPortfolioImage(fd);
        if (result.ok) {
          setPortfolio((prev) => [...prev, { id: result.id, url: result.url }]);
        } else {
          // Surface the failure instead of dropping the photo silently.
          setSaveError(tErr(errorKey(result.error)));
        }
      } catch {
        setSaveError(tErr("generic"));
      }
    }
    setUploading(false);
    // Reset input so the same file can be re-selected if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleRemove(id: string) {
    const result = await removePortfolioImage(id);
    if (result.ok) {
      setPortfolio((prev) => prev.filter((p) => p.id !== id));
    } else {
      setSaveError(tErr(errorKey(result.error)));
    }
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

  async function handleFinish() {
    setSaveError(null);
    const { payload, rowOf } = toLinkPayload(linkRows);
    const input = {
      specialties,
      disciplines,
      coverageCantons: cantons,
      hourlyRateChf: hourlyRate ? Number(hourlyRate) : undefined,
      links: payload,
    };

    // Same schema the server uses, run first so the error lands on the field.
    const check = checkDetailsForm(input, rowOf);
    if (!check.ok) {
      setRateError(check.hourlyRate ? tErr(check.hourlyRate) : null);
      setLinkErrors(
        Object.fromEntries(
          Object.entries(check.links).map(([row, code]) => [row, tErr(code)])
        )
      );
      setSaveError(check.general ? tErr("invalid_input") : t("fixFields"));
      const firstLinkRow = Object.keys(check.links).map(Number).sort((a, b) => a - b)[0];
      const focusId = check.hourlyRate
        ? "onboarding-rate"
        : firstLinkRow !== undefined
          ? linkUrlInputId("onboarding", firstLinkRow)
          : null;
      if (focusId) document.getElementById(focusId)?.focus();
      return;
    }
    setRateError(null);
    setLinkErrors({});

    setSaving(true);
    const result = await savePhotographerDetails(input);
    setSaving(false);
    if (result.ok) {
      if (isEdit) {
        toast(tToast("saved"));
      } else {
        // First run: the photographer just went live. The moment lives in
        // the layout, so it stays up across the push to /home.
        celebrate({
          emblem: "spark",
          eyebrow: tWelcome("eyebrow"),
          title: tWelcome("title"),
          body: tWelcome("body"),
          primary: { label: tWelcome("browse"), href: "/shoots" },
          secondary: { label: tWelcome("overview") },
        });
      }
      router.push(isEdit ? "/profile" : "/home");
      router.refresh();
    } else {
      setSaveError(tErr(errorKey(result.error)));
    }
  }

  const canFinish =
    specialties.length > 0 && disciplines.length > 0 && cantons.length > 0;

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {/* Disciplines (photo / video) */}
      <div className="flex flex-col gap-3">
        <label className="label text-mute">{t("disciplines")}</label>
        <ChipMultiSelect
          options={disciplineOptions}
          value={disciplines}
          onChange={setDisciplines}
          data-testid="onboarding-disciplines"
        />
      </div>

      {/* Specialties */}
      <div className="flex flex-col gap-3">
        <label className="label text-mute">{t("specialties")}</label>
        <ChipMultiSelect
          options={specialtyOptions}
          value={specialties}
          onChange={setSpecialties}
          data-testid="onboarding-specialties"
        />
      </div>

      {/* Cantons */}
      <div className="flex flex-col gap-3">
        <label className="label text-mute">{t("cantons")}</label>
        <ChipMultiSelect
          options={cantonChoices}
          value={cantons}
          onChange={setCantons}
          data-testid="onboarding-cantons"
        />
      </div>

      {/* Hourly rate */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="onboarding-rate" className="label text-mute">
          {t("hourlyRate")}
        </label>
        <input
          id="onboarding-rate"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={hourlyRate}
          onChange={(e) => {
            setHourlyRate(e.target.value);
            setRateError(null);
          }}
          aria-invalid={rateError ? true : undefined}
          aria-describedby={rateError ? "onboarding-rate-error" : undefined}
          className={`w-48 border bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-mute-2 focus:border-ink transition-colors ${rateError ? "border-accent" : "border-line"}`}
          placeholder="—"
        />
        {rateError ? (
          <p id="onboarding-rate-error" className="text-[13px] text-accent">
            {rateError}
          </p>
        ) : null}
      </div>

      {/* Links — website, Instagram & co, optionally named per field */}
      <div className="flex flex-col gap-1.5">
        <p className="label text-mute">{t("links")}</p>
        <LinksEditor
          rows={linkRows}
          onChange={onLinksChange}
          errors={linkErrors}
          idPrefix="onboarding"
        />
      </div>

      {/* Portfolio */}
      <div className="flex flex-col gap-3">
        <label className="label text-mute">{t("portfolio")}</label>

        {portfolio.length < MAX_PORTFOLIO ? (
          <label className="press inline-flex cursor-pointer items-center gap-2 border border-line px-4 py-2 text-sm text-mute w-fit">
            {uploading ? "…" : t("addPhotos")}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              data-testid="onboarding-portfolio-input"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
        ) : (
          <p className="text-[13px] text-mute">{t("portfolioFull")}</p>
        )}

        {portfolio.length > 0 && (
          <div
            className="grid grid-cols-3 gap-3 sm:grid-cols-4"
            data-testid="onboarding-portfolio-grid"
          >
            {portfolio.map((item) => (
              <div key={item.id} className="relative group">
                {/* Plain <img> to avoid next/image remote pattern friction with local Supabase */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={t("portfolioThumbnailAlt")}
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full object-cover border border-line"
                />
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  className="press absolute top-1 right-1 bg-paper/80 border border-line px-1.5 py-0.5 text-xs text-ink opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                  aria-label={tCommon("remove")}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error message */}
      {saveError && (
        <p role="alert" className="text-sm text-accent">
          {saveError}
        </p>
      )}

      {/* Finish button */}
      <button
        type="button"
        data-testid="onboarding-finish"
        disabled={!canFinish || saving}
        onClick={handleFinish}
        className="press w-full bg-ink text-paper py-2.5 text-sm font-medium disabled:opacity-40 transition-opacity"
      >
        {isEdit ? t("save") : t("finish")}
      </button>
    </div>
  );
}
