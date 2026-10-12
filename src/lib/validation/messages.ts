import type { $ZodErrorMap } from "zod/v4/core";

/**
 * Localized form validation.
 *
 * Client forms parse with `validationErrorMap` (see localizedZodResolver), which
 * turns every Zod issue into a token "v:<key>" or "v:<key>:<n>". The UI turns
 * the token into copy from the `validation` namespace via useValidationMessage.
 * Schemas may also set a token directly as their message (e.g. "v:budgetRange")
 * for rules the generic mapping cannot name. Server actions don't use this map;
 * they answer with error codes, never with Zod messages.
 */
export const VALIDATION_KEYS = [
  "required",
  "tooShort",
  "tooLong",
  "number",
  "wholeNumber",
  "numberMin",
  "numberMax",
  "numberPositive",
  "email",
  "url",
  "postcode",
  "chooseOption",
  "dateMustBeFuture",
  "budgetRange",
  "acceptTerms",
  "generic",
] as const;

export type ValidationKey = (typeof VALIDATION_KEYS)[number];

function token(key: ValidationKey, n?: number | bigint): string {
  return n === undefined ? `v:${key}` : `v:${key}:${n}`;
}

export const validationErrorMap: $ZodErrorMap = (issue) => {
  const empty = issue.input === "" || issue.input === undefined || issue.input === null;
  switch (issue.code) {
    case "invalid_type":
      if (issue.expected === "int") return token("wholeNumber");
      if (issue.expected === "number") return token("number");
      return token(empty ? "required" : "generic");
    case "too_small":
      if (issue.origin === "string") return empty ? token("required") : token("tooShort", issue.minimum);
      if (issue.origin === "number" || issue.origin === "int") {
        return issue.minimum === 0 && !issue.inclusive
          ? token("numberPositive")
          : token("numberMin", issue.minimum);
      }
      return token("chooseOption");
    case "too_big":
      if (issue.origin === "string") return token("tooLong", issue.maximum);
      if (issue.origin === "number" || issue.origin === "int") return token("numberMax", issue.maximum);
      return token("generic");
    case "invalid_format":
      if (empty) return token("required");
      if (issue.format === "email") return token("email");
      if (issue.format === "url") return token("url");
      return token("generic");
    case "invalid_value":
      return token("chooseOption");
    default:
      return token("generic");
  }
};

const KNOWN = new Set<string>(VALIDATION_KEYS);

/** Decode a validation token; anything else (raw Zod text, old keys) → generic. */
export function parseValidationMessage(message: string | undefined): {
  key: ValidationKey;
  values: Record<string, number>;
} {
  const m = /^v:([a-zA-Z]+)(?::(\d+))?$/.exec(message ?? "");
  if (!m || !KNOWN.has(m[1])) return { key: "generic", values: {} };
  return { key: m[1] as ValidationKey, values: m[2] === undefined ? {} : { n: Number(m[2]) } };
}
