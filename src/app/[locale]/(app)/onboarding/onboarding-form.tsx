"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ChipMultiSelect } from "@/components/chip-multi-select";
import {
  savePhotographerDetails,
  addPortfolioImage,
  removePortfolioImage,
} from "@/lib/actions/photographer";
import { SHOOT_TYPES, CANTONS } from "@/lib/validation/photographer";

type PortfolioItem = { id: string; url: string };

export default function OnboardingForm() {
  const t = useTranslations("onboarding");
  const tShoot = useTranslations("shoot");
  const router = useRouter();

  const [specialties, setSpecialties] = useState<string[]>([]);
  const [cantons, setCantons] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const specialtyOptions = SHOOT_TYPES.map((v) => ({
    value: v,
    label: tShoot(`types.${v}`),
  }));

  const cantonOptions = CANTONS.map((v) => ({ value: v, label: v }));

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setUploading(true);
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      const result = await addPortfolioImage(fd);
      if (result.ok) {
        setPortfolio((prev) => [...prev, { id: result.id, url: result.url }]);
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
    }
  }

  async function handleFinish() {
    setSaveError(null);
    setSaving(true);
    const result = await savePhotographerDetails({
      specialties,
      coverageCantons: cantons,
      hourlyRateChf: hourlyRate ? Number(hourlyRate) : undefined,
      websiteUrl: website,
      instagramUrl: instagram,
    });
    setSaving(false);
    if (result.ok) {
      router.push("/home");
      router.refresh();
    } else {
      setSaveError(t("errorSave"));
    }
  }

  const canFinish = specialties.length > 0 && cantons.length > 0;

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
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
          options={cantonOptions}
          value={cantons}
          onChange={setCantons}
          data-testid="onboarding-cantons"
        />
      </div>

      {/* Hourly rate */}
      <div className="flex flex-col gap-1.5">
        <label className="label text-mute">{t("hourlyRate")}</label>
        <input
          type="number"
          min={1}
          value={hourlyRate}
          onChange={(e) => setHourlyRate(e.target.value)}
          className="w-48 border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-mute-2 focus:outline-none focus:border-ink transition-colors"
          placeholder="—"
        />
      </div>

      {/* Website */}
      <div className="flex flex-col gap-1.5">
        <label className="label text-mute">{t("website")}</label>
        <input
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="w-full border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-mute-2 focus:outline-none focus:border-ink transition-colors"
          placeholder="https://example.com"
        />
      </div>

      {/* Instagram */}
      <div className="flex flex-col gap-1.5">
        <label className="label text-mute">{t("instagram")}</label>
        <input
          type="url"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          className="w-full border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-mute-2 focus:outline-none focus:border-ink transition-colors"
          placeholder="https://instagram.com/username"
        />
      </div>

      {/* Portfolio */}
      <div className="flex flex-col gap-3">
        <label className="label text-mute">{t("portfolio")}</label>

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
                  alt="portfolio thumbnail"
                  className="aspect-square w-full object-cover border border-line"
                />
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  className="press absolute top-1 right-1 bg-paper/80 border border-line px-1.5 py-0.5 text-xs text-ink opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error message */}
      {saveError && <p className="text-sm text-accent">{saveError}</p>}

      {/* Finish button */}
      <button
        type="button"
        data-testid="onboarding-finish"
        disabled={!canFinish || saving}
        onClick={handleFinish}
        className="press w-full bg-ink text-paper py-2.5 text-sm font-medium disabled:opacity-40 transition-opacity"
      >
        {t("finish")}
      </button>
    </div>
  );
}
