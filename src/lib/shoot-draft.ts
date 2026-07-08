import type { CreateShootInput } from "@/lib/validation/shoot";

// localStorage-backed autosave for the new-shoot wizard. This module is pure
// (no DOM, no storage access) so the serialize/deserialize + "is this draft
// worth keeping?" logic can be unit-tested; the component owns the actual
// localStorage read/write + debounce.

const STEP_COUNT = 3;

// The subset of the form that we persist. Reference images are File objects
// (not serialisable and re-picked each session) and are deliberately excluded.
export const DRAFT_FIELDS = [
  "discipline",
  "type",
  "locationCity",
  "locationPostcode",
  "canton",
  "shootDate",
  "durationHours",
  "title",
  "brief",
  "budgetMinChf",
  "budgetMaxChf",
] as const;

type DraftField = (typeof DRAFT_FIELDS)[number];

export type ShootDraftValues = Partial<Pick<CreateShootInput, DraftField>>;

export interface ShootDraft {
  values: ShootDraftValues;
  step: number;
}

// Form-level defaults (see the useForm defaultValues). A value equal to its
// default doesn't count as user intent, so an untouched form never produces a
// draft on load.
const DEFAULTS: ShootDraftValues = { discipline: "photo", durationHours: 4 };

export function draftKey(userId: string): string {
  return `rintakez:shoot-draft:${userId}`;
}

/** Keep only persistable fields, dropping undefined / NaN (empty inputs). */
export function pickDraftValues(
  values: Record<string, unknown>
): ShootDraftValues {
  const out: Record<string, unknown> = {};
  for (const field of DRAFT_FIELDS) {
    const value = values[field];
    if (value === undefined || value === null) continue;
    if (typeof value === "number" && Number.isNaN(value)) continue;
    out[field] = value;
  }
  return out as ShootDraftValues;
}

/**
 * A draft is "meaningful" once the user has entered something beyond the
 * form defaults — otherwise we'd persist (and later restore) an empty form the
 * instant the page loads.
 */
export function isMeaningfulDraft(values: Record<string, unknown>): boolean {
  return DRAFT_FIELDS.some((field) => {
    const value = values[field];
    if (value === undefined || value === null || value === "") return false;
    if (typeof value === "number" && Number.isNaN(value)) return false;
    const fallback = DEFAULTS[field as keyof ShootDraftValues];
    if (fallback !== undefined && value === fallback) return false;
    return true;
  });
}

export function serializeDraft(
  values: Record<string, unknown>,
  step: number
): string {
  return JSON.stringify({ values: pickDraftValues(values), step });
}

/** Parse a stored draft. Returns null (never throws) for missing/bad data. */
export function deserializeDraft(raw: string | null): ShootDraft | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const record = parsed as { values?: unknown; step?: unknown };
  const rawValues =
    record.values && typeof record.values === "object"
      ? (record.values as Record<string, unknown>)
      : {};
  const step =
    typeof record.step === "number" &&
    Number.isInteger(record.step) &&
    record.step >= 0 &&
    record.step < STEP_COUNT
      ? record.step
      : 0;
  return { values: pickDraftValues(rawValues), step };
}
