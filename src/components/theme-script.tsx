export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
