const CODE = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

/**
 * Sets the theme before paint to avoid a flash. This only ever runs on the
 * initial server render — the locale switcher does a hard navigation, so the
 * root layout (and this script) is never re-rendered on the client.
 */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: CODE }} />;
}
