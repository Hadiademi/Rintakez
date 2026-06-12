// Lucide-style line icons, 1.5px stroke, no fill.
// Sized 24px by default; pass size & className.

const Icon = ({ children, size = 22, className = '', stroke = 1.5, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...rest}
  >
    {children}
  </svg>
);

const IcHome = (p) => <Icon {...p}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></Icon>;
const IcSearch = (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></Icon>;
const IcPlus = (p) => <Icon {...p}><path d="M12 5v14"/><path d="M5 12h14"/></Icon>;
const IcMail = (p) => <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="0.5"/><path d="m3 7 9 6 9-6"/></Icon>;
const IcUser = (p) => <Icon {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></Icon>;

const IcChevronRight = (p) => <Icon {...p}><path d="m9 5 7 7-7 7"/></Icon>;
const IcChevronLeft  = (p) => <Icon {...p}><path d="m15 5-7 7 7 7"/></Icon>;
const IcChevronDown  = (p) => <Icon {...p}><path d="m6 9 6 6 6-6"/></Icon>;
const IcChevronUp    = (p) => <Icon {...p}><path d="m6 15 6-6 6 6"/></Icon>;
const IcArrowRight   = (p) => <Icon {...p}><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></Icon>;
const IcArrowUp      = (p) => <Icon {...p}><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></Icon>;

const IcBookmark = (p) => <Icon {...p}><path d="M6 4h12v17l-6-4-6 4z"/></Icon>;
const IcShare    = (p) => <Icon {...p}><path d="M12 3v13"/><path d="m7 8 5-5 5 5"/><path d="M5 14v6h14v-6"/></Icon>;
const IcStar     = (p) => <Icon {...p}><path d="m12 3 2.7 5.7 6.3.9-4.5 4.4 1 6.3-5.5-3-5.5 3 1-6.3L3 9.6l6.3-.9z"/></Icon>;
const IcStarSolid = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="m12 3 2.7 5.7 6.3.9-4.5 4.4 1 6.3-5.5-3-5.5 3 1-6.3L3 9.6l6.3-.9z"/>
  </svg>
);

const IcClose   = (p) => <Icon {...p}><path d="M6 6 18 18"/><path d="M18 6 6 18"/></Icon>;
const IcCheck   = (p) => <Icon {...p}><path d="M4 12.5 10 18.5 20 6"/></Icon>;
const IcFilter  = (p) => <Icon {...p}><path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/></Icon>;
const IcBell    = (p) => <Icon {...p}><path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 8H4c0-2 2-3 2-8z"/><path d="M10 21a2 2 0 0 0 4 0"/></Icon>;
const IcCal     = (p) => <Icon {...p}><rect x="3" y="5" width="18" height="16" rx="0.5"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/></Icon>;
const IcClock   = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>;
const IcPin     = (p) => <Icon {...p}><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></Icon>;
const IcDots    = (p) => <Icon {...p}><circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/></Icon>;
const IcSliders = (p) => <Icon {...p}><path d="M4 6h10"/><path d="M18 6h2"/><circle cx="16" cy="6" r="2"/><path d="M4 12h2"/><path d="M10 12h10"/><circle cx="8" cy="12" r="2"/><path d="M4 18h10"/><path d="M18 18h2"/><circle cx="16" cy="18" r="2"/></Icon>;
const IcCamera  = (p) => <Icon {...p}><path d="M3 7h4l2-2h6l2 2h4v12H3z"/><circle cx="12" cy="13" r="3.5"/></Icon>;
const IcSend    = (p) => <Icon {...p}><path d="m4 12 16-8-6 18-2-8z"/></Icon>;
const IcGlobe   = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 3 4 6 4 9s-1.5 6-4 9c-2.5-3-4-6-4-9s1.5-6 4-9z"/></Icon>;
const IcBriefcase = (p) => <Icon {...p}><rect x="3" y="7" width="18" height="13" rx="0.5"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></Icon>;
const IcList    = (p) => <Icon {...p}><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/></Icon>;
const IcEdit    = (p) => <Icon {...p}><path d="M14 4l6 6L9 21H3v-6z"/><path d="m13 5 6 6"/></Icon>;
const IcChart   = (p) => <Icon {...p}><path d="M3 21h18"/><rect x="5" y="14" width="3" height="6"/><rect x="11" y="9" width="3" height="11"/><rect x="17" y="5" width="3" height="15"/></Icon>;
const IcSettings= (p) => <Icon {...p}><circle cx="12" cy="12" r="2.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></Icon>;
const IcLogout  = (p) => <Icon {...p}><path d="M14 3h6v18h-6"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h12"/></Icon>;

Object.assign(window, {
  IcHome, IcSearch, IcPlus, IcMail, IcUser,
  IcChevronRight, IcChevronLeft, IcChevronDown, IcChevronUp,
  IcArrowRight, IcArrowUp,
  IcBookmark, IcShare, IcStar, IcStarSolid,
  IcClose, IcCheck, IcFilter, IcBell, IcCal, IcClock, IcPin,
  IcDots, IcSliders, IcCamera, IcSend, IcGlobe,
  IcBriefcase, IcList, IcEdit, IcChart, IcSettings, IcLogout,
});
