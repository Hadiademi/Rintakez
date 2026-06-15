"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { SHOOT_TYPES, CANTONS } from "@/lib/validation/photographer";

export function PhotographerFilters() {
  const t = useTranslations("directory");
  const tShoot = useTranslations("shoot");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page"); // any filter change returns to the first page
    router.push(`${pathname}?${next.toString()}`);
  }

  const selectClass =
    "border border-line bg-surface px-3 py-2 text-[14px] text-ink focus:border-ink focus:outline-none";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        data-testid="filter-specialty"
        value={params.get("type") ?? ""}
        onChange={(e) => setParam("type", e.target.value)}
        className={selectClass}
      >
        <option value="">{t("allSpecialties")}</option>
        {SHOOT_TYPES.map((v) => (
          <option key={v} value={v}>
            {tShoot(`types.${v}`)}
          </option>
        ))}
      </select>

      <select
        data-testid="filter-canton"
        value={params.get("canton") ?? ""}
        onChange={(e) => setParam("canton", e.target.value)}
        className={selectClass}
      >
        <option value="">{t("allCantons")}</option>
        {CANTONS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        data-testid="filter-minrating"
        value={params.get("minRating") ?? ""}
        onChange={(e) => setParam("minRating", e.target.value)}
        className={selectClass}
      >
        <option value="">{t("minRating")}</option>
        {[3, 4, 4.5].map((r) => (
          <option key={r} value={r}>
            ★ {r}+
          </option>
        ))}
      </select>

      <button
        type="button"
        data-testid="filter-saved"
        onClick={() => setParam("saved", params.get("saved") ? "" : "1")}
        aria-pressed={!!params.get("saved")}
        className={`press border px-3 py-2 text-[14px] transition-colors ${
          params.get("saved")
            ? "border-ink bg-ink text-paper"
            : "border-line text-ink hover:border-ink"
        }`}
      >
        ♥ {t("savedOnly")}
      </button>

      <select
        data-testid="filter-sort"
        value={params.get("sort") ?? "rating"}
        onChange={(e) => setParam("sort", e.target.value)}
        className={`${selectClass} ml-auto`}
      >
        <option value="rating">{t("sortRating")}</option>
        <option value="price">{t("sortPriceAsc")}</option>
      </select>
    </div>
  );
}
