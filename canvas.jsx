// Atelier — design canvas root.
// Renders every screen as a static artboard. Sections split CLIENT vs PHOTOGRAPHER.

const noGo = () => {};

const StatusBarChrome = () => {
  const [now] = React.useState(() => new Date());
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return (
    <div className="statusbar tabular">
      <span>{hh}:{mm}</span>
      <span className="flex items-center gap-1.5">
        <svg width="18" height="11" viewBox="0 0 18 11" fill="currentColor">
          <rect x="0" y="7" width="3" height="4"/>
          <rect x="5" y="5" width="3" height="6"/>
          <rect x="10" y="2.5" width="3" height="8.5"/>
          <rect x="15" y="0" width="3" height="11"/>
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M1 4.2C2.8 2.5 5 1.5 7.5 1.5S12.2 2.5 14 4.2"/>
          <path d="M3.4 6.6C4.5 5.6 5.9 5 7.5 5s3 0.6 4.1 1.6"/>
          <circle cx="7.5" cy="9" r="1" fill="currentColor"/>
        </svg>
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
    <span style={{ width: 135, height: 5, borderRadius: 999, background: 'var(--ink)' }}></span>
  </div>
);

// A device-shell-shaped artboard. Renders one screen + optional bottom nav, status bar, home indicator.
const Frame = ({ children, nav = null, sheet = null }) => (
  <div className="frame flex flex-col">
    <StatusBarChrome />
    <div className="screen-stack flex-1 flex flex-col">
      <div className="screen flex flex-col">
        {children}
        {nav}
      </div>
      {sheet}
    </div>
    <HomeIndicator />
  </div>
);

// "OPEN PROTOTYPE →" CTA at top right of header
const PrototypeLink = () => (
  <a href="prototype.html"
     className="label inline-flex items-center gap-2 px-3 py-2 press"
     style={{ background: 'var(--ink)', color: 'var(--paper)', textDecoration: 'none' }}>
    OPEN LIVE PROTOTYPE
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></svg>
  </a>
);

// Bid sheet as static artboard — uses open=true and renders both backdrop + panel.
const BidSheetStatic = ({ shoot }) => {
  const { t } = useT();
  const price = "3'800";
  const max = 300;
  const message = "Ich kenne die Kapelle gut, habe dort 2023 schon einmal gearbeitet. Dokumentarisch, kein Blitz in der Zeremonie.";
  const date = "20.07.2026";
  return (
    <>
      <div className="sheet-backdrop" style={{ opacity: 1 }}></div>
      <div className="sheet-panel" style={{ transform: 'translateY(0)' }}>
        <div className="pt-3 pb-2 flex justify-center">
          <span className="w-9 h-1 bg-ink/25 rounded-full"></span>
        </div>
        <div className="px-5 pb-3 flex items-center justify-between">
          <span className="label">ANGEBOT</span>
          <span className="w-9 h-9 -mr-2 flex items-center justify-center">
            <IcClose size={20} />
          </span>
        </div>
        <div className="overflow-y-auto px-5" style={{ borderTop: '0.5px solid #D5D2C9' }}>
          <div className="pt-6">
            <label className="label text-ink">{t.your_price}</label>
            <div className="mt-3 flex items-baseline gap-3" style={{ borderBottom: '1px solid #0A0A0A' }}>
              <span className="text-[28px] font-medium tracking-display tabular pb-2">CHF</span>
              <span className="flex-1 text-[44px] font-medium tracking-display tabular pb-1 text-ink">{price}</span>
            </div>
            <p className="mt-2.5 text-[12.5px] text-mute tabular">
              {t.customer_budget("CHF 3'200", "CHF 4'500")}
            </p>
          </div>
          <div className="pt-7">
            <label className="label text-ink">{t.your_message}</label>
            <div className="mt-3 w-full text-[15px] leading-[1.55] p-3 text-ink"
                 style={{ border: '0.5px solid #D5D2C9', minHeight: 92 }}>
              {message}
            </div>
            <div className="mt-1.5 text-right label-sm tabular text-mute">
              {message.length} / {max}
            </div>
          </div>
          <div className="pt-5 pb-6">
            <label className="label text-ink">{t.available_from}</label>
            <div className="mt-3 flex items-center justify-between p-3.5" style={{ border: '0.5px solid #D5D2C9' }}>
              <span className="tabular text-[15px] text-ink">{date}</span>
              <IcCal size={18} className="text-mute" />
            </div>
          </div>
        </div>
        <div className="px-5 pt-3 pb-5 bg-paper" style={{ borderTop: '0.5px solid #D5D2C9' }}>
          <div className="mb-3 flex justify-center">
            <div className="label-sm tabular text-mute flex items-center gap-2 px-3 py-1.5"
                 style={{ border: '0.5px solid #D5D2C9' }}>
              <span className="text-ink">CHF {price}</span>
              <span>·</span>
              <span>{t.delivery_weeks(2)}</span>
            </div>
          </div>
          <div className="w-full h-12 flex items-center justify-center gap-2"
               style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
            <span className="text-[15px] tracking-tight2 font-medium">{t.send_offer}</span>
            <IcArrowRight size={16} />
          </div>
        </div>
      </div>
    </>
  );
};

// Static photographer's view of detail (with offer-CTA) — for canvas snapshot
const PhotographerBrowseDetail = ({ shoot, withSheet = false }) => (
  <Frame
    nav={null}
    sheet={withSheet ? <BidSheetStatic shoot={shoot} /> : null}
  >
    <ShootDetail shoot={shoot} go={noGo} onBid={noGo} />
  </Frame>
);

// "About" view of Profile with state pre-set
const ProfileFrame = ({ photographer }) => (
  <Frame>
    <Profile photographer={photographer} go={noGo} />
  </Frame>
);

// Tag prefix
const Tag = ({ kind }) => <span className={`ab-tag ${kind === 'photographer' ? 'photog' : ''}`}>{kind === 'photographer' ? 'PHOTOG' : 'CLIENT'}</span>;
const lbl = (kind, n, title) => `${String(n).padStart(2,'0')} · ${title}`;

// Bottom nav for Home — render with current tab='home'
const NavStub = ({ current = 'home' }) => <BottomNav current={current} onNav={noGo} />;

// === Main App ===

const App = () => {
  const [lang, setLang] = React.useState('de');
  const tw = useTweaks({ lang: 'de', theme: 'light' });
  // host language synced from tweaks
  React.useEffect(() => { setLang(tw[0].lang); }, [tw[0].lang]);
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', tw[0].theme || 'light');
  }, [tw[0].theme]);

  return (
    <I18nProvider lang={lang}>
      <div className="canvas-root">
        <header className="canvas-header">
          <div>
            <div className="canvas-title">Atelier <span className="text-accent">.</span></div>
            <div className="canvas-meta mt-1">Mobile prototype · 390 × 844 · iOS baseline</div>
          </div>
          <PrototypeLink />
        </header>

        <div style={{ flex: 1, minHeight: 0 }}>
          <DesignCanvas>
            {/* ============ AUTH ============ */}
            <DCSection
              id="auth"
              title="○ Onboarding"
              subtitle="Single account, explicit role selection at sign-up"
            >
              <DCArtboard id="a-role" label="01 · Pick a role" width={390} height={844}>
                <Frame>
                  <RolePicker go={noGo} />
                </Frame>
              </DCArtboard>
            </DCSection>

            {/* ============ CLIENT APP ============ */}
            <DCSection
              id="client"
              title="◇ Client app"
              subtitle="Marko posts a brief in Zermatt and chooses a photographer"
            >
              <DCArtboard id="c-home"   label="01 · Home"               width={390} height={844}>
                <Frame nav={<BottomNav current="home" onNav={noGo} role="client" />}>
                  <Home go={noGo} />
                </Frame>
              </DCArtboard>

              <DCArtboard id="c-myshoots" label="02 · My briefs"        width={390} height={844}>
                <Frame nav={<BottomNav current="jobs" onNav={noGo} role="client" />}>
                  <ClientMyShoots go={noGo} />
                </Frame>
              </DCArtboard>

              <DCArtboard id="c-step1"  label="03 · Create · Type"      width={390} height={844}>
                <Frame>
                  <CreateStepType />
                </Frame>
              </DCArtboard>

              <DCArtboard id="c-step2"  label="04 · Create · When & where" width={390} height={844}>
                <Frame>
                  <CreateStepWhenWhere />
                </Frame>
              </DCArtboard>

              <DCArtboard id="c-step3"  label="05 · Create · Budget & duration" width={390} height={844}>
                <Frame>
                  <CreateStepBudgetDuration />
                </Frame>
              </DCArtboard>

              <DCArtboard id="c-step4"  label="06 · Create · Briefing"  width={390} height={844}>
                <Frame>
                  <CreateStepBriefing />
                </Frame>
              </DCArtboard>

              <DCArtboard id="c-review" label="07 · Create · Review & publish" width={390} height={844}>
                <Frame>
                  <CreateReview go={noGo} />
                </Frame>
              </DCArtboard>

              <DCArtboard id="c-bids"   label="08 · Review incoming offers" width={390} height={844}>
                <Frame>
                  <ClientReviewBids shoot={CLIENT_SHOOTS[0]} go={noGo} />
                </Frame>
              </DCArtboard>

              <DCArtboard id="c-profile" label="09 · Photographer profile" width={390} height={844}>
                <Frame>
                  <Profile photographer={PHOTOGRAPHERS[0]} go={noGo} />
                </Frame>
              </DCArtboard>

              <DCArtboard id="c-booked" label="10 · Booking confirmed"  width={390} height={844}>
                <Frame>
                  <BookingConfirmation bid={BIDS[0]} shoot={CLIENT_SHOOTS[0]} go={noGo} />
                </Frame>
              </DCArtboard>

              <DCArtboard id="c-inbox"  label="11 · Messages"           width={390} height={844}>
                <Frame nav={<BottomNav current="inbox" onNav={noGo} role="client" />}>
                  <Inbox go={noGo} />
                </Frame>
              </DCArtboard>

              <DCArtboard id="c-chat"   label="12 · Chat"               width={390} height={844}>
                <Frame>
                  <Chat conversation={CONVERSATIONS[0]} go={noGo} />
                </Frame>
              </DCArtboard>

              <DCArtboard id="c-acct"   label="13 · Account"            width={390} height={844}>
                <Frame nav={<BottomNav current="profile" onNav={noGo} role="client" />}>
                  <ClientProfile go={noGo} />
                </Frame>
              </DCArtboard>
            </DCSection>

            {/* ============ PHOTOGRAPHER APP ============ */}
            <DCSection
              id="photographer"
              title="◆ Photographer app"
              subtitle="Nora discovers open briefs, manages offers and bookings"
            >
              <DCArtboard id="p-home"   label="01 · Home"               width={390} height={844}>
                <Frame nav={<BottomNav current="home" onNav={noGo} role="photographer" />}>
                  <PhotogHome go={noGo} />
                </Frame>
              </DCArtboard>

              <DCArtboard id="p-browse" label="02 · Browse open briefs" width={390} height={844}>
                <Frame nav={<BottomNav current="browse" onNav={noGo} role="photographer" />}>
                  <Browse go={noGo} />
                </Frame>
              </DCArtboard>

              <DCArtboard id="p-detail" label="03 · Brief detail"       width={390} height={844}>
                <Frame>
                  <ShootDetail shoot={SHOOTS[0]} go={noGo} onBid={noGo} />
                </Frame>
              </DCArtboard>

              <DCArtboard id="p-bid"    label="04 · Submit offer"       width={390} height={844}>
                <Frame sheet={<BidSheetStatic shoot={SHOOTS[0]} />}>
                  <ShootDetail shoot={SHOOTS[0]} go={noGo} onBid={noGo} />
                </Frame>
              </DCArtboard>

              <DCArtboard id="p-mybids" label="05 · My offers"          width={390} height={844}>
                <Frame nav={<BottomNav current="bids" onNav={noGo} role="photographer" />}>
                  <PhotogMyBids go={noGo} />
                </Frame>
              </DCArtboard>

              <DCArtboard id="p-profile" label="06 · My profile (edit)" width={390} height={844}>
                <Frame nav={<BottomNav current="profile" onNav={noGo} role="photographer" />}>
                  <PhotogProfileEdit go={noGo} />
                </Frame>
              </DCArtboard>

              <DCArtboard id="p-inbox"  label="07 · Messages"           width={390} height={844}>
                <Frame nav={<BottomNav current="inbox" onNav={noGo} role="photographer" />}>
                  <Inbox go={noGo} />
                </Frame>
              </DCArtboard>

              <DCArtboard id="p-chat"   label="08 · Chat"               width={390} height={844}>
                <Frame>
                  <Chat conversation={CONVERSATIONS[0]} go={noGo} />
                </Frame>
              </DCArtboard>

              <DCArtboard id="p-earn"   label="09 · Bookings & earnings" width={390} height={844}>
                <Frame nav={<BottomNav current="bids" onNav={noGo} role="photographer" />}>
                  <PhotogEarnings go={noGo} />
                </Frame>
              </DCArtboard>
            </DCSection>
          </DesignCanvas>
        </div>

        {/* Tweaks panel */}
        {window.TweaksPanel ? (
          <TweaksPanel>
            <TweakSection label="Theme">
              <TweakRadio
                label="Mode"
                value={tw[0].theme}
                onChange={(v) => tw[1]('theme', v)}
                options={[
                  { value: 'light', label: 'Light' },
                  { value: 'dark',  label: 'Dark' },
                ]}
              />
            </TweakSection>
            <TweakSection label="Language">
              <TweakRadio
                label="Interface"
                value={tw[0].lang}
                onChange={(v) => tw[1]('lang', v)}
                options={[
                  { value: 'de', label: 'DE' },
                  { value: 'fr', label: 'FR' },
                  { value: 'en', label: 'EN' },
                ]}
              />
              <p className="text-[11px] text-mute leading-[1.5] mt-2">
                Swiss German primary. Switch to update every artboard.
              </p>
            </TweakSection>
          </TweaksPanel>
        ) : null}
      </div>
    </I18nProvider>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
