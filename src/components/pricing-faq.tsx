"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const FAQ_KEYS = [
  { q: "pricing.faqQ1", a: "pricing.faqA1" },
  { q: "pricing.faqQ2", a: "pricing.faqA2" },
  { q: "pricing.faqQ3", a: "pricing.faqA3" },
  { q: "pricing.faqQ4", a: "pricing.faqA4" },
] as const;

/** Plus/close glyph for the accordion toggle — rotates into an "×" when open. */
function Toggle({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`shrink-0 text-mute transition-transform duration-200 ${open ? "rotate-45" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M8 2v12M2 8h12" />
    </svg>
  );
}

/** Pricing-page FAQ accordion — first item open by default, keyboard-operable. */
export function PricingFaq() {
  const t = useTranslations("billing");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="label text-mute-2">01 —</span>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          {t("pricing.faqTitle")}
        </h2>
      </div>

      <div className="mt-6 border-t border-line">
        {FAQ_KEYS.map(({ q, a }, index) => {
          const open = openIndex === index;
          const panelId = `pricing-faq-panel-${index}`;
          const buttonId = `pricing-faq-button-${index}`;
          return (
            <div key={q} className="border-b border-line">
              <button
                type="button"
                id={buttonId}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIndex(open ? null : index)}
                className="press flex w-full items-center justify-between gap-4 py-5 text-left"
              >
                <span className="text-[15px] font-medium text-ink">{t(q)}</span>
                <Toggle open={open} />
              </button>
              {open && (
                <p
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className="pb-5 text-[14px] leading-relaxed text-mute"
                >
                  {t(a)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
