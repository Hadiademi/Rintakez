/**
 * A photographer's public links (website, Instagram, YouTube…).
 *
 * Why a list instead of one website + one Instagram: photographers who work in
 * more than one field keep separate presences for each — a real one told us
 * she runs one site and one Instagram for sport and another pair for weddings,
 * and could not show both. Each link carries an optional label ("Sport",
 * "Hochzeit") so a visitor can tell them apart.
 *
 * Why the normaliser: people type links the way they see them, not the way a
 * URL parser wants them. "www.myrensport.com" was rejected outright by the old
 * `z.string().url()` check, which blocked that photographer's onboarding with a
 * generic "please check your input". We now accept the common shapes and store
 * one canonical form.
 *
 * Pure and framework-free: imported by the zod schema (server + client), the
 * editors and the public profile. The database enforces the same shape with a
 * CHECK constraint (valid_photographer_links, 20261111130000) because owners
 * can write the column directly through the API, bypassing this code.
 */

export const MAX_LINKS = 6;
export const LINK_LABEL_MAX = 40;
export const LINK_URL_MAX = 300;

export type ProfileLink = { url: string; label: string | null };

export type LinkKind =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "vimeo"
  | "facebook"
  | "linkedin"
  | "website";

// Instagram usernames: letters, digits, "." and "_", up to 30 characters.
const INSTAGRAM_HANDLE = /^@([A-Za-z0-9._]{1,30})$/;
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
// A public host ends in a letter-led TLD of 2+ characters. This rules out
// "localhost", bare words and IP addresses, none of which belong on a profile.
const PUBLIC_HOST = /\.[a-z][a-z0-9-]*[a-z0-9]$/i;

/**
 * Turn what a person typed into a canonical http(s) link, or null when it is
 * not a web link at all.
 *
 *   "www.example.ch"        -> "https://www.example.ch"
 *   "example.ch/portfolio"  -> "https://example.ch/portfolio"
 *   "@anna.foto"            -> "https://www.instagram.com/anna.foto"
 *   "http://example.ch"     -> kept as is (some old sites have no TLS)
 *   "javascript:…", "mailto:…", "my site", "localhost" -> null
 *
 * The scheme is only ever http or https, so the result is always safe to put
 * in an href.
 */
export function normalizeLinkUrl(raw: string): string | null {
  const input = raw.trim();
  if (!input || /\s/.test(input)) return null;

  const handle = INSTAGRAM_HANDLE.exec(input);
  if (handle) return `https://www.instagram.com/${handle[1]}`;
  if (input.startsWith("@")) return null;

  let candidate: string;
  const scheme = SCHEME.exec(input);
  if (scheme) {
    const name = scheme[1].toLowerCase();
    if (name !== "http" && name !== "https") return null;
    candidate = name + input.slice(name.length);
  } else if (input.startsWith("//")) {
    candidate = `https:${input}`;
  } else {
    candidate = `https://${input}`;
  }

  if (candidate.length > LINK_URL_MAX) return null;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!PUBLIC_HOST.test(url.hostname)) return null;

  return candidate;
}

const PLATFORMS: ReadonlyArray<[LinkKind, RegExp]> = [
  ["instagram", /(^|\.)instagram\.com$/i],
  ["tiktok", /(^|\.)tiktok\.com$/i],
  ["youtube", /(^|\.)(youtube\.com|youtu\.be)$/i],
  ["vimeo", /(^|\.)vimeo\.com$/i],
  ["facebook", /(^|\.)(facebook\.com|fb\.com)$/i],
  ["linkedin", /(^|\.)linkedin\.com$/i],
];

/**
 * How a link reads on a profile: Instagram/TikTok as "@handle", everything
 * else as its host without "www." — "Sport · myrensport.com" tells a visitor
 * far more than a generic "Website".
 */
export function linkDisplay(link: ProfileLink): {
  kind: LinkKind;
  text: string;
  label: string | null;
} {
  let host: string;
  let path: string;
  try {
    const u = new URL(link.url);
    host = u.hostname;
    path = u.pathname;
  } catch {
    return { kind: "website", text: link.url, label: link.label };
  }

  const kind = PLATFORMS.find(([, re]) => re.test(host))?.[0] ?? "website";

  if (kind === "instagram" || kind === "tiktok") {
    const first = path.split("/").filter(Boolean)[0];
    if (first) return { kind, text: `@${first.replace(/^@/, "")}`, label: link.label };
  }

  return { kind, text: host.replace(/^www\./i, ""), label: link.label };
}

function asStoredLink(value: unknown): ProfileLink | null {
  if (typeof value !== "object" || value === null) return null;
  const { url, label } = value as { url?: unknown; label?: unknown };
  if (typeof url !== "string" || !/^https?:\/\//.test(url)) return null;
  if (normalizeLinkUrl(url) === null) return null;
  return {
    url,
    label: typeof label === "string" && label.trim() ? label.trim() : null,
  };
}

/**
 * The links to show for a photographer_details row.
 *
 * Reads the `links` list; when it is empty, falls back to the two legacy
 * columns. That fallback covers the deploy window (the migration runs before
 * the new code, so a profile saved in between only updated the old columns) and
 * a rollback to the previous release, which still writes them. Anything that
 * does not look like a safe http(s) link is dropped rather than rendered.
 */
export function resolveLinks(
  row: {
    links?: unknown;
    website_url?: string | null;
    instagram_url?: string | null;
  } | null
): ProfileLink[] {
  if (!row) return [];

  const fromList = Array.isArray(row.links)
    ? row.links.flatMap((entry) => {
        const link = asStoredLink(entry);
        return link ? [link] : [];
      })
    : [];

  const links =
    fromList.length > 0
      ? fromList
      : [row.website_url, row.instagram_url].flatMap((url) => {
          const link = asStoredLink({ url, label: null });
          return link ? [link] : [];
        });

  return links.slice(0, MAX_LINKS);
}

/**
 * Values for the legacy website_url / instagram_url columns, derived from the
 * list: the first Instagram link and the first other link. Writing them keeps a
 * rollback to the previous release showing the photographer's main links
 * instead of none.
 */
export function legacyLinkColumns(links: ProfileLink[]): {
  website_url: string | null;
  instagram_url: string | null;
} {
  const instagram = links.find((l) => linkDisplay(l).kind === "instagram");
  const website = links.find((l) => linkDisplay(l).kind !== "instagram");
  return {
    website_url: website?.url ?? null,
    instagram_url: instagram?.url ?? null,
  };
}

const PLATFORM_NAMES: Record<Exclude<LinkKind, "website">, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  vimeo: "Vimeo",
  facebook: "Facebook",
  linkedin: "LinkedIn",
};

/** Brand name of a platform link (proper nouns, the same in every language),
 *  or null for an ordinary website. */
export function platformName(kind: LinkKind): string | null {
  return kind === "website" ? null : PLATFORM_NAMES[kind];
}

export type LinkRow = { label: string; url: string };

/**
 * Editor rows -> what the schema validates. Fully empty rows are dropped (an
 * untouched "add link" row is not an error); a row with only a name is kept so
 * validation can flag it. `rowOf[i]` is the editor row the i-th payload entry
 * came from, which lets a schema error on `links[i]` land on the right input.
 */
export function toLinkPayload(rows: LinkRow[]): {
  payload: LinkRow[];
  rowOf: number[];
} {
  const payload: LinkRow[] = [];
  const rowOf: number[] = [];
  rows.forEach((row, index) => {
    if (!row.url.trim() && !row.label.trim()) return;
    payload.push(row);
    rowOf.push(index);
  });
  return { payload, rowOf };
}
