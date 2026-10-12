import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import de from "@/i18n/messages/de.json";
import fr from "@/i18n/messages/fr.json";
import en from "@/i18n/messages/en.json";
import {
  VALIDATION_KEYS,
  parseValidationMessage,
  validationErrorMap,
} from "@/lib/validation/messages";
import {
  changeEmailSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";
import { createShootSchema } from "@/lib/validation/shoot";
import { createBidSchema } from "@/lib/validation/bid";

// Review UI-02 / I18N-01: forms showed raw English Zod defaults ("Too small:
// expected string to have >=8 characters") and raw keys ("budget_range") in
// every locale. Client forms now parse with validationErrorMap, which turns
// each issue into a "v:<key>[:<n>]" token that useValidationMessage()
// translates.

function messages(schema: z.ZodType, input: unknown): Record<string, string> {
  const r = schema.safeParse(input, { error: validationErrorMap });
  if (r.success) return {};
  return Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message]));
}

const PAST = "2000-01-01";
const FUTURE = `${new Date().getFullYear() + 1}-06-15`;
const validShoot = {
  title: "Hochzeit am See", type: "wedding", discipline: "photo",
  brief: "Ganztägige Reportage mit Apéro.", locationCity: "Thun",
  locationPostcode: "3600", canton: "BE", shootDate: FUTURE,
  durationHours: 6, budgetMinChf: 2000, budgetMaxChf: 3000,
};

describe("validationErrorMap", () => {
  it("maps the cases users actually hit to specific keys", () => {
    expect(messages(registerSchema, {
      email: "nope", password: "short", displayName: "", role: "client", locale: "de", acceptTerms: false,
    })).toEqual({
      email: "v:email",
      password: "v:tooShort:8",
      displayName: "v:required",
      acceptTerms: "v:acceptTerms",
    });
    expect(messages(createShootSchema, {
      ...validShoot, canton: "", locationPostcode: "30", shootDate: PAST,
      durationHours: Number.NaN, title: "ab",
    })).toEqual({
      canton: "v:chooseOption",
      locationPostcode: "v:postcode",
      shootDate: "v:dateMustBeFuture",
      durationHours: "v:number",
      title: "v:tooShort:3",
    });
    // The cross-field rule runs once the fields themselves are valid.
    expect(messages(createShootSchema, { ...validShoot, budgetMinChf: 3000, budgetMaxChf: 2000 })).toEqual({
      budgetMaxChf: "v:budgetRange",
    });
    expect(messages(createShootSchema, { ...validShoot, locationPostcode: "" })).toEqual({});
    expect(messages(createShootSchema, { ...validShoot, type: undefined, durationHours: 30 })).toEqual({
      type: "v:chooseOption",
      durationHours: "v:numberMax:24",
    });
    expect(messages(loginSchema, { email: "", password: "" })).toEqual({
      email: "v:required",
      password: "v:required",
    });
    expect(messages(createBidSchema, { amountChf: 0, message: "zu kurz" })).toEqual({
      amountChf: "v:numberPositive",
      message: "v:tooShort:10",
    });
  });

  it("never lets a raw English default or unknown key through on any client form", () => {
    const cases: Array<[z.ZodType, unknown]> = [
      [registerSchema, {}],
      [registerSchema, { email: "a@b.ch", password: "x".repeat(99), displayName: "x".repeat(99), role: "admin", locale: "it", acceptTerms: "yes" }],
      [loginSchema, {}],
      [loginSchema, { email: "", password: "" }],
      [forgotPasswordSchema, { email: "x" }],
      [resetPasswordSchema, { password: "1" }],
      [changePasswordSchema, { currentPassword: "", newPassword: "x".repeat(80) }],
      [changeEmailSchema, { email: "" }],
      [createShootSchema, {}],
      [createShootSchema, { ...validShoot, title: "x".repeat(200), brief: "x".repeat(5000), discipline: "drone", budgetMinChf: -5, budgetMaxChf: 2_000_000, durationHours: 1.5 }],
      [createBidSchema, {}],
      [createBidSchema, { amountChf: "abc", message: "x".repeat(3000) }],
    ];
    const seen = cases.flatMap(([schema, input]) => Object.values(messages(schema, input)));
    expect(seen.length).toBeGreaterThan(20);
    for (const m of seen) {
      expect(m, `message "${m}"`).toMatch(/^v:[a-zA-Z]+(:\d+)?$/);
      expect(parseValidationMessage(m).key, `message "${m}"`).not.toBe("generic");
    }
  });
});

describe("parseValidationMessage", () => {
  it("decodes keys and numeric limits", () => {
    expect(parseValidationMessage("v:tooShort:8")).toEqual({ key: "tooShort", values: { n: 8 } });
    expect(parseValidationMessage("v:email")).toEqual({ key: "email", values: {} });
  });

  it("falls back to a generic message for anything unknown", () => {
    for (const m of [undefined, "", "Too small: expected string", "v:noSuchKey", "budget_range"]) {
      expect(parseValidationMessage(m)).toEqual({ key: "generic", values: {} });
    }
  });
});

describe("validation copy", () => {
  const locales = { de, fr, en } as Record<string, { validation?: Record<string, string> }>;

  it("exists for every key in de, fr and en, with {n} wherever a limit is passed", () => {
    for (const [locale, msgs] of Object.entries(locales)) {
      for (const key of VALIDATION_KEYS) {
        const text = msgs.validation?.[key];
        expect(text, `${locale}.validation.${key}`).toBeTruthy();
        const takesLimit = ["tooShort", "tooLong", "numberMin", "numberMax"].includes(key);
        expect(text!.includes("{n}"), `${locale}.validation.${key} uses {n}`).toBe(takesLimit);
      }
    }
  });
});

describe("form wiring", () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name);
      if (e.isDirectory()) return sourceFiles(p);
      return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
    });
  }
  const files = sourceFiles(join(process.cwd(), "src"));

  it("no form renders a raw validation message", () => {
    const offenders = files.filter((f) => /\{\s*errors\.[\w.]+\??\.message\s*\}/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("every form resolver goes through the localized resolver", () => {
    const offenders = files.filter(
      (f) => !f.endsWith("validation/resolver.ts") && /\bzodResolver\(/.test(readFileSync(f, "utf8"))
    );
    expect(offenders).toEqual([]);
  });
});
