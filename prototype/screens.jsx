// ---------- Primitives ----------

const { useState, useEffect, useRef, useMemo } = React;

const SectionHeader = ({ num, title, action }) => (
  <div className="flex items-end gap-3 px-5 pt-8 pb-4">
    <div className="flex items-baseline gap-2.5 shrink-0">
      <span className="label tabular text-ink">{String(num).padStart(2, '0')}</span>
      <span className="text-mute label">—</span>
      <h2 className="text-[15px] font-medium tracking-tight2 text-ink leading-none">{title}</h2>
    </div>
    <div className="flex-1 h-px bg-ink/15 mb-[3px]"></div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);

const StatusPill = ({ children, tone = 'default' }) => {
  const cls =
    tone === 'accent' ? 'bg-accent text-paper'
    : tone === 'invert' ? 'bg-ink text-paper'
    : 'bg-transparent text-ink border border-ink/30';
  return (
    <span className={`label inline-flex items-center px-2.5 py-1 ${cls}`} style={{ fontSize: 9.5 }}>
      {children}
    </span>
  );
};

const Rating = ({ value, count, className = '' }) => (
  <span className={`inline-flex items-center gap-1 ${className}`}>
    <IcStarSolid size={11} className="text-ink" />
    <span className="tabular text-[12.5px] font-medium tracking-tight2">{value.toFixed(1)}</span>
    {count != null && <span className="tabular text-[12px] text-mute">({count})</span>}
  </span>
);

const SpecRow = ({ label, value, last = false }) => (
  <div className="flex items-baseline justify-between gap-4 py-3.5"
       style={{ borderBottom: last ? 'none' : '0.5px solid #D5D2C9' }}>
    <span className="label text-mute whitespace-nowrap">{label}</span>
    <span className="tabular text-[14.5px] tracking-tight2 text-ink text-right whitespace-nowrap">{value}</span>
  </div>
);

// ---------- Top Bar ----------

const TopBar = ({ left, right, title, sticky = true }) => (
  <div className={`${sticky ? 'sticky top-0 z-30' : ''} bg-paper`}>
    <div className="px-5 h-14 flex items-center justify-between"
         style={{ borderBottom: '0.5px solid #E5E2DB' }}>
      <div className="flex items-center gap-3 min-w-0">{left}</div>
      {title ? <div className="absolute left-1/2 -translate-x-1/2 text-[14px] font-medium tracking-tight2">{title}</div> : null}
      <div className="flex items-center gap-3">{right}</div>
    </div>
  </div>
);

const Wordmark = () => (
  <span className="text-[17px] font-medium tracking-display text-ink leading-none">
    Atelier<span className="text-accent">.</span>
  </span>
);

const Avatar = ({ src, size = 32, ring = false }) => (
  <span
    className="inline-block overflow-hidden bg-chip"
    style={{
      width: size, height: size,
      borderRadius: '50%',
      boxShadow: ring ? '0 0 0 1px #0A0A0A' : 'none',
    }}
  >
    <img src={src} alt="" className="w-full h-full object-cover img-gray" loading="lazy" />
  </span>
);

