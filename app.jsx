// Main app: navigation stack, tweaks (language), device shell.

const { useState: useS, useEffect: useE } = React;

const DEFAULTS = /*EDITMODE-BEGIN*/{
  "lang": "de",
  "role": "client",
  "theme": "light",
  "showStatusBar": true,
  "imageMode": "mixed"
}/*EDITMODE-END*/;

const StatusBarChrome = ({ lang }) => {
  const [now, setNow] = useS(() => new Date());
  useE(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return (
    <div className="statusbar tabular">
      <span>{hh}:{mm}</span>
      <span className="flex items-center gap-1.5">
        {/* signal */}
        <svg width="18" height="11" viewBox="0 0 18 11" fill="currentColor">
          <rect x="0" y="7" width="3" height="4"/>
          <rect x="5" y="5" width="3" height="6"/>
          <rect x="10" y="2.5" width="3" height="8.5"/>
          <rect x="15" y="0" width="3" height="11"/>
        </svg>
        {/* wifi */}
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M1 4.2C2.8 2.5 5 1.5 7.5 1.5S12.2 2.5 14 4.2"/>
          <path d="M3.4 6.6C4.5 5.6 5.9 5 7.5 5s3 0.6 4.1 1.6"/>
          <circle cx="7.5" cy="9" r="1" fill="currentColor"/>
        </svg>
        {/* battery */}
        <svg width="27" height="11" viewBox="0 0 27 11" fill="none">
          <rect x="0.5" y="0.5" width="22" height="10" rx="2" stroke="currentColor"/>
          <rect x="2" y="2" width="17" height="7" fill="currentColor"/>
          <rect x="24" y="3.5" width="2" height="4" rx="1" fill="currentColor"/>
        </svg>
      </span>
    </div>
  );
};

const HomeIndicator = () => (
  <div className="shrink-0 flex justify-center pb-2 pt-1.5 bg-paper">
    <span className="w-[135px] h-[5px] rounded-full bg-ink"></span>
  </div>
);

const App = () => {
  const tw = useTweaks ? useTweaks(DEFAULTS) : null;
  const [tweaks, setTweak] = tw || [DEFAULTS, () => {}];
  const lang = tweaks.lang || 'de';
  const role = tweaks.role || 'client';

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', tweaks.theme || 'light');
  }, [tweaks.theme]);

  // Nav stack:
  // - tabs: home / jobs|browse / create|bids / inbox / profile
  // - stack pushes detail / profile / chat / create on top
  const [tab, setTab] = useS('home');
  const [stack, setStack] = useS([]); // [{name, params}]
  const [sheet, setSheet] = useS(null); // 'bid' | null
  const [toast, setToast] = useS(null);

  // Reset to home when role changes
  React.useEffect(() => {
    setTab('home');
    setStack([]);
    setSheet(null);
  }, [role]);

  const top = stack[stack.length - 1];

  const go = (target, params = {}) => {
    if (target === 'back') {
      if (stack.length) setStack(stack.slice(0, -1));
      return;
    }
    if (target === 'home') {
      setTab('home');
      setStack([]);
      return;
    }
    if (target === 'detail' || target === 'profile' || target === 'chat' || target === 'client-review' || target === 'booking-confirmed') {
      setStack([...stack, { name: target, params }]);
      return;
    }
    if (target === 'create') {
      setTab('create');
      setStack([{ name: 'create', params: {} }]);
      return;
    }
  };

  const onNav = (id) => {
    setStack([]);
    setSheet(null);
    if (id === 'create') {
      go('create');
    } else {
      setTab(id);
    }
  };

  // Render top screen if stack has something, else render tab
  const renderTab = () => {
    if (role === 'photographer') {
      switch (tab) {
        case 'home':    return <PhotogHome go={go} />;
        case 'browse':  return <Browse go={go} />;
        case 'bids':    return <PhotogMyBids go={go} />;
        case 'inbox':   return <Inbox go={go} />;
        case 'profile': return <PhotogProfileEdit go={go} />;
        default: return <PhotogHome go={go} />;
      }
    }
    // client
    switch (tab) {
      case 'home':    return <Home go={go} />;
      case 'jobs':    return <ClientMyShoots go={go} />;
      case 'inbox':   return <Inbox go={go} />;
      case 'profile': return <ClientProfile go={go} />;
      case 'create':  return <CreateFlow go={go} />;
      default: return <Home go={go} />;
    }
  };

  const renderTop = () => {
    if (!top) return null;
    if (top.name === 'detail')             return <ShootDetail shoot={top.params.shoot} go={go} onBid={() => setSheet('bid')} />;
    if (top.name === 'profile')            return <Profile photographer={top.params.photographer} go={go} />;
    if (top.name === 'chat')               return <Chat conversation={top.params.conversation} go={go} />;
    if (top.name === 'client-review')      return <ClientReviewBids shoot={top.params.shoot} go={go} />;
    if (top.name === 'booking-confirmed')  return <BookingConfirmation bid={top.params.bid} shoot={top.params.shoot} go={go} />;
    return null;
  };

  // hide bottom nav on certain stack screens
  const hideBottomNav = top && (top.name === 'chat' || top.name === 'booking-confirmed' || tab === 'create');

  const onBidSubmit = ({ price }) => {
    setSheet(null);
    setToast(lang === 'de' ? `Angebot CHF ${price} gesendet.` : lang === 'fr' ? `Offre CHF ${price} envoyée.` : `Offer CHF ${price} sent.`);
    setTimeout(() => setToast(null), 2400);
  };

  return (
    <I18nProvider lang={lang}>
      <div className="device-shell flex flex-col">
        {tweaks.showStatusBar !== false && <StatusBarChrome lang={lang} />}

        <div className="screen-stack flex-1 flex flex-col">
          {/* base tab */}
          <div className="screen flex flex-col">
            {renderTab()}
            {!hideBottomNav && <BottomNav current={tab} onNav={onNav} role={role} />}
          </div>

          {/* stack top screen */}
          {top && (
            <div className="screen overlay flex flex-col" style={{ animation: 'screenIn 240ms ease-out both' }}>
              {renderTop()}
              {!hideBottomNav && top.name !== 'chat' && top.name !== 'booking-confirmed' && <BottomNav current={tab} onNav={onNav} role={role} />}
            </div>
          )}

          {/* Bid sheet (over detail) */}
          <BidSheet
            open={sheet === 'bid'}
            shoot={top?.params?.shoot}
            onClose={() => setSheet(null)}
            onSubmit={onBidSubmit}
          />

          {/* Toast */}
          {toast && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-24 z-[60] px-4 py-2.5 bg-ink text-paper text-[13px] tracking-tight2"
                 style={{ animation: 'toastIn 240ms ease both' }}>
              {toast}
            </div>
          )}
        </div>

        <HomeIndicator />
      </div>

      {/* Tweaks panel */}
      {window.TweaksPanel ? (
        <TweaksPanel>
          <TweakSection label="Theme">
            <TweakRadio
              label="Mode"
              value={tweaks.theme}
              onChange={(v) => setTweak('theme', v)}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark',  label: 'Dark' },
              ]}
            />
          </TweakSection>
          <TweakSection label="Role">
            <TweakRadio
              label="Active role"
              value={tweaks.role}
              onChange={(v) => setTweak('role', v)}
              options={[
                { value: 'client',       label: 'Client' },
                { value: 'photographer', label: 'Photog' },
              ]}
            />
            <p className="text-[11px] text-mute leading-[1.5] mt-2"
               style={{ fontFamily: "'Inter Tight', sans-serif" }}>
              Each role is a separate app. Clients post briefs; photographers respond.
            </p>
          </TweakSection>
          <TweakSection label="Language">
            <TweakRadio
              label="Interface"
              value={tweaks.lang}
              onChange={(v) => setTweak('lang', v)}
              options={[
                { value: 'de', label: 'DE' },
                { value: 'fr', label: 'FR' },
                { value: 'en', label: 'EN' },
              ]}
            />
          </TweakSection>
        </TweaksPanel>
      ) : null}
    </I18nProvider>
  );
};

// inject keyframes
const styleEl = document.createElement('style');
styleEl.textContent = `
  @keyframes screenIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes toastIn {
    from { transform: translate(-50%, 8px); opacity: 0; }
    to   { transform: translate(-50%, 0);   opacity: 1; }
  }
`;
document.head.appendChild(styleEl);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
