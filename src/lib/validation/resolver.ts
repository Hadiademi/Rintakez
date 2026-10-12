import { zodResolver } from "@hookform/resolvers/zod";
import type { $ZodType } from "zod/v4/core";
import type { FieldValues } from "react-hook-form";
import { validationErrorMap } from "@/lib/validation/messages";

/**
 * zodResolver that reports every issue as a localizable token (see
 * validation/messages.ts). Use it for every react-hook-form form; render
 * errors with useValidationMessage(), never `errors.x.message` directly.
 */
export function localizedZodResolver<T extends $ZodType<FieldValues, FieldValues>>(schema: T) {
  return zodResolver(schema, { error: validationErrorMap });
}
