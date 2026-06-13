// CLIENT-SIDE screens (the user posting briefs and reviewing bids).
// Visuals share the existing system; no new colors/type introduced.

const { useState, useMemo } = React;

// ---------- Create Review (final screen) ----------

const CreateReview = ({ go }) => {
  const { t, lang } = useT();
  const data = [
    [t.spec_type,   'Hochzeit'],
    [t.spec_date,   '14.08.2026'],
    [t.spec_loc,    'Zermatt, 3920 VS'],
    [t.spec_dur,    `10 ${t.hours}`],
    [t.spec_budget, "CHF 3'200 – 4'500"],
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <div className="sticky top-0 z-30 bg-paper">
        <div className="px-5 h-14 flex items-center justify-between" style={{ borderBottom: '0.5px solid #E5E2DB' }}>
          <span className="label tabular">{t.step_of(5, 5)}</span>
          <div className="flex-1 mx-4 flex gap-1">
            {Array.from({length: 5}).map((_,i) => (
              <div key={i} className="flex-1 h-px" style={{ background: 'var(--ink)' }}></div>
            ))}
          </div>
          <button onClick={() => go && go('home')} className="w-9 h-9 -mr-2 flex items-center justify-center press">
            <IcClose size={20} />
          </button>
        </div>
      </div>

      <div className="scroll-area overflow-y-auto flex-1">
        <div className="px-5 pt-10">
          <span className="label text-mute">{lang === 'fr' ? 'Aperçu' : (lang === 'en' ? 'Review' : 'Übersicht')}</span>
          <h1 className="mt-3 text-[32px] leading-[1.06] tracking-display font-medium text-ink max-w-[320px]">
            {lang === 'fr' ? 'Tout est correct ?' : lang === 'en' ? 'Everything correct?' : 'Stimmt alles?'}
          </h1>
        </div>

        <div className="px-5 mt-8" style={{ borderTop: '0.5px solid #D5D2C9' }}>
          {data.map(([l, v], i) => <SpecRow key={i} label={l} value={v} last={i === data.length - 1} />)}
        </div>

        <div className="px-5 mt-8 pb-32">
          <span className="label text-mute">{t.sec_brief}</span>
          <p className="mt-3 text-[14.5px] leading-[1.55] text-ink/85">
            {lang === 'fr'
              ? 'Cérémonie à 14:30 à la chapelle de montagne, puis apéro en terrasse face au Cervin. Style documentaire — calme, sans poses sauf une photo de famille.'
              : lang === 'en'
              ? 'Ceremony at 14:30 in the mountain chapel, apéro on the terrace with Matterhorn view. Documentary style — calm, no posed groups except one family row.'
              : 'Trauung um 14:30 in der Bergkapelle, anschliessend Apéro auf der Terrasse mit Matterhorn-Blick. Dokumentarisch — ruhig, keine gestellten Gruppen ausser einer Familienreihe.'}
          </p>
        </div>
      </div>

      <div className="absolute left-0 right-0 bottom-0 bg-paper px-5 pt-3 pb-4 flex items-center justify-between"
           style={{ borderTop: '0.5px solid #D5D2C9' }}>
        <button className="text-[14px] tracking-tight2 text-ink press py-2 px-2 -ml-2">{t.back}</button>
        <button className="h-12 px-6 press flex items-center gap-2 bg-ink text-paper">
          <span className="text-[14.5px] tracking-tight2 font-medium">
            {lang === 'fr' ? 'Publier la mission' : lang === 'en' ? 'Publish brief' : 'Auftrag veröffentlichen'}
          </span>
          <IcArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

// ---------- Client: My Shoots ----------

const CLIENT_SHOOTS = [
  { id: 'cs1', title_de: 'Hochzeit in Zermatt',           title_fr: 'Mariage à Zermatt',        title_en: 'Wedding in Zermatt',           date: '14.08.2026', location: 'Zermatt, 3920 VS',   budgetLo: 3200, budgetHi: 4500, status: 'open',   offers: 7,  posted_de: 'vor 2 Std' , posted_fr: 'il y a 2 h', posted_en: '2h ago' , image: SHOOTS[0].image },
  { id: 'cs2', title_de: 'Editorial — Vitra Sommer',      title_fr: 'Editorial — Vitra été',     title_en: 'Editorial — Vitra Summer',     date: '03.06.2026', location: 'Basel, 4051 BS',    budgetLo: 4800, budgetHi: 6200, status: 'open',   offers: 12, posted_de: 'vor 5 Std' , posted_fr: 'il y a 5 h', posted_en: '5h ago' , image: SHOOTS[1].image },
  { id: 'cs3', title_de: 'Porträts — Stiftung Marbach',   title_fr: 'Portraits — Fondation Marbach', title_en: 'Portraits — Marbach Foundation', date: '21.05.2026', location: 'Lausanne, 1015 VD', budgetLo: 1800, budgetHi: 2400, status: 'booked', offers: 4,  bookedWith_de: 'Nora Bachmann', image: SHOOTS[2].image },
  { id: 'cs4', title_de: 'Architektur — Oerlikon',        title_fr: 'Architecture — Oerlikon',   title_en: 'Architecture — Oerlikon',      date: '02.03.2026', location: 'Zürich, 8050 ZH',   budgetLo: 2600, budgetHi: 3400, status: 'done',   offers: 9,  image: SHOOTS[3].image },
  { id: 'cs5', title_de: 'Firmenporträts — Helvetia',     title_fr: 'Portraits corpo — Helvetia',title_en: 'Corporate portraits — Helvetia', date: '12.02.2026', location: 'St. Gallen, 9000', budgetLo: 1200, budgetHi: 1800, status: 'done',   offers: 6,  image: SHOOTS[4].image },
];

const ClientMyShoots = ({ go }) => {
  const { t, lang } = useT();
  const [tab, setTab] = useState('active');

  const tabs_de = { active: 'Aktiv',      booked: 'Gebucht',    done: 'Abgeschlossen' };
  const tabs_fr = { active: 'Actives',    booked: 'Réservées',  done: 'Terminées' };
  const tabs_en = { active: 'Active',     booked: 'Booked',     done: 'Completed' };
  const labels = { de: tabs_de, fr: tabs_fr, en: tabs_en }[lang];

  const filter = { active: 'open', booked: 'booked', done: 'done' }[tab];
  const list = CLIENT_SHOOTS.filter((s) => s.status === filter);

  const lf = (o, k) => o[`${k}_${lang}`] || o[`${k}_de`];

  const statusPillFor = (s) => {
    if (s.status === 'open')   return <StatusPill>{`OFFEN · ${String(s.offers).padStart(2,'0')} ${lang === 'fr' ? 'OFFRES' : lang === 'en' ? 'OFFERS' : 'ANGEBOTE'}`}</StatusPill>;
    if (s.status === 'booked') return <StatusPill tone="invert">{lang === 'fr' ? 'RÉSERVÉ' : lang === 'en' ? 'BOOKED' : 'GEBUCHT'}</StatusPill>;
    if (s.status === 'done')   return <StatusPill>{lang === 'fr' ? 'TERMINÉ' : lang === 'en' ? 'DONE' : 'ABGESCHLOSSEN'}</StatusPill>;
    return null;
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar left={<Wordmark />} right={<NotifyButton />} />

      <div className="scroll-area overflow-y-auto flex-1">
        <div className="px-5 pt-8">
          <h1 className="text-[40px] leading-[1.02] tracking-display font-medium text-ink">
            {lang === 'fr' ? 'Mes missions' : lang === 'en' ? 'My briefs' : 'Meine Aufträge'}
          </h1>
        </div>

        <div className="mt-6 px-5 flex items-end gap-6" style={{ borderBottom: '0.5px solid #D5D2C9' }}>
          {Object.entries(labels).map(([id, label]) => {
            const active = tab === id;
            const n = CLIENT_SHOOTS.filter((s) => s.status === { active:'open', booked:'booked', done:'done' }[id]).length;
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

        <div className="px-5 pt-2">
          {list.map((s, i) => (
            <button
              key={s.id}
              onClick={() => go && go('client-review', { shoot: s })}
              className="w-full text-left press py-4 flex items-start gap-4"
              style={{ borderBottom: i < list.length - 1 ? '0.5px solid #D5D2C9' : 'none' }}
            >
              <span className="w-[72px] h-[72px] overflow-hidden bg-chip shrink-0">
                <img src={s.image} className="w-full h-full object-cover img-gray" alt="" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="label-sm text-mute tabular">{s.location.split(',')[0].toUpperCase()} · {s.date}</div>
                <div className="mt-1.5 text-[15.5px] tracking-tight2 leading-[1.2] font-medium text-ink truncate">
                  {lf(s, 'title')}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {statusPillFor(s)}
                  {s.status === 'open' && <span className="label-sm tabular text-mute">{t.posted_ago(lf(s,'posted'))}</span>}
                </div>
              </div>
              <div className="text-right shrink-0 self-center">
                <div className="tabular text-[13px] text-ink">{CHFRange(s.budgetLo, s.budgetHi).replace('CHF ','')}</div>
                <div className="label-sm text-mute mt-0.5">CHF</div>
              </div>
            </button>
          ))}
        </div>

        {list.length === 0 && (
          <div className="px-5 mt-10 text-[14px] leading-[1.55] text-mute">
            {lang === 'fr' ? 'Rien ici pour le moment.' : lang === 'en' ? 'Nothing here yet.' : 'Hier ist noch nichts.'}
          </div>
        )}

        <div className="h-12"></div>
      </div>
    </div>
  );
};

// ---------- Client: Review Bids ----------

const ClientReviewBids = ({ shoot, go }) => {
  const { t, lang } = useT();
  const s = shoot || CLIENT_SHOOTS[0];
  const [sort, setSort] = useState('price'); // price | rating | response

  const lf = (o, k) => o[`${k}_${lang}`] || o[`${k}_de`];

  const sorted = useMemo(() => {
    const arr = [...BIDS];
    if (sort === 'price')   arr.sort((a,b) => a.price - b.price);
    if (sort === 'rating')  arr.sort((a,b) => b.photographer.rating - a.photographer.rating);
    if (sort === 'response') arr.sort((a,b) => a.delivery - b.delivery);
    return arr;
  }, [sort]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <TopBar
        left={
          <button onClick={() => go && go('back')} className="w-9 h-9 -ml-2 flex items-center justify-center press">
            <IcChevronLeft size={22} />
          </button>
        }
        right={<button className="w-9 h-9 -mr-2 flex items-center justify-center press"><IcDots size={20}/></button>}
      />

      <div className="scroll-area overflow-y-auto flex-1 pb-10">
        {/* Shoot summary card */}
        <div className="px-5 pt-6 pb-6" style={{ borderBottom: '0.5px solid #D5D2C9' }}>
          <div className="flex items-start gap-4">
            <span className="w-[88px] h-[88px] bg-chip shrink-0 overflow-hidden">
              <img src={s.image} className="w-full h-full object-cover img-gray" alt="" />
            </span>
            <div className="flex-1 min-w-0">
              <StatusPill>{`OFFEN · ${String(s.offers || 7).padStart(2,'0')} ${lang==='fr'?'OFFRES':lang==='en'?'OFFERS':'ANGEBOTE'}`}</StatusPill>
              <h2 className="mt-2 text-[20px] tracking-tight2 leading-[1.15] font-medium text-ink">{lf(s, 'title') || s.title || 'Hochzeit in Zermatt'}</h2>
              <div className="mt-1.5 label-sm text-mute tabular">
                {(s.location || 'Zermatt, 3920 VS')} · {s.date || '14.08.2026'}
              </div>
              <div className="mt-1.5 tabular text-[13.5px] text-ink">
                {CHFRange(s.budgetLo || 3200, s.budgetHi || 4500)}
              </div>
            </div>
          </div>
        </div>

        {/* Section header */}
        <SectionHeader
          num={3}
          title={
            lang === 'fr' ? `Offres reçues (${BIDS.length})`
            : lang === 'en' ? `Offers received (${BIDS.length})`
            : `Eingegangene Angebote (${BIDS.length})`
          }
        />

        {/* Sort row */}
        <div className="px-5 -mt-2 mb-4 flex items-center gap-2 overflow-x-auto chip-row">
          {[
            ['price',    lang==='fr'?'Prix':lang==='en'?'Price':'Preis'],
            ['rating',   lang==='fr'?'Note':lang==='en'?'Rating':'Bewertung'],
            ['response', lang==='fr'?'Délai':lang==='en'?'Speed':'Antwort'],
          ].map(([id, label]) => {
            const active = sort === id;
            return (
              <button
                key={id}
                onClick={() => setSort(id)}
                className="shrink-0 h-8 px-3 label-sm press"
                style={{
                  background: active ? 'var(--ink)' : 'transparent',
                  color: active ? 'var(--paper)' : 'var(--ink)',
                  border: '0.5px solid ' + (active ? 'var(--ink)' : 'var(--line-strong)'),
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Bids */}
        <div className="px-5 flex flex-col gap-3">
          {sorted.map((b, idx) => (
            <div key={b.id} className="bg-surface p-4" style={{ border: '0.5px solid #D5D2C9' }}>
              <div className="flex items-start gap-3">
                <Avatar src={b.photographer.avatar} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] tracking-tight2 font-medium">{b.photographer.name}</div>
                  <div className="mt-0.5 flex items-center gap-2.5">
                    <Rating value={b.photographer.rating} count={b.photographer.reviews} />
                    <span className="label-sm text-mute">·</span>
                    <span className="label-sm tabular text-mute">{b.photographer.city}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="tabular text-[24px] font-medium tracking-display leading-none">{CHF(b.price)}</div>
                  <div className="label-sm text-mute mt-1.5 tabular">{t.delivery_weeks(b.delivery)}</div>
                </div>
              </div>
              <p className="mt-3 text-[14px] leading-[1.55] text-ink/85">{b[`message_${lang}`] || b.message_de}</p>

              <div className="mt-4 flex items-center gap-3" style={{ borderTop: '0.5px solid #E5E2DB', paddingTop: 12 }}>
                <button
                  onClick={() => go && go('profile', { photographer: b.photographer })}
                  className="label-sm flex items-center gap-1 press text-ink">
                  {t.view_profile} <IcArrowRight size={12} />
                </button>
                <div className="flex-1"></div>
                <button
                  onClick={() => go && go('booking-confirmed', { bid: b, shoot: s })}
                  className="h-9 px-4 bg-ink text-paper text-[12.5px] tracking-tight2 font-medium press flex items-center gap-1.5">
                  {lang === 'fr' ? 'Accepter' : lang === 'en' ? 'Accept' : 'Annehmen'}
                  <IcCheck size={14} stroke={1.75}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------- Booking Confirmation ----------

const BookingConfirmation = ({ bid, shoot, go }) => {
  const { t, lang } = useT();
  const b = bid || BIDS[0];
  const s = shoot || CLIENT_SHOOTS[0];

  const heading_de = 'Buchung bestätigt';
  const heading_fr = 'Réservation confirmée';
  const heading_en = 'Booking confirmed';
  const sub_de = (n) => `${n} hat dein Angebot angenommen. Eure Konversation ist offen.`;
  const sub_fr = (n) => `${n} a accepté ton offre. La conversation est ouverte.`;
  const sub_en = (n) => `${n} accepted your offer. Your conversation is open.`;

  const lf = (o, k) => o[`${k}_${lang}`] || o[`${k}_de`];

  const heading = { de: heading_de, fr: heading_fr, en: heading_en }[lang];
  const subFn = { de: sub_de, fr: sub_fr, en: sub_en }[lang];

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <TopBar
        left={<span className="w-9"></span>}
        right={
          <button onClick={() => go && go('home')} className="w-9 h-9 -mr-2 flex items-center justify-center press">
            <IcClose size={20} />
          </button>
        }
      />

      <div className="scroll-area overflow-y-auto flex-1 pb-32">
        <div className="px-5 pt-10">
          <span className="w-12 h-12 inline-flex items-center justify-center bg-accent text-paper">
            <IcCheck size={22} stroke={1.75} />
          </span>
          <h1 className="mt-6 text-[36px] leading-[1.04] tracking-display font-medium text-ink">{heading}</h1>
          <p className="mt-3 text-[14.5px] leading-[1.55] text-mute max-w-[300px]">{subFn(b.photographer.name)}</p>
        </div>

        {/* Photographer card */}
        <div className="px-5 mt-8">
          <div className="bg-surface p-4 flex items-center gap-4" style={{ border: '0.5px solid #D5D2C9' }}>
            <Avatar src={b.photographer.avatar} size={56} />
            <div className="flex-1 min-w-0">
              <div className="text-[15.5px] tracking-tight2 font-medium">{b.photographer.name}</div>
              <div className="mt-0.5 label-sm text-mute tabular">{b.photographer.city}, {b.photographer.postcode}</div>
              <div className="mt-1.5"><Rating value={b.photographer.rating} count={b.photographer.reviews} /></div>
            </div>
          </div>
        </div>

        {/* Booking summary */}
        <SectionHeader num={1} title={lang === 'fr' ? 'Réservation' : lang === 'en' ? 'Booking' : 'Buchung'} />

        <div className="px-5" style={{ borderTop: '0.5px solid #D5D2C9' }}>
          <SpecRow label={lang === 'fr' ? 'Mission' : lang === 'en' ? 'Brief' : 'Auftrag'} value={lf(s, 'title') || s.title || 'Hochzeit in Zermatt'} />
          <SpecRow label={t.spec_date}   value={s.date || '14.08.2026'} />
          <SpecRow label={t.spec_loc}    value={s.location || 'Zermatt, 3920 VS'} />
          <SpecRow label={t.spec_dur}    value={`10 ${t.hours}`} />
          <SpecRow label={lang === 'fr' ? 'Honoraire' : lang === 'en' ? 'Fee' : 'Honorar'} value={CHF(b.price)} />
          <SpecRow label={lang === 'fr' ? 'Livraison' : lang === 'en' ? 'Delivery' : 'Lieferung'} value={t.delivery_weeks(b.delivery)} last />
        </div>

        {/* Next steps */}
        <SectionHeader num={2} title={lang === 'fr' ? 'Prochaines étapes' : lang === 'en' ? 'Next steps' : 'Nächste Schritte'} />

        <div className="px-5 flex flex-col gap-3">
          {[
            { de: 'Vertrag wird automatisch generiert',     fr: 'Le contrat est généré automatiquement',     en: 'Contract is generated automatically' },
            { de: 'Anzahlung 20 % fällig in 7 Tagen',        fr: 'Acompte 20 % dû dans 7 jours',              en: '20 % deposit due in 7 days' },
            { de: 'Vorab-Anruf zur Klärung des Briefings', fr: 'Appel préalable pour clarifier le briefing', en: 'Pre-shoot call to align on the brief' },
          ].map((n, i) => (
            <div key={i} className="flex items-baseline gap-3 py-2">
              <span className="label tabular text-mute shrink-0 w-5">{String(i+1).padStart(2,'0')}</span>
              <span className="text-[14px] leading-[1.5] text-ink/85">{n[lang] || n.de}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="absolute left-0 right-0 bottom-0 bg-paper px-5 pt-3 pb-4 flex gap-3"
           style={{ borderTop: '0.5px solid #D5D2C9' }}>
        <button className="flex-1 h-12 press flex items-center justify-center text-[14.5px] tracking-tight2 font-medium"
                style={{ border: '0.5px solid #0A0A0A', color: 'var(--ink)', background: 'transparent' }}>
          {lang === 'fr' ? 'Détails' : lang === 'en' ? 'Details' : 'Details'}
        </button>
        <button className="flex-[1.6] h-12 bg-ink text-paper press flex items-center justify-center gap-2 text-[14.5px] tracking-tight2 font-medium">
          {lang === 'fr' ? 'Message envoyer' : lang === 'en' ? 'Send message' : 'Nachricht senden'}
          <IcArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

// ---------- Create flow — dedicated step snapshots (canvas) ----------

const StepShell = ({ stepNum, totalSteps = 4, title, children, cta = 'Weiter', back = 'Zurück', complete = false, validated = true }) => {
  const { lang } = useT();
  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <div className="sticky top-0 z-30 bg-paper">
        <div className="px-5 h-14 flex items-center justify-between" style={{ borderBottom: '0.5px solid #E5E2DB' }}>
          <span className="label tabular">
            {String(stepNum).padStart(2,'0')} / {String(totalSteps).padStart(2,'0')}
          </span>
          <div className="flex-1 mx-4 flex gap-1">
            {Array.from({length: totalSteps}).map((_,i) => (
              <div key={i} className="flex-1 h-px" style={{ background: i < stepNum ? 'var(--ink)' : 'var(--line-strong)' }}></div>
            ))}
          </div>
          <button className="w-9 h-9 -mr-2 flex items-center justify-center press"><IcClose size={20} /></button>
        </div>
      </div>

      <div className="scroll-area overflow-y-auto flex-1">
        <div className="px-5 pt-10">
          <h1 className="text-[28px] leading-[1.08] tracking-display font-medium text-ink max-w-[320px]">{title}</h1>
        </div>
        {children}
      </div>

      <div className="bg-paper px-5 pt-3 pb-4 flex items-center justify-between"
           style={{ borderTop: '0.5px solid #D5D2C9' }}>
        <button className="text-[14px] tracking-tight2 text-ink press py-2 px-2 -ml-2">{back}</button>
        <button className="h-12 px-6 press flex items-center gap-2"
                style={{ background: 'var(--ink)', color: 'var(--paper)', opacity: validated ? 1 : 0.35 }}>
          <span className="text-[14.5px] tracking-tight2 font-medium">{cta}</span>
          <IcArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

const CreateStepType = () => {
  const { t, lang } = useT();
  const opts = lang === 'fr'
    ? [['Mariage','Cérémonie, apéro, dîner.'],['Événement','Conférence, vernissage.'],['Portrait','Studio ou sur site.'],['Commercial','Produit, campagne.'],['Autre','Autre type de shoot.']]
    : lang === 'en'
    ? [['Wedding','Ceremony, apéro, dinner.'],['Event','Conference, opening.'],['Portrait','Studio or on location.'],['Commercial','Product, campaign.'],['Other','Other kind of shoot.']]
    : [['Hochzeit','Trauung, Apéro, Dinner.'],['Event','Konferenz, Vernissage.'],['Porträt','Studio oder vor Ort.'],['Commercial','Produkt, Kampagne.'],['Andere','Anderer Art von Shoot.']];

  const title = lang === 'fr' ? 'Quel type de shoot ?' : lang === 'en' ? 'What kind of shoot?' : 'Welche Art von Shoot?';

  return (
    <StepShell stepNum={1} title={title} cta={t.next} back={t.back}>
      <div className="px-5 pt-7 pb-8 flex flex-col gap-2.5">
        {opts.map(([label, desc], i) => {
          const sel = i === 0;
          return (
            <div key={i} className={`relative p-4 ${sel ? 'opt-selected' : ''}`}
                 style={{ background: sel ? 'var(--surface)' : 'transparent',
                          border: sel ? '1px solid #0A0A0A' : '0.5px solid #D5D2C9' }}>
              <div className="pr-7">
                <div className="text-[15.5px] tracking-tight2 font-medium text-ink">{label}</div>
                <div className="text-[13px] text-mute mt-1 leading-[1.4]">{desc}</div>
              </div>
              {sel ? (
                <span className="absolute top-4 right-4 w-5 h-5 flex items-center justify-center bg-accent text-paper">
                  <IcCheck size={13} stroke={2} />
                </span>
              ) : (
                <span className="absolute top-4 right-4 w-5 h-5" style={{ border: '0.5px solid #D5D2C9' }}></span>
              )}
            </div>
          );
        })}
      </div>
    </StepShell>
  );
};

const CreateStepWhenWhere = () => {
  const { t, lang } = useT();
  const title = lang === 'fr' ? 'Quand et où ?' : lang === 'en' ? 'When and where?' : 'Wann und wo?';
  const dateLabel = lang === 'fr' ? 'Date' : lang === 'en' ? 'Date' : 'Datum';
  const locLabel  = lang === 'fr' ? 'Lieu' : lang === 'en' ? 'Location' : 'Ort';

  // mini calendar grid — Aug 2026, highlight 14
  const days = ['M','D','M','D','F','S','S'];
  if (lang === 'fr') { days[0]='L'; days[1]='M'; days[2]='M'; days[3]='J'; days[4]='V'; days[5]='S'; days[6]='D'; }
  if (lang === 'en') { days[0]='M'; days[1]='T'; days[2]='W'; days[3]='T'; days[4]='F'; days[5]='S'; days[6]='S'; }
  const monthLabel = lang === 'fr' ? 'Août 2026' : lang === 'en' ? 'August 2026' : 'August 2026';
  // August 2026: 1 falls on Saturday (day index 5)
  const startOffset = 5; // M=0..S=5,S=6
  const totalDays = 31;
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  return (
    <StepShell stepNum={2} title={title} cta={t.next} back={t.back}>
      <div className="px-5 pt-7">
        {/* Calendar */}
        <div>
          <div className="flex items-center justify-between">
            <span className="label text-ink">{dateLabel}</span>
            <span className="text-[13.5px] tracking-tight2 text-ink tabular">{monthLabel}</span>
          </div>
          <div className="mt-4" style={{ border: '0.5px solid #D5D2C9' }}>
            <div className="grid grid-cols-7" style={{ borderBottom: '0.5px solid #D5D2C9' }}>
              {days.map((d, i) => (
                <div key={i} className="label-sm text-mute text-center py-2 tabular">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((d, i) => {
                const selected = d === 14;
                const past = d != null && d < 8;
                return (
                  <div key={i} className="aspect-square flex items-center justify-center relative"
                       style={{
                         background: selected ? 'var(--ink)' : 'transparent',
                         color: selected ? 'var(--paper)' : past ? 'var(--mute-2)' : 'var(--ink)',
                         borderRight: (i % 7 !== 6) ? '0.5px solid #E5E2DB' : 'none',
                         borderTop:   (i >= 7) ? '0.5px solid #E5E2DB' : 'none',
                       }}>
                    {d != null && (
                      <span className="tabular text-[13px]" style={{ fontWeight: selected ? 500 : 400 }}>{d}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="mt-7">
          <span className="label text-ink">{locLabel}</span>
          <div className="mt-3 flex items-center justify-between p-3.5" style={{ border: '0.5px solid #D5D2C9' }}>
            <div className="flex items-center gap-2">
              <IcPin size={16} className="text-mute"/>
              <span className="text-[15px] tracking-tight2 text-ink">Zermatt</span>
              <span className="text-[13px] text-mute tabular">· 3920 VS</span>
            </div>
            <IcChevronRight size={16} className="text-mute"/>
          </div>

          {/* Mini map */}
          <div className="mt-3 bg-chip relative overflow-hidden" style={{ height: 140, border: '0.5px solid #D5D2C9' }}>
            <svg viewBox="0 0 390 140" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
              {/* topo lines */}
              {[...Array(12)].map((_,i) => (
                <path key={i}
                      d={`M0 ${20 + i*10} Q ${80 + i*8} ${10 + i*9} ${180 + i*6} ${30 + i*8} T 390 ${40 + i*8}`}
                      fill="none" stroke="var(--line-strong)" strokeWidth="0.5"/>
              ))}
              {/* roads */}
              <path d="M0 90 Q 100 70 200 95 T 390 100" fill="none" stroke="var(--mute-2)" strokeWidth="1"/>
              <path d="M120 0 Q 160 60 180 140" fill="none" stroke="var(--mute-2)" strokeWidth="1"/>
            </svg>
            {/* Pin */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
              <div className="w-3 h-3 bg-accent rounded-full" style={{ boxShadow: '0 0 0 4px rgb(var(--accent-rgb) / 0.18)' }}></div>
            </div>
            {/* postcode chip */}
            <div className="absolute bottom-2 left-2 label-sm tabular bg-paper px-2 py-1" style={{ border: '0.5px solid #D5D2C9' }}>
              3920 ZERMATT
            </div>
          </div>
        </div>
        <div className="h-8"></div>
      </div>
    </StepShell>
  );
};

const CreateStepBudgetDuration = () => {
  const { t, lang } = useT();
  const title = lang === 'fr' ? 'Budget et durée' : lang === 'en' ? 'Budget and duration' : 'Budget und Dauer';
  const budgetLabel = lang === 'fr' ? 'Budget (CHF)' : lang === 'en' ? 'Budget (CHF)' : 'Budget (CHF)';
  const durLabel    = lang === 'fr' ? 'Durée (heures)' : lang === 'en' ? 'Duration (hours)' : 'Dauer (Stunden)';

  // slider visuals: range 3'200 – 4'500 of total 0 – 10'000
  const lo = 32, hi = 45; // %

  return (
    <StepShell stepNum={3} title={title} cta={t.next} back={t.back}>
      <div className="px-5 pt-7">
        {/* Budget range */}
        <div>
          <div className="flex items-baseline justify-between">
            <span className="label text-ink">{budgetLabel}</span>
            <span className="tabular text-[13px] text-mute">0 — 10'000</span>
          </div>
          <div className="mt-6 flex items-baseline gap-2">
            <span className="text-[36px] font-medium tracking-display tabular text-ink leading-none">3'200</span>
            <span className="text-[18px] text-mute leading-none tabular">–</span>
            <span className="text-[36px] font-medium tracking-display tabular text-ink leading-none">4'500</span>
          </div>
          <div className="mt-1 label-sm text-mute tabular">CHF</div>

          {/* Slider track */}
          <div className="mt-7 relative h-px" style={{ background: 'var(--line-strong)' }}>
            <div className="absolute h-px bg-ink" style={{ left: `${lo}%`, right: `${100-hi}%` }}></div>
            <div className="absolute -top-[7px] w-3.5 h-3.5 bg-ink rounded-full" style={{ left: `calc(${lo}% - 7px)` }}></div>
            <div className="absolute -top-[7px] w-3.5 h-3.5 bg-ink rounded-full" style={{ left: `calc(${hi}% - 7px)` }}></div>
          </div>
          <div className="mt-3 flex justify-between label-sm text-mute tabular">
            <span>0</span><span>2'500</span><span>5'000</span><span>7'500</span><span>10'000</span>
          </div>
        </div>

        {/* Duration */}
        <div className="mt-10">
          <span className="label text-ink">{durLabel}</span>
          <div className="mt-3 flex items-center" style={{ border: '0.5px solid #D5D2C9' }}>
            <button className="w-12 h-12 flex items-center justify-center press"
                    style={{ borderRight: '0.5px solid #D5D2C9' }}>
              <span className="text-[18px] text-ink">−</span>
            </button>
            <div className="flex-1 text-center">
              <span className="tabular text-[20px] font-medium tracking-display text-ink">10</span>
              <span className="ml-1.5 label-sm text-mute">{t.hours.toUpperCase()}</span>
            </div>
            <button className="w-12 h-12 flex items-center justify-center press"
                    style={{ borderLeft: '0.5px solid #D5D2C9' }}>
              <span className="text-[18px] text-ink">+</span>
            </button>
          </div>
        </div>

        <p className="mt-6 text-[12.5px] leading-[1.5] text-mute">
          {lang === 'fr' ? 'Les photographes proposent leur prix dans ta fourchette. Tu choisis.' :
            lang === 'en' ? 'Photographers propose their price within your range. You choose.' :
            'Fotograf:innen schlagen ihren Preis innerhalb deiner Spanne vor. Du wählst.'}
        </p>
      </div>
    </StepShell>
  );
};

const CreateStepBriefing = () => {
  const { t, lang } = useT();
  const title = lang === 'fr' ? 'Briefing' : lang === 'en' ? 'Briefing' : 'Briefing';
  const descLabel = lang === 'fr' ? 'Description' : lang === 'en' ? 'Description' : 'Beschreibung';
  const refLabel  = lang === 'fr' ? 'Références (3 max)' : lang === 'en' ? 'References (max 3)' : 'Referenzen (max. 3)';

  const text = lang === 'fr'
    ? 'Cérémonie à 14:30 à la chapelle de montagne, puis apéro en terrasse face au Cervin. Style documentaire — calme, sans poses sauf une photo de famille.'
    : lang === 'en'
    ? 'Ceremony at 14:30 in the mountain chapel, apéro on the terrace with Matterhorn view. Documentary style — calm, no posed groups except one family row.'
    : 'Trauung um 14:30 in der Bergkapelle, anschliessend Apéro auf der Terrasse mit Matterhorn-Blick. Dokumentarisch — ruhig, keine gestellten Gruppen ausser einer Familienreihe.';

  return (
    <StepShell stepNum={4} title={title} cta={lang === 'fr' ? 'Aperçu' : lang === 'en' ? 'Review' : 'Übersicht'} back={t.back}>
      <div className="px-5 pt-7">
        {/* Description */}
        <span className="label text-ink">{descLabel}</span>
        <div className="mt-3 p-3.5 text-[14.5px] leading-[1.55] text-ink/85" style={{ border: '0.5px solid #D5D2C9', minHeight: 140 }}>
          {text}
        </div>
        <div className="mt-1.5 text-right label-sm tabular text-mute">{text.length} / 500</div>

        {/* References */}
        <div className="mt-7">
          <span className="label text-ink">{refLabel}</span>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="bg-chip overflow-hidden" style={{ aspectRatio: '1/1' }}>
              <img src={UN('1519741497674-611481863552', 200, 200)} className="w-full h-full object-cover img-gray" alt=""/>
            </div>
            <div className="bg-chip overflow-hidden" style={{ aspectRatio: '1/1' }}>
              <img src={UN('1506905925346-21bda4d32df4', 200, 200)} className="w-full h-full object-cover img-gray" alt=""/>
            </div>
            <button className="flex flex-col items-center justify-center gap-1.5 press"
                    style={{ aspectRatio: '1/1', border: '0.5px dashed #B8B5AC' }}>
              <IcPlus size={20} className="text-mute"/>
              <span className="label-sm text-mute">{lang === 'fr' ? 'Ajouter' : lang === 'en' ? 'Add' : 'Hinzufügen'}</span>
            </button>
          </div>
        </div>

        <div className="h-8"></div>
      </div>
    </StepShell>
  );
};

Object.assign(window, {
  CreateReview, ClientMyShoots, ClientReviewBids, BookingConfirmation, CLIENT_SHOOTS,
  CreateStepType, CreateStepWhenWhere, CreateStepBudgetDuration, CreateStepBriefing,
});