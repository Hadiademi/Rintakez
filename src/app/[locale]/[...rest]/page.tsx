import { notFound } from "next/navigation";

// Any path under a locale that no route matches would otherwise fall through
// to Next's root default 404 (English, unbranded, no lang attribute, no way
// back). Catching it here renders the localized [locale]/not-found.tsx inside
// the app's layout instead. Lowest-priority route: real routes always win.
export default function UnknownPathPage() {
  notFound();
}
