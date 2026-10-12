import { useTranslations } from "next-intl";
import { parseValidationMessage } from "@/lib/validation/messages";

/** Turns a react-hook-form field error into copy in the current locale. */
export function useValidationMessage() {
  const t = useTranslations("validation");
  return (error: { message?: string } | undefined): string | null => {
    if (!error) return null;
    const { key, values } = parseValidationMessage(error.message);
    return t(key, values);
  };
}
