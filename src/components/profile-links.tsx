import { linkDisplay, platformName, type ProfileLink } from "@/lib/links";

/**
 * A photographer's public links as they read on a profile:
 *
 *   SPORT     Instagram @myren.sports
 *   SPORT     myrensport.com
 *   HOCHZEIT  myren-weddings.ch
 *
 * The visible host / @handle (instead of a generic "Website") lets a visitor
 * see where a link goes before tapping it, and the optional name tells two
 * presences of the same photographer apart.
 *
 * rel="nofollow ugc": these are user-supplied links on a public page, so they
 * pass no ranking credit — that keeps profile links worthless to link spammers.
 *
 * No hooks, so it renders in both the server profile page and the client
 * settings editor.
 */
export function ProfileLinkList({ links }: { links: ProfileLink[] }) {
  if (links.length === 0) return null;

  // When any link is named, names sit in their own column so the links line
  // up ("SPORT" and "HOCHZEIT" differ in width). The column is capped, so a
  // long name wraps instead of squeezing the link on a 390px screen. Rows use
  // subgrid to share the columns while keeping real <li>/<a> elements.
  const named = links.some((link) => link.label);

  return (
    <ul
      className={
        named
          ? "grid grid-cols-[fit-content(9rem)_minmax(0,1fr)] gap-x-4 gap-y-2"
          : "flex flex-col gap-2"
      }
    >
      {links.map((link, index) => {
        const display = linkDisplay(link);
        const platform = platformName(display.kind);
        return (
          <li
            key={`${index}-${link.url}`}
            className={named ? "col-span-2 grid grid-cols-subgrid" : undefined}
          >
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              className={`group items-baseline ${
                named ? "col-span-2 grid grid-cols-subgrid" : "inline-flex max-w-full"
              }`}
            >
              {named ? (
                <span className="label break-words text-mute">{display.label ?? ""}</span>
              ) : null}
              <span className="min-w-0 break-all text-[15px] text-accent underline underline-offset-2 transition-opacity group-hover:opacity-70">
                {platform ? `${platform} ${display.text}` : display.text}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
