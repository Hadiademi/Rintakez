import { getRequestConfig } from "next-intl/server";
import { resolveRequestConfig } from "./request-config";

export default getRequestConfig(async ({ requestLocale }) =>
  resolveRequestConfig(await requestLocale)
);