const NotifyButton = ({ dot = true, onClick }) => (
  <button onClick={onClick} className="relative w-9 h-9 -mr-1 flex items-center justify-center press" aria-label="Notifications">
    <IcBell size={20} className="text-ink" />
    {dot && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent"></span>}
  </button>
);

// ---------- Bottom Nav ----------

const NAV_CLIENT = [
  { id: 'home',    icon: IcHome,   key: 'nav_home' },
  { id: 'jobs',    icon: IcList,   key: 'nav_jobs' },
  { id: 'create',  icon: IcPlus,   key: 'nav_create' },
  { id: 'inbox',   icon: IcMail,   key: 'nav_inbox', badge: 2 },
  { id: 'profile', icon: IcUser,   key: 'nav_profile' },
];

const NAV_PHOTOG = [
  { id: 'home',    icon: IcHome,      key: 'nav_home' },
  { id: 'browse',  icon: IcSearch,    key: 'nav_search' },
  { id: 'bids',    icon: IcBriefcase, key: 'nav_bids' },
  { id: 'inbox',   icon: IcMail,      key: 'nav_inbox', badge: 1 },
  { id: 'profile', icon: IcUser,      key: 'nav_profile' },
];

const BottomNav = ({ current, onNav, role = 'client' }) => {
  const { t } = useT();
  const items = role === 'photographer' ? NAV_PHOTOG : NAV_CLIENT;
  return (
    <nav className="shrink-0 bg-paper relative" style={{ borderTop: '0.5px solid #D5D2C9' }}>
      <div className="grid grid-cols-5 h-[68px] pb-1">
        {items.map((item) => {
          const active = current === item.id;
          const Icon = item.icon;
          const isCreate = item.id === 'create';
          return (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              className="relative flex flex-col items-center justify-center gap-1 press"
              aria-label={t[item.key]}
            >
              <div className="relative">
                {isCreate ? (
                  <span className={`w-9 h-9 flex items-center justify-center ${active ? 'bg-accent text-paper' : 'bg-ink text-paper'}`}>
                    <Icon size={18} stroke={1.75} />
                  </span>
                ) : (
                  <Icon size={20} stroke={1.5} className={active ? 'text-ink' : 'text-mute'} />
                )}
                {item.badge ? (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] tabular text-[9.5px] flex items-center justify-center bg-accent text-paper px-1"
                        style={{ fontWeight: 600 }}>
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <span className={`text-[10px] tracking-tight2 ${active ? 'text-ink' : 'text-mute'}`}
                    style={{ fontWeight: active ? 500 : 400 }}>
                {t[item.key]}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

// ---------- Home (client view) ----------

const Home = ({ go }) => {
  const { t, lang } = useT();
  // localized fields helper
  const lf = (obj, key) => obj[`${key}_${lang}`] || obj[key];

  const activeShoots = SHOOTS.slice(0, 2);
  const recommended  = PHOTOGRAPHERS.slice(0, 4);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar
        left={<Wordmark />}
        right={
          <>
            <NotifyButton />
            <button onClick={() => go('profile')} className="press">
              <Avatar src={PHOTOGRAPHERS[2].avatar} size={30} ring />
            </button>
          </>
        }
      />

      <div className="scroll-area overflow-y-auto flex-1">

        {/* Greeting */}
        <header className="px-5 pt-8 pb-2">
          <h1 className="text-[44px] leading-[1.02] tracking-display font-medium text-ink">
            {t.hello_day}
          </h1>
          <p className="mt-4 text-[15px] leading-[1.5] text-mute max-w-[300px]">
            {t.greeting_sub}
          </p>
        </header>

        {/* Primary action card */}
        <div className="px-5 pt-5">
          <button
            onClick={() => go('create')}
            className="w-full text-left bg-ink text-paper p-5 press relative overflow-hidden"
          >
            <span className="label-sm text-paper/55 block">01 / 05 — BRIEF</span>
            <div className="mt-10 flex items-end justify-between gap-3">
              <h3 className="text-[28px] leading-[1.04] tracking-display font-medium max-w-[230px]">
                {t.new_job_title}
              </h3>
              <span className="w-10 h-10 shrink-0 flex items-center justify-center -mr-1 -mb-1">
                <IcArrowRight size={22} stroke={1.5} />
              </span>
            </div>
            <p className="mt-3 text-[12.5px] text-paper/70 leading-[1.45] max-w-[280px]">
              {t.new_job_desc}
            </p>
          </button>
        </div>

        {/* Section 01 — your jobs */}
        <SectionHeader num={1} title={t.sec_your_jobs} />

        <div className="px-5 flex flex-col" style={{ gap: '0.5px', background: 'var(--line-strong)' }}>
          {activeShoots.map((s) => (
            <button
              key={s.id}
              onClick={() => go('detail', { shoot: s })}
              className="bg-paper press text-left p-4 flex items-center gap-4"
            >
              <span className="w-[68px] h-[68px] overflow-hidden shrink-0 bg-chip">
                <img src={s.image} className="w-full h-full object-cover img-gray" alt=""/>
              </span>
              <div className="flex-1 min-w-0">
                <div className="label-sm text-mute">{s.location.toUpperCase()} · {s.date}</div>
                <div className="mt-1 text-[15.5px] tracking-tight2 leading-[1.2] text-ink truncate font-medium">
                  {lf(s, 'title')}
                </div>
                <div className="mt-2">
                  <StatusPill>{t.offers_n(s.offers)}</StatusPill>
                </div>
              </div>
              <IcChevronRight size={18} className="text-mute shrink-0" />
            </button>
          ))}
        </div>

        {/* Section 02 — recommended */}
        <SectionHeader num={2} title={t.sec_recommend} />

        <div className="px-5 flex flex-col">
          {recommended.map((p, i) => (
            <button
              key={p.id}
              onClick={() => go('profile', { photographer: p })}
              className="press text-left py-3.5 flex items-center gap-4"
              style={{ borderBottom: i < recommended.length - 1 ? '0.5px solid #D5D2C9' : 'none' }}
            >
              <span className="w-16 h-16 shrink-0 overflow-hidden bg-chip">
                <img src={p.avatar} className="w-full h-full object-cover img-gray" alt=""/>
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[15.5px] tracking-tight2 font-medium text-ink">{p.name}</div>
                <div className="text-[13px] text-mute leading-[1.35] mt-0.5">
                  {p.city} · {p.specialty}
                </div>
              </div>
              <div className="text-right">
                <Rating value={p.rating} />
                <div className="label-sm text-mute mt-1 tabular">{String(p.reviews).padStart(2,'0')}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="h-12"></div>
      </div>
    </div>
  );
};

// ---------- Browse / Suchen ----------

const CHIPS = (t) => [
  ['all', t.chip_all],
  ['wedding', t.chip_wedding],
  ['event', t.chip_event],
  ['portrait', t.chip_portrait],
  ['commercial', t.chip_commercial],
  ['week', t.chip_week],
];

const Browse = ({ go }) => {
  const { t, lang } = useT();
  const [chip, setChip] = useState('all');
  const lf = (obj, key) => obj[`${key}_${lang}`] || obj[key];

  // simple chip filter
  const filtered = useMemo(() => {
    if (chip === 'all') return SHOOTS;
    if (chip === 'week') return SHOOTS.slice(0, 3);
    const map = { wedding: 'Hochzeit', event: 'Event', portrait: 'Porträt', commercial: 'Commercial' };
    const want = map[chip];
    return SHOOTS.filter((s) => s.type === want);
  }, [chip]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar
        left={<Wordmark />}
        right={<NotifyButton />}
      />

      <div className="scroll-area overflow-y-auto flex-1">
        {/* Title */}
        <div className="px-5 pt-8">
          <h1 className="text-[40px] leading-[1.02] tracking-display font-medium text-ink">
            {t.browse_title}
          </h1>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="tabular text-mute text-[13.5px]">{t.browse_count(SHOOTS.length)}</span>
            <span className="flex-1 h-px bg-ink/15"></span>
          </div>
        </div>

        {/* Sticky filters */}
        <div className="sticky top-0 bg-paper pt-4 pb-3 z-20" style={{ borderBottom: '0.5px solid #E5E2DB' }}>
          <div className="flex items-center gap-3 px-5">
            <div className="chip-row flex gap-2 overflow-x-auto flex-1">
              {CHIPS(t).map(([id, label]) => {
                const active = chip === id;
                return (
                  <button
                    key={id}
                    onClick={() => setChip(id)}
                    className={`shrink-0 h-9 px-3.5 label-sm press transition-colors`}
                    style={{
                      background: active ? 'var(--ink)' : 'transparent',
                      color: active ? 'var(--paper)' : 'var(--ink)',
                      border: active ? '0.5px solid #0A0A0A' : '0.5px solid #D5D2C9',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <button
              className="shrink-0 h-9 w-9 flex items-center justify-center press"
              style={{ border: '0.5px solid #D5D2C9' }}
              aria-label={t.filter}
            >
              <IcSliders size={16} />
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="px-5 pt-6 pb-10 flex flex-col gap-6">
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => go('detail', { shoot: s })}
              className="text-left press"
            >
              <div className="bg-chip overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <img src={s.image} className="w-full h-full object-cover" alt="" />
              </div>
              <div className="pt-3.5">
                <div className="label-sm text-mute tabular">
                  {s.location.toUpperCase()} · {s.date} · {t.duration_h(s.duration)}
                </div>
                <h3 className="mt-2 text-[19px] leading-[1.18] tracking-tight2 font-medium text-ink"
                    style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {lf(s, 'title')}
                </h3>
                <div className="mt-2 tabular text-[15px] text-ink">
                  {CHFRange(s.budgetLo, s.budgetHi)}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="label-sm text-ink tabular whitespace-nowrap">{t.offers_n(s.offers)}</span>
                  <span className="label-sm text-mute tabular whitespace-nowrap">{t.posted_ago(lf(s,'posted') || s.posted)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------- Shoot Detail ----------

const ShootDetail = ({ shoot, go, onBid }) => {
  const { t, lang } = useT();
  const lf = (obj, key) => obj[`${key}_${lang}`] || obj[key];
  const [saved, setSaved] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);
  const bids = useMemo(() => {
    const arr = [...BIDS];
    arr.sort((a,b) => sortAsc ? a.price - b.price : b.price - a.price);
    return arr;
  }, [sortAsc]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <TopBar
        left={
          <button onClick={() => go('back')} className="w-9 h-9 -ml-2 flex items-center justify-center press">
            <IcChevronLeft size={22} />
          </button>
        }
        right={
          <button onClick={() => setSaved(!saved)} className="w-9 h-9 -mr-2 flex items-center justify-center press">
            <IcBookmark size={20} className={saved ? 'text-accent' : ''} />
          </button>
        }
      />

      <div className="scroll-area overflow-y-auto flex-1 pb-32">
        {/* Hero */}
        <div className="bg-chip w-full" style={{ aspectRatio: '4/3' }}>
          <img src={shoot.image} className="w-full h-full object-cover" alt="" />
        </div>

        <div className="px-5">
          <div className="mt-5">
            <StatusPill>{t.open_to_offers(shoot.offers)}</StatusPill>
          </div>
          <h1 className="mt-4 text-[34px] leading-[1.05] tracking-display font-medium text-ink">
            {lf(shoot, 'title')}
          </h1>

          {/* Spec table */}
          <div className="mt-6" style={{ borderTop: '0.5px solid #D5D2C9' }}>
            <SpecRow label={t.spec_date} value={shoot.date} />
            <SpecRow label={t.spec_loc}  value={`${shoot.location}, ${shoot.postcode}`} />
            <SpecRow label={t.spec_dur}  value={`${shoot.duration} ${t.hours}`} />
            <SpecRow label={t.spec_budget} value={CHFRange(shoot.budgetLo, shoot.budgetHi)} />
            <SpecRow label={t.spec_type} value={lf(shoot, 'type')} last />
          </div>

          {/* Brief */}
          <div className="mt-8">
            <h3 className="label text-ink">{t.sec_brief}</h3>
            <p className="mt-3 text-[15px] leading-[1.55] text-ink/85">{lf(shoot, 'brief')}</p>
          </div>

          {/* Client */}
          <div className="mt-8 pt-5 pb-5 flex items-center gap-3" style={{ borderTop: '0.5px solid #D5D2C9', borderBottom: '0.5px solid #D5D2C9' }}>
            <div className="flex-1">
              <div className="label text-mute">{t.sec_client}</div>
              <div className="text-[15.5px] mt-1.5 font-medium tracking-tight2">{shoot.client.name}</div>
              <div className="text-[12.5px] text-mute mt-0.5 tabular">{t.member_since(shoot.client.since)}</div>
            </div>
            <Avatar src={PHOTOGRAPHERS[0].avatar} size={44} />
          </div>
        </div>

        {/* Section 03 — Offers */}
        <SectionHeader
          num={3}
          title={t.sec_offers}
          action={
            <button onClick={() => setSortAsc(!sortAsc)} className="label-sm flex items-center gap-1 press text-ink">
              CHF {sortAsc ? <IcChevronUp size={12}/> : <IcChevronDown size={12}/> }
            </button>
          }
        />

        <div className="px-5 flex flex-col gap-3">
          {bids.map((b) => (
            <div key={b.id} className="bg-surface p-4" style={{ border: '0.5px solid #D5D2C9' }}>
              <div className="flex items-start gap-3">
                <Avatar src={b.photographer.avatar} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="text-[14.5px] tracking-tight2 font-medium">{b.photographer.name}</div>
                  <div className="text-[12px] text-mute mt-0.5">{b.photographer.city}, {b.photographer.postcode}</div>
                </div>
                <div className="text-right">
                  <div className="tabular text-[20px] font-medium tracking-tight2 leading-none">{CHF(b.price)}</div>
                  <div className="label-sm text-mute mt-1.5">{t.delivery_weeks(b.delivery)}</div>
                </div>
              </div>
              <p className="mt-3 text-[14px] leading-[1.5] text-ink/80"
                 style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {b[`message_${lang}`] || b.message_de}
              </p>
              <div className="mt-3 flex items-center justify-between" style={{ borderTop: '0.5px solid #E5E2DB', paddingTop: 10 }}>
                <Rating value={b.photographer.rating} count={b.photographer.reviews} />
                <button onClick={() => go('profile', { photographer: b.photographer })}
                        className="label-sm flex items-center gap-1 press text-ink">
                  {t.view_profile} <IcArrowRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="h-12"></div>
      </div>

      {/* Sticky CTA */}
      <div className="absolute left-0 right-0 bottom-0 bg-paper px-5 pt-3 pb-4 z-30"
           style={{ borderTop: '0.5px solid #D5D2C9' }}>
        <button onClick={onBid}
          className="w-full bg-ink text-paper h-12 flex items-center justify-center gap-2 press">
          <span className="text-[15px] tracking-tight2 font-medium">{t.submit_offer}</span>
          <IcArrowRight size={16} />
        </button>
        <p className="mt-2 text-center label-sm tabular text-mute">
          {t.budget_hint(CHF(shoot.budgetLo), CHF(shoot.budgetHi))}
        </p>
      </div>
    </div>
  );
};

// ---------- Submit Bid sheet ----------

const BidSheet = ({ open, onClose, shoot, onSubmit }) => {
  const { t } = useT();
  const [price, setPrice]   = useState('');
  const [message, setMessage] = useState('');
  const [date, setDate]     = useState('20.07.2026');

  useEffect(() => {
    if (open) {
      setPrice(''); setMessage(''); setDate('20.07.2026');
    }
  }, [open]);

  if (!shoot) return null;
  const max = 300;
  const valid = price && Number(price.replace(/\D/g,'')) > 0 && message.length > 5;

  const onPriceChange = (e) => {
    const raw = e.target.value.replace(/[^\d]/g, '');
    if (!raw) { setPrice(''); return; }
    setPrice(chf(Number(raw)));
  };

  return (
    <>
      <div className={`sheet-backdrop ${open ? 'open' : ''}`} onClick={onClose}></div>
      <div className={`sheet-panel ${open ? 'open' : ''}`}>
        <div className="pt-3 pb-2 flex justify-center">
          <span className="w-9 h-1 bg-ink/25 rounded-full"></span>
        </div>
        <div className="px-5 pb-3 flex items-center justify-between">
          <span className="label">ANGEBOT</span>
          <button onClick={onClose} className="w-9 h-9 -mr-2 flex items-center justify-center press">
            <IcClose size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-5" style={{ borderTop: '0.5px solid #D5D2C9' }}>
          {/* Price */}
          <div className="pt-6">
            <label className="label text-ink">{t.your_price}</label>
            <div className="mt-3 flex items-baseline gap-3" style={{ borderBottom: '1px solid #0A0A0A' }}>
              <span className="text-[28px] font-medium tracking-display tabular pb-2">CHF</span>
              <input
                inputMode="numeric"
                value={price}
                onChange={onPriceChange}
                placeholder="0"
                className="flex-1 text-[44px] font-medium tracking-display tabular bg-transparent outline-none pb-1 text-ink placeholder:text-ink/20"
              />
            </div>
            <p className="mt-2.5 text-[12.5px] text-mute tabular">
              {t.customer_budget(CHF(shoot.budgetLo), CHF(shoot.budgetHi))}
            </p>
          </div>

          {/* Message */}
          <div className="pt-7">
            <label className="label text-ink">{t.your_message}</label>
            <textarea
              value={message}
              maxLength={max}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.message_placeholder}
              className="mt-3 w-full bg-transparent outline-none text-[15px] leading-[1.55] resize-none p-3 text-ink placeholder:text-mute"
              rows={4}
              style={{ border: '0.5px solid #D5D2C9' }}
            />
            <div className="mt-1.5 text-right label-sm tabular text-mute">
              {t.char_count(message.length, max)}
            </div>
          </div>

          {/* Date */}
          <div className="pt-5 pb-6">
            <label className="label text-ink">{t.available_from}</label>
            <div className="mt-3 flex items-center justify-between p-3.5" style={{ border: '0.5px solid #D5D2C9' }}>
              <span className="tabular text-[15px] text-ink">{date}</span>
              <IcCal size={18} className="text-mute" />
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="px-5 pt-3 pb-5 bg-paper" style={{ borderTop: '0.5px solid #D5D2C9' }}>
          <div className="mb-3 flex justify-center">
            <div className="label-sm tabular text-mute flex items-center gap-2 px-3 py-1.5"
                 style={{ border: '0.5px solid #D5D2C9' }}>
              <span className="text-ink">CHF {price || '—'}</span>
              <span>·</span>
              <span>{t.delivery_weeks(2)}</span>
            </div>
          </div>
          <button
            disabled={!valid}
            onClick={() => onSubmit({ price, message, date })}
            className="w-full h-12 press flex items-center justify-center gap-2 transition-opacity"
            style={{
              background: 'var(--ink)',
              color: 'var(--paper)',
              opacity: valid ? 1 : 0.35,
            }}
          >
            <span className="text-[15px] tracking-tight2 font-medium">{t.send_offer}</span>
            <IcArrowRight size={16} />
          </button>
        </div>
      </div>
    </>
  );
};

// ---------- Photographer Profile ----------

const Profile = ({ photographer, go }) => {
  const { t, lang } = useT();
  const p = photographer || PHOTOGRAPHERS[0];
  const [tab, setTab] = useState('about');
  const bio = p[`bio_${lang}`] || p.bio_de;
  const gear = p[`gear_${lang}`] || p.gear;

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <TopBar
        left={
          <button onClick={() => go('back')} className="w-9 h-9 -ml-2 flex items-center justify-center press">
            <IcChevronLeft size={22} />
          </button>
        }
        right={
          <button className="w-9 h-9 -mr-2 flex items-center justify-center press">
            <IcShare size={18} />
          </button>
        }
      />

      <div className="scroll-area overflow-y-auto flex-1 pb-28">
        {/* Hero */}
        <div className="bg-chip w-full" style={{ aspectRatio: '4/5' }}>
          <img src={p.hero} className="w-full h-full object-cover" alt="" />
        </div>

        <div className="px-5">
          <h1 className="mt-6 text-[36px] leading-[1.02] tracking-display font-medium text-ink">{p.name}</h1>

          <div className="mt-3 flex items-center gap-3 flex-wrap text-[13px] text-mute tabular">
            <span>{p.city}, {p.postcode}</span>
            <span className="text-line">·</span>
            <Rating value={p.rating} count={p.reviews} className="text-ink" />
          </div>

          <p className="mt-2 text-[13px] text-mute">{t.responds_in(p.responds)}</p>

          <div className="mt-4">
            {p.status === 'available'
              ? <StatusPill tone="invert">{t.available.toUpperCase()}</StatusPill>
              : <StatusPill>{t.booked_until(p.bookedUntil).toUpperCase()}</StatusPill>}
          </div>

          {/* Tabs */}
          <div className="mt-7 flex items-end gap-6" style={{ borderBottom: '0.5px solid #D5D2C9' }}>
            {[['about', t.tab_about], ['portfolio', t.tab_portfolio], ['reviews', t.tab_reviews]].map(([id, label]) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`relative pb-3 text-[13px] tracking-tight2 press ${active ? 'text-ink font-medium tab-active' : 'text-mute'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          {tab === 'about' && (
            <div className="pt-5">
              <p className="text-[15px] leading-[1.6] text-ink/85">{bio}</p>

              <div className="mt-7" style={{ borderTop: '0.5px solid #D5D2C9' }}>
                <SpecRow label={t.spec_specialization} value={p.specialty} />
                <SpecRow label={t.spec_gear} value={gear} />
                <SpecRow label={t.spec_langs} value={p.languages} />
                <SpecRow label={t.spec_from} value={`${CHF(p.fromPrice)} (${t.half_day})`} last />
              </div>
            </div>
          )}

          {tab === 'portfolio' && (
            <div className="pt-5">
              <div className="grid grid-cols-2 gap-1.5">
                {(p.portfolio.length ? p.portfolio : PHOTOGRAPHERS[0].portfolio).map((src, i) => (
                  <div key={i} className="bg-chip" style={{ aspectRatio: '3/4' }}>
                    <img src={src} className="w-full h-full object-cover" alt="" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'reviews' && (
            <div className="pt-5 space-y-5">
              {[
                { name: 'Anja R.', date: '12.03.2026', rating: 5, text_de: 'Sehr professionell, präzise und ruhig am Set. Lieferung pünktlich.', text_fr: 'Très professionnelle, précise et calme. Livraison à temps.', text_en: 'Very professional, precise and calm on set. On-time delivery.' },
                { name: 'Reto S.',  date: '04.02.2026', rating: 5, text_de: 'Hat den Brief perfekt umgesetzt. Empfehlung.', text_fr: 'Brief parfaitement exécuté. Recommandée.', text_en: 'Executed the brief perfectly. Recommended.' },
                { name: 'Camille D.', date: '21.01.2026', rating: 4, text_de: 'Schöne Bilder, kommunikativ. Etwas spätere Lieferung als geplant.', text_fr: 'Belles images, bonne communication. Livraison légèrement en retard.', text_en: 'Beautiful images, good communication. Slightly late delivery.' },
              ].map((r, i) => (
                <div key={i} style={{ borderBottom: '0.5px solid #D5D2C9', paddingBottom: 18 }}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[14.5px] font-medium tracking-tight2">{r.name}</span>
                    <span className="tabular text-[12px] text-mute">{r.date}</span>
                  </div>
                  <div className="mt-1.5 flex gap-0.5">
                    {Array.from({length:5}).map((_,j)=> (
                      <IcStarSolid key={j} size={11} className={j < r.rating ? 'text-ink' : 'text-line'} />
                    ))}
                  </div>
                  <p className="mt-2.5 text-[14px] leading-[1.55] text-ink/80">{r[`text_${lang}`] || r.text_de}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="absolute left-0 right-0 bottom-0 px-5 pt-3 pb-5 bg-paper" style={{ borderTop: '0.5px solid #D5D2C9' }}>
        <button className="w-full bg-ink text-paper h-12 flex items-center justify-center gap-2 press">
          <span className="text-[15px] tracking-tight2 font-medium">{t.send_request}</span>
          <IcArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

// ---------- Create Shoot multi-step ----------

const CREATE_TOTAL = 5;
const CREATE_QS = {
  de: [
    { q: 'Welche Art von Shoot ist es?', opts: [
        ['Hochzeit',   'Trauung, Apéro, Dinner. Meist 6–10 Stunden.'],
        ['Porträt',    'Einzeln oder Team. Studio oder vor Ort.'],
        ['Event',      'Firmenanlass, Konferenz, Vernissage.'],
        ['Commercial', 'Produkt, Kampagne, Editorial.'],
        ['Architektur','Aussen und Innen.'],
      ] },
    { q: 'Wann findet er statt?', opts: [['Diese Woche'], ['Im nächsten Monat'], ['In 2–3 Monaten'], ['Noch flexibel']] },
    { q: 'Wo findet er statt?', opts: [['Zürich'], ['Bern'], ['Basel'], ['Genf / Lausanne'], ['Anderswo in der Schweiz']] },
    { q: 'Welches Budget hast du im Kopf?', opts: [
        ['CHF 1\'000 – 2\'500'], ['CHF 2\'500 – 5\'000'],
        ['CHF 5\'000 – 10\'000'], ['Über CHF 10\'000'], ['Bin offen für Vorschläge'],
      ] },
    { q: 'Wie sollen wir dich erreichen?', opts: [['Nur per Nachricht'], ['Anruf erwünscht'], ['E-Mail bevorzugt']] },
  ],
  fr: [
    { q: 'Quel type de shoot ?', opts: [
        ['Mariage', 'Cérémonie, apéro, dîner. 6–10 heures en général.'],
        ['Portrait', 'Individuel ou équipe. Studio ou sur site.'],
        ['Événement', 'Événement d\u2019entreprise, conférence, vernissage.'],
        ['Commercial', 'Produit, campagne, éditorial.'],
        ['Architecture', 'Extérieur et intérieur.'],
      ] },
    { q: 'Quand ?', opts: [['Cette semaine'], ['Le mois prochain'], ['Dans 2–3 mois'], ['Flexible']] },
    { q: 'Où ?', opts: [['Zurich'], ['Berne'], ['Bâle'], ['Genève / Lausanne'], ['Ailleurs en Suisse']] },
    { q: 'Quel budget envisages-tu ?', opts: [
        ['CHF 1\'000 – 2\'500'], ['CHF 2\'500 – 5\'000'],
        ['CHF 5\'000 – 10\'000'], ['Plus de CHF 10\'000'], ['Ouvert aux propositions'],
      ] },
    { q: 'Comment te joindre ?', opts: [['Message uniquement'], ['Appel souhaité'], ['Email préféré']] },
  ],
  en: [
    { q: 'What kind of shoot?', opts: [
        ['Wedding', 'Ceremony, apéro, dinner. Usually 6–10 hours.'],
        ['Portrait', 'Solo or team. Studio or on location.'],
        ['Event', 'Corporate event, conference, opening.'],
        ['Commercial', 'Product, campaign, editorial.'],
        ['Architecture', 'Exterior and interior.'],
      ] },
    { q: 'When?', opts: [['This week'], ['Next month'], ['In 2–3 months'], ['Flexible']] },
    { q: 'Where?', opts: [['Zürich'], ['Bern'], ['Basel'], ['Geneva / Lausanne'], ['Elsewhere in Switzerland']] },
    { q: 'What budget?', opts: [
        ['CHF 1\'000 – 2\'500'], ['CHF 2\'500 – 5\'000'],
        ['CHF 5\'000 – 10\'000'], ['Above CHF 10\'000'], ['Open to suggestions'],
      ] },
    { q: 'How should we reach you?', opts: [['Message only'], ['Call welcome'], ['Email preferred']] },
  ],
};

const CreateFlow = ({ go, initialStep = 0, staticMode = false }) => {
  const { t, lang } = useT();
  const [step, setStep] = useState(initialStep);
  const [answers, setAnswers] = useState(staticMode ? { 0: 0, 1: 1, 2: 0, 3: 1, 4: 0 } : {});

  const qs = CREATE_QS[lang] || CREATE_QS.de;
  const current = qs[step];
  const selected = answers[step];

  const next = () => {
    if (step < CREATE_TOTAL - 1) setStep(step + 1);
    else go('home');
  };
  const back = () => {
    if (step === 0) go('home');
    else setStep(step - 1);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      {/* Custom top: step + close */}
      <div className="sticky top-0 z-30 bg-paper">
        <div className="px-5 h-14 flex items-center justify-between" style={{ borderBottom: '0.5px solid #E5E2DB' }}>
          <span className="label tabular">{t.step_of(step + 1, CREATE_TOTAL)}</span>
          <div className="flex-1 mx-4 flex gap-1">
            {Array.from({length: CREATE_TOTAL}).map((_,i) => (
              <div key={i} className="flex-1 h-px"
                   style={{ background: i <= step ? 'var(--ink)' : 'var(--line-strong)' }}></div>
            ))}
          </div>
          <button onClick={() => go('home')} className="w-9 h-9 -mr-2 flex items-center justify-center press">
            <IcClose size={20} />
          </button>
        </div>
      </div>

      <div className="scroll-area overflow-y-auto flex-1">
        <div className="px-5 pt-10">
          <h1 className="text-[32px] leading-[1.06] tracking-display font-medium text-ink max-w-[320px]">
            {current.q}
          </h1>
        </div>

        <div className="px-5 pt-8 pb-32 flex flex-col gap-2.5">
          {current.opts.map(([label, desc], i) => {
            const isSel = selected === i;
            return (
              <button
                key={i}
                onClick={() => setAnswers({ ...answers, [step]: i })}
                className={`text-left p-4 relative press ${isSel ? 'opt-selected' : ''}`}
                style={{
                  background: isSel ? 'var(--surface)' : 'transparent',
                  border: isSel ? '1px solid #0A0A0A' : '0.5px solid #D5D2C9',
                }}
              >
                <div className="pr-7">
                  <div className="text-[15.5px] tracking-tight2 font-medium text-ink">{label}</div>
                  {desc && <div className="text-[13px] text-mute mt-1 leading-[1.4]">{desc}</div>}
                </div>
                {isSel ? (
                  <span className="absolute top-4 right-4 w-5 h-5 flex items-center justify-center bg-accent text-paper">
                    <IcCheck size={13} stroke={2} />
                  </span>
                ) : (
                  <span className="absolute top-4 right-4 w-5 h-5"
                        style={{ border: '0.5px solid #D5D2C9' }}></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="absolute left-0 right-0 bottom-0 bg-paper px-5 pt-3 pb-5 flex items-center justify-between"
           style={{ borderTop: '0.5px solid #D5D2C9' }}>
        <button onClick={back} className="text-[14px] tracking-tight2 text-ink press py-2 px-2 -ml-2">{t.back}</button>
        <button
          disabled={selected == null}
          onClick={next}
          className="h-12 px-7 press flex items-center gap-2 transition-opacity"
          style={{ background: 'var(--ink)', color: 'var(--paper)', opacity: selected == null ? 0.35 : 1 }}
        >
          <span className="text-[14.5px] tracking-tight2 font-medium">{step === CREATE_TOTAL - 1 ? t.send_request : t.next}</span>
          <IcArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

// ---------- Inbox ----------

const Inbox = ({ go }) => {
  const { t, lang } = useT();
  const [tab, setTab] = useState('all');

  const conversations = CONVERSATIONS.filter((c) => {
    if (tab === 'unread') return c.unread;
    if (tab === 'booked') return c.status === 'booked';
    return true;
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar left={<Wordmark />} right={<NotifyButton dot={false}/>} />

      <div className="scroll-area overflow-y-auto flex-1">
        <div className="px-5 pt-8">
          <h1 className="text-[40px] leading-[1.02] tracking-display font-medium text-ink">{t.inbox_title}</h1>
        </div>

        <div className="mt-6 px-5 flex items-end gap-6" style={{ borderBottom: '0.5px solid #D5D2C9' }}>
          {[['all', t.tab_all, CONVERSATIONS.length], ['unread', t.tab_unread, CONVERSATIONS.filter(c=>c.unread).length], ['booked', t.tab_booked, CONVERSATIONS.filter(c=>c.status==='booked').length]].map(([id, label, n]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`relative pb-3 flex items-baseline gap-1.5 press ${active ? 'text-ink tab-active' : 'text-mute'}`}
              >
                <span className="text-[13px] tracking-tight2" style={{ fontWeight: active ? 500 : 400 }}>{label}</span>
                <span className="tabular text-[11px] text-mute">{String(n).padStart(2,'0')}</span>
              </button>
            );
          })}
        </div>

        <div className="px-5">
          {conversations.map((c, i) => (
            <button
              key={c.id}
              onClick={() => go('chat', { conversation: c })}
              className="w-full text-left py-4 flex items-center gap-4 press"
              style={{ borderBottom: i < conversations.length - 1 ? '0.5px solid #D5D2C9' : 'none' }}
            >
              <Avatar src={c.who.avatar} size={48} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14.5px] font-medium tracking-tight2 text-ink truncate">{c.who.name}</span>
                  <span className="tabular text-[11.5px] text-mute shrink-0">{c.time}</span>
                </div>
                <div className="mt-1 text-[13.5px] text-mute leading-[1.4] line-clamp-1"
                     style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {c[`last_${lang}`] || c.last_de}
                </div>
              </div>
              {c.unread && <span className="w-2 h-2 bg-accent shrink-0"></span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------- Chat ----------

const Chat = ({ conversation, go }) => {
  const { t, lang } = useT();
  const c = conversation || CONVERSATIONS[0];
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { from: 'me',    text_de: 'Guten Tag, ich habe dein Profil gesehen und würde gerne über meinen Shoot in Zermatt sprechen.', text_fr: 'Bonjour, j\u2019ai vu ton profil et j\u2019aimerais parler du shoot à Zermatt.', text_en: 'Hi — saw your profile and would like to discuss the Zermatt shoot.', time: '13:42' },
    { from: 'other', text_de: 'Hoi Marko, gerne. Ich kenne die Bergkapelle gut. Hast du schon ein Datum?', text_fr: 'Bonjour Marko, avec plaisir. Je connais bien la chapelle. As-tu une date ?', text_en: 'Hi Marko — happy to. I know the chapel well. Do you have a date?', time: '13:48' },
    { from: 'me',    text_de: '14.08., Trauung um 14:30.', text_fr: '14.08, cérémonie à 14:30.', text_en: '14.08, ceremony at 14:30.', time: '13:50' },
    { from: 'other', text_de: 'Verfügbar. Ich schicke ein Angebot heute Abend.', text_fr: 'Disponible. Offre ce soir.', text_en: 'Available. Offer tonight.', time: '13:55' },
    { from: 'other', text_de: 'Klingt gut. Vorab-Anruf am Donnerstag 10:00?', text_fr: 'Très bien. Appel jeudi 10:00 ?', text_en: 'Sounds good. Call Thursday 10:00?', time: '14:32' },
  ]);

  const send = () => {
    if (!input.trim()) return;
    const time = new Date().toLocaleTimeString(lang === 'en' ? 'en-GB' : (lang === 'fr' ? 'fr-CH' : 'de-CH'), { hour: '2-digit', minute: '2-digit' });
    setMessages([...messages, { from: 'me', text_de: input, text_fr: input, text_en: input, time }]);
    setInput('');
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar
        left={
          <>
            <button onClick={() => go('back')} className="w-9 h-9 -ml-2 flex items-center justify-center press">
              <IcChevronLeft size={22} />
            </button>
            <div className="flex items-center gap-2.5">
              <Avatar src={c.who.avatar} size={30} />
              <div>
                <div className="text-[14px] font-medium tracking-tight2 leading-none">{c.who.name}</div>
                <div className="text-[10.5px] text-mute mt-0.5 tabular">{c.who.city}</div>
              </div>
            </div>
          </>
        }
        right={<button className="w-9 h-9 -mr-2 flex items-center justify-center press"><IcDots size={20}/></button>}
      />

      <div className="scroll-area overflow-y-auto flex-1 px-5 py-5 flex flex-col gap-3">
        {messages.map((m, i) => {
          const mine = m.from === 'me';
          return (
            <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[80%]">
                <div className={`px-3.5 py-2.5 text-[14.5px] leading-[1.45] ${mine ? 'bg-accent text-paper' : 'bg-chip text-ink'}`}
                     style={{ borderRadius: 2 }}>
                  {m[`text_${lang}`] || m.text_de}
                </div>
                <div className={`mt-1 label-sm tabular text-mute ${mine ? 'text-right' : 'text-left'}`}>{m.time}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 px-3 pt-2 pb-3 bg-paper" style={{ borderTop: '0.5px solid #D5D2C9' }}>
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder="Nachricht"
            className="flex-1 h-11 px-4 text-[14.5px] outline-none bg-transparent"
            style={{ border: '0.5px solid #D5D2C9' }}
          />
          <button onClick={send} className="w-11 h-11 flex items-center justify-center press bg-ink text-paper">
            <IcArrowUp size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, {
  SectionHeader, StatusPill, Rating, SpecRow,
  TopBar, Wordmark, Avatar, NotifyButton,
  BottomNav, NAV_CLIENT, NAV_PHOTOG,
  Home, Browse, ShootDetail, BidSheet, Profile, CreateFlow, Inbox, Chat,
});
