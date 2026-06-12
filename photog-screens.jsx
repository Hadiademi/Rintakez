// PHOTOGRAPHER-SIDE screens. Visuals share the existing system.

const { useState: pUseState } = React;

// ---------- Photographer Home (P1) ----------

const PhotogHome = ({ go }) => {
  const { t, lang } = useT();

  const greeting_de = 'Hallo, Nora.';
  const greeting_fr = 'Bonjour, Nora.';
  const greeting_en = 'Hi, Nora.';
  const greeting = { de: greeting_de, fr: greeting_fr, en: greeting_en }[lang];

  const sub_de = 'Zwei neue Aufträge in Zermatt. Ein Angebot von letzter Woche wartet noch.';
  const sub_fr = 'Deux nouvelles missions à Zermatt. Une offre de la semaine dernière attend toujours.';
  const sub_en = 'Two new briefs in Zermatt. One offer from last week still waiting.';
  const sub = { de: sub_de, fr: sub_fr, en: sub_en }[lang];

  // Stats
  const stats = [
    { value: '07',          label: { de: 'Offene Angebote', fr: 'Offres en cours', en: 'Open offers' }[lang] },
    { value: '03',          label: { de: 'Anstehende Shoots', fr: 'Shoots à venir', en: 'Upcoming shoots' }[lang] },
    { value: "CHF 14'400",  label: { de: 'Diesen Monat',     fr: 'Ce mois-ci',      en: 'This month' }[lang] },
  ];

  // Neue Aufträge in deiner Nähe
  const nearby = SHOOTS.slice(0, 3);
  const lf = (obj, key) => obj[`${key}_${lang}`] || obj[key];

  // Eingereichte Angebote
  const myBids = [
    { id: 'mb1', shoot: SHOOTS[1], price: 5500, sentAt_de: 'vor 3 Tagen', sentAt_fr: 'il y a 3 j', sentAt_en: '3d ago', status: 'pending' },
    { id: 'mb2', shoot: SHOOTS[3], price: 2950, sentAt_de: 'vor 1 Tag',   sentAt_fr: 'il y a 1 j', sentAt_en: '1d ago', status: 'pending' },
  ];

  // Anstehende Shoots
  const upcoming = [
    { id: 'up1', title_de: 'Porträts — IMD Lausanne', title_fr: 'Portraits — IMD Lausanne', title_en: 'Portraits — IMD Lausanne', date: '02.06.2026', time: '09:00', location: 'Lausanne, 1015 VD' },
    { id: 'up2', title_de: 'Editorial — On Running',  title_fr: 'Editorial — On Running',   title_en: 'Editorial — On Running',   date: '12.06.2026', time: '06:30', location: 'Engelberg, 6390' },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar
        left={<Wordmark />}
        right={
          <>
            <NotifyButton />
            <button onClick={() => go && go('profile-edit')} className="press">
              <Avatar src={PHOTOGRAPHERS[0].avatar} size={30} ring />
            </button>
          </>
        }
      />

      <div className="scroll-area overflow-y-auto flex-1">
        {/* Greeting */}
        <header className="px-5 pt-8 pb-2">
          <h1 className="text-[40px] leading-[1.02] tracking-display font-medium text-ink">
            {greeting}
          </h1>
          <p className="mt-4 text-[14.5px] leading-[1.5] text-mute max-w-[320px]">
            {sub}
          </p>
        </header>

        {/* Stats row */}
        <div className="px-5 pt-6">
          <div className="grid grid-cols-3" style={{ borderTop: '0.5px solid #D5D2C9', borderBottom: '0.5px solid #D5D2C9' }}>
            {stats.map((s, i) => (
              <div key={i} className="py-4"
                   style={{ borderRight: i < stats.length - 1 ? '0.5px solid #D5D2C9' : 'none', paddingLeft: i === 0 ? 0 : 14, paddingRight: 8 }}>
                <div className="tabular text-[22px] tracking-display font-medium text-ink leading-none whitespace-nowrap">{s.value}</div>
                <div className="mt-2 label-sm text-mute" style={{ lineHeight: 1.3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 01 — Nearby briefs */}
        <SectionHeader num={1} title={
          { de: 'Neue Aufträge in deiner Nähe',
            fr: 'Nouvelles missions près de toi',
            en: 'New briefs near you' }[lang]
        } />

        <div className="px-5 chip-row overflow-x-auto -mx-1 px-1">
          <div className="flex gap-3 px-4" style={{ width: 'max-content' }}>
            {nearby.map((s) => (
              <button key={s.id} onClick={() => go && go('detail', { shoot: s })}
                      className="press text-left shrink-0" style={{ width: 240 }}>
                <div className="bg-chip overflow-hidden" style={{ aspectRatio: '4/3' }}>
                  <img src={s.image} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="pt-3">
                  <div className="label-sm text-mute tabular">{s.location.toUpperCase()} · {s.date}</div>
                  <div className="mt-1.5 text-[15px] font-medium tracking-tight2 text-ink leading-[1.2]"
                       style={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                    {lf(s, 'title')}
                  </div>
                  <div className="mt-2 tabular text-[13px] text-ink">{CHFRange(s.budgetLo, s.budgetHi)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 02 — Active offers */}
        <SectionHeader num={2} title={
          { de: 'Deine aktiven Angebote',
            fr: 'Tes offres en cours',
            en: 'Your active offers' }[lang]
        } />

        <div className="px-5">
          {myBids.map((b, i) => (
            <button key={b.id} className="w-full text-left press py-4 flex items-center gap-4"
                    style={{ borderBottom: i < myBids.length - 1 ? '0.5px solid #D5D2C9' : 'none' }}>
              <span className="w-14 h-14 bg-chip overflow-hidden shrink-0">
                <img src={b.shoot.image} className="w-full h-full object-cover img-gray" alt=""/>
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[14.5px] font-medium tracking-tight2 truncate">{lf(b.shoot, 'title')}</div>
                <div className="label-sm text-mute mt-1 tabular">{b.shoot.location.toUpperCase()} · {b.shoot.date}</div>
                <div className="mt-1.5 text-[12.5px]">
                  <span className="label tabular text-mute">
                    {{ de: 'WARTEND', fr: 'EN ATTENTE', en: 'PENDING' }[lang]}
                  </span>
                  <span className="text-mute mx-1.5">·</span>
                  <span className="label tabular text-mute">{b[`sentAt_${lang}`]}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="tabular text-[17px] font-medium tracking-display leading-none text-ink">{CHF(b.price)}</div>
              </div>
            </button>
          ))}
        </div>

        {/* 03 — Upcoming */}
        <SectionHeader num={3} title={
          { de: 'Anstehende Shoots',
            fr: 'Shoots à venir',
            en: 'Upcoming shoots' }[lang]
        } />

        <div className="px-5 pb-10">
          {upcoming.map((u, i) => (
            <div key={u.id} className="py-4 flex items-baseline gap-5"
                 style={{ borderBottom: i < upcoming.length - 1 ? '0.5px solid #D5D2C9' : 'none' }}>
              <div className="text-right shrink-0" style={{ width: 64 }}>
                <div className="tabular text-[22px] font-medium tracking-display leading-none text-ink">{u.date.split('.')[0]}</div>
                <div className="label-sm text-mute mt-1 tabular">
                  {{ '06': 'JUN', '07': 'JUL', '08': 'AUG' }[u.date.split('.')[1]] || u.date.split('.')[1]}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-medium tracking-tight2 text-ink truncate">{lf(u, 'title')}</div>
                <div className="label-sm text-mute mt-1.5 tabular">{u.time} · {u.location}</div>
              </div>
              <IcChevronRight size={18} className="text-mute shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------- Photographer · My Bids (P5) ----------

const PHOTOG_BIDS = [
  { id: 'pb1', shoot: SHOOTS[0], price: 3800, status: 'pending',  sentAt_de: 'vor 6 Std', sentAt_fr: 'il y a 6h', sentAt_en: '6h ago' },
  { id: 'pb2', shoot: SHOOTS[1], price: 5500, status: 'pending',  sentAt_de: 'vor 3 Tagen', sentAt_fr: 'il y a 3 j', sentAt_en: '3d ago' },
  { id: 'pb3', shoot: SHOOTS[2], price: 2200, status: 'accepted', sentAt_de: '21.04.2026', sentAt_fr: '21.04.2026', sentAt_en: '21.04.2026' },
  { id: 'pb4', shoot: SHOOTS[3], price: 2950, status: 'pending',  sentAt_de: 'vor 1 Tag',  sentAt_fr: 'il y a 1 j',  sentAt_en: '1d ago' },
  { id: 'pb5', shoot: SHOOTS[4], price: 8400, status: 'rejected', sentAt_de: '08.04.2026', sentAt_fr: '08.04.2026', sentAt_en: '08.04.2026' },
];

const PhotogMyBids = ({ go }) => {
  const { t, lang } = useT();
  const [tab, setTab] = pUseState('pending');

  const labels = {
    de: { pending: 'Wartend',    accepted: 'Angenommen', rejected: 'Abgelehnt' },
    fr: { pending: 'En attente', accepted: 'Acceptées',  rejected: 'Refusées' },
    en: { pending: 'Pending',    accepted: 'Accepted',   rejected: 'Rejected' },
  }[lang];

  const lf = (obj, key) => obj[`${key}_${lang}`] || obj[key];
  const filtered = PHOTOG_BIDS.filter((b) => b.status === tab);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar left={<Wordmark />} right={<NotifyButton dot={false}/>} />

      <div className="scroll-area overflow-y-auto flex-1">
        <div className="px-5 pt-8">
          <h1 className="text-[40px] leading-[1.02] tracking-display font-medium text-ink">
            {{ de: 'Meine Angebote', fr: 'Mes offres', en: 'My offers' }[lang]}
          </h1>
        </div>

        <div className="mt-6 px-5 flex items-end gap-6" style={{ borderBottom: '0.5px solid #D5D2C9' }}>
          {Object.entries(labels).map(([id, label]) => {
            const active = tab === id;
            const n = PHOTOG_BIDS.filter((b) => b.status === id).length;
            return (
              <button key={id} onClick={() => setTab(id)}
                      className={`relative pb-3 flex items-baseline gap-1.5 press ${active ? 'text-ink tab-active' : 'text-mute'}`}>
                <span className="text-[13px] tracking-tight2" style={{ fontWeight: active ? 500 : 400 }}>{label}</span>
                <span className="tabular text-[11px] text-mute">{String(n).padStart(2,'0')}</span>
              </button>
            );
          })}
        </div>

        <div className="px-5">
          {filtered.map((b, i) => {
            const isAccepted = b.status === 'accepted';
            const isRejected = b.status === 'rejected';
            return (
              <div key={b.id} className="py-4 flex items-start gap-4"
                   style={{ borderBottom: i < filtered.length - 1 ? '0.5px solid #D5D2C9' : 'none' }}>
                <span className="w-[68px] h-[68px] bg-chip overflow-hidden shrink-0">
                  <img src={b.shoot.image} className="w-full h-full object-cover img-gray" alt=""/>
                </span>
                <div className="flex-1 min-w-0">
                  <div className="label-sm text-mute tabular">{b.shoot.location.toUpperCase()} · {b.shoot.date}</div>
                  <div className="mt-1 text-[15px] font-medium tracking-tight2 truncate">{lf(b.shoot, 'title')}</div>
                  <div className="mt-2 flex items-center gap-2">
                    {isAccepted && <StatusPill tone="invert">{labels.accepted.toUpperCase()}</StatusPill>}
                    {isRejected && <StatusPill>{labels.rejected.toUpperCase()}</StatusPill>}
                    {!isAccepted && !isRejected && <StatusPill>{labels.pending.toUpperCase()}</StatusPill>}
                    <span className="label-sm text-mute tabular">· {b[`sentAt_${lang}`]}</span>
                  </div>
                </div>
                <div className="text-right shrink-0 self-center">
                  <div className="tabular text-[18px] font-medium tracking-display leading-none text-ink">{CHF(b.price)}</div>
                  <div className="label-sm text-mute mt-1.5 tabular">{CHFRange(b.shoot.budgetLo, b.shoot.budgetHi).replace('CHF ','')}</div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="px-5 pt-10 text-[14px] leading-[1.55] text-mute max-w-[320px]">
            {{ de: 'Nichts hier. Schau in den offenen Aufträgen vorbei.',
               fr: 'Rien ici. Va voir les missions ouvertes.',
               en: 'Nothing here yet. Check the open briefs.' }[lang]}
          </div>
        )}

        <div className="h-10"></div>
      </div>
    </div>
  );
};

// ---------- Photographer · Profile Edit (P6) ----------

const PhotogProfileEdit = ({ go }) => {
  const { t, lang } = useT();
  const p = PHOTOGRAPHERS[0];

  const label_de = {
    bio: 'Bio', specialties: 'Spezialisierungen', gear: 'Ausrüstung',
    langs: 'Sprachen', base: 'Tagessatz', avail: 'Verfügbarkeit',
    portfolio: 'Portfolio', save: 'Speichern', preview: 'Vorschau',
    status_on: 'Sichtbar für Kunden',
  };
  const label_fr = {
    bio: 'Bio', specialties: 'Spécialisations', gear: 'Équipement',
    langs: 'Langues', base: 'Tarif journée', avail: 'Disponibilité',
    portfolio: 'Portfolio', save: 'Enregistrer', preview: 'Aperçu',
    status_on: 'Visible pour les clients',
  };
  const label_en = {
    bio: 'Bio', specialties: 'Specialisations', gear: 'Gear',
    langs: 'Languages', base: 'Day rate', avail: 'Availability',
    portfolio: 'Portfolio', save: 'Save', preview: 'Preview',
    status_on: 'Visible to clients',
  };
  const L = { de: label_de, fr: label_fr, en: label_en }[lang];

  const bio = p[`bio_${lang}`] || p.bio_de;
  const gear = p[`gear_${lang}`] || p.gear;

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <TopBar
        left={<span className="text-[15px] font-medium tracking-tight2">{lang==='fr'?'Mon profil':lang==='en'?'My profile':'Mein Profil'}</span>}
        right={
          <button className="label-sm tabular text-ink press">{L.preview}</button>
        }
      />

      <div className="scroll-area overflow-y-auto flex-1 pb-28">
        {/* Hero with edit affordance */}
        <div className="relative bg-chip w-full" style={{ aspectRatio: '3/2' }}>
          <img src={p.hero} className="w-full h-full object-cover" alt="" />
          <button className="absolute bottom-3 right-3 h-9 px-3 bg-paper press flex items-center gap-1.5 label-sm"
                  style={{ border: '0.5px solid #0A0A0A' }}>
            <IcEdit size={13}/>
            {lang==='fr'?'Modifier':lang==='en'?'Edit':'Bearbeiten'}
          </button>
        </div>

        {/* Visibility toggle row */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '0.5px solid #D5D2C9' }}>
          <span className="text-[14.5px] tracking-tight2">{L.status_on}</span>
          <div className="relative w-11 h-6 bg-ink" style={{ borderRadius: 999 }}>
            <span className="absolute top-0.5 right-0.5 w-5 h-5 bg-paper" style={{ borderRadius: 999 }}></span>
          </div>
        </div>

        {/* Name */}
        <div className="px-5 py-5" style={{ borderBottom: '0.5px solid #D5D2C9' }}>
          <span className="label text-mute">Name</span>
          <div className="mt-2 text-[24px] tracking-display font-medium leading-tight">{p.name}</div>
          <div className="mt-1 text-[13px] text-mute tabular">{p.city}, {p.postcode}</div>
        </div>

        {/* Bio (editable card) */}
        <div className="px-5 pt-5">
          <div className="flex items-baseline justify-between">
            <span className="label text-mute">{L.bio}</span>
            <button className="label-sm text-ink press">{lang==='fr'?'Modifier':lang==='en'?'Edit':'Bearbeiten'}</button>
          </div>
          <p className="mt-3 text-[14.5px] leading-[1.6] text-ink/85">{bio}</p>
        </div>

        {/* Specialties as chips */}
        <div className="px-5 pt-7">
          <span className="label text-mute">{L.specialties}</span>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              lang==='fr'?'Mariage':lang==='en'?'Wedding':'Hochzeit',
              'Editorial',
              lang==='fr'?'Portrait':'Porträt',
            ].map((s, i) => (
              <span key={i} className="label-sm tabular px-3 py-1.5"
                    style={{ background: 'var(--ink)', color: 'var(--paper)' }}>{s}</span>
            ))}
            <button className="label-sm tabular px-3 py-1.5 flex items-center gap-1.5"
                    style={{ border: '0.5px dashed #B8B5AC', color: 'var(--mute)' }}>
              <IcPlus size={11}/> {lang==='fr'?'Ajouter':lang==='en'?'Add':'Hinzufügen'}
            </button>
          </div>
        </div>

        {/* Spec list */}
        <div className="px-5 mt-7" style={{ borderTop: '0.5px solid #D5D2C9' }}>
          <div className="flex items-baseline justify-between py-3.5" style={{ borderBottom: '0.5px solid #D5D2C9' }}>
            <span className="label text-mute">{L.gear}</span>
            <span className="tabular text-[14.5px] tracking-tight2 text-ink text-right">{gear}</span>
          </div>
          <div className="flex items-baseline justify-between py-3.5" style={{ borderBottom: '0.5px solid #D5D2C9' }}>
            <span className="label text-mute">{L.langs}</span>
            <span className="tabular text-[14.5px] tracking-tight2 text-ink text-right">{p.languages}</span>
          </div>
          <div className="flex items-baseline justify-between py-3.5">
            <span className="label text-mute">{L.base}</span>
            <span className="tabular text-[14.5px] tracking-tight2 text-ink text-right">{CHF(p.fromPrice)} / {{de:'halber Tag', fr:'demi-jour', en:'half day'}[lang]}</span>
          </div>
        </div>

        {/* Portfolio */}
        <div className="px-5 mt-9">
          <div className="flex items-baseline justify-between">
            <span className="label text-mute">{L.portfolio}</span>
            <span className="label-sm tabular text-mute">06 / 24</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {p.portfolio.slice(0,5).map((src, i) => (
              <div key={i} className="bg-chip relative overflow-hidden" style={{ aspectRatio: '3/4' }}>
                <img src={src} className="w-full h-full object-cover" alt=""/>
                <span className="absolute top-1.5 left-1.5 w-5 h-5 bg-paper label-sm flex items-center justify-center tabular"
                      style={{ border: '0.5px solid #D5D2C9' }}>
                  {String(i+1).padStart(2,'0')}
                </span>
              </div>
            ))}
            <button className="flex flex-col items-center justify-center gap-1.5 press"
                    style={{ aspectRatio: '3/4', border: '0.5px dashed #B8B5AC' }}>
              <IcPlus size={18} className="text-mute"/>
              <span className="label-sm text-mute">{lang==='fr'?'Ajouter':lang==='en'?'Add':'Hinzufügen'}</span>
            </button>
          </div>
        </div>

        {/* Availability mini */}
        <div className="px-5 mt-9">
          <div className="flex items-baseline justify-between">
            <span className="label text-mute">{L.avail}</span>
            <span className="label-sm tabular text-mute">{lang==='fr'?'Août 2026':lang==='en'?'August 2026':'August 2026'}</span>
          </div>
          <div className="mt-3 grid grid-cols-7" style={{ border: '0.5px solid #D5D2C9' }}>
            {['M','D','M','D','F','S','S'].map((d, i) => (
              <div key={`h${i}`} className="label-sm text-mute text-center py-2 tabular"
                   style={{ borderBottom: '0.5px solid #D5D2C9', borderRight: i < 6 ? '0.5px solid #D5D2C9' : 'none' }}>{d}</div>
            ))}
            {Array.from({length: 28}).map((_, i) => {
              const d = i + 1;
              const blocked = [3, 14, 15, 16, 22].includes(d);
              return (
                <div key={i} className="aspect-square flex items-center justify-center relative"
                     style={{
                       borderRight: (i % 7 !== 6) ? '0.5px solid #E5E2DB' : 'none',
                       borderTop: (i >= 7) ? '0.5px solid #E5E2DB' : 'none',
                       background: blocked ? 'repeating-linear-gradient(135deg, transparent 0 4px, #D5D2C9 4px 5px)' : 'transparent',
                     }}>
                  <span className="tabular text-[11px] text-ink">{d}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2.5 text-[11.5px] leading-[1.4] text-mute">
            {{ de: 'Schraffierte Tage sind nicht verfügbar. Tippe zum Umschalten.',
               fr: 'Jours hachurés indisponibles. Tape pour basculer.',
               en: 'Hatched days unavailable. Tap to toggle.' }[lang]}
          </p>
        </div>

        <div className="h-10"></div>
      </div>

      <div className="absolute left-0 right-0 bottom-0 bg-paper px-5 pt-3 pb-4"
           style={{ borderTop: '0.5px solid #D5D2C9' }}>
        <button className="w-full h-12 bg-ink text-paper press flex items-center justify-center gap-2">
          <span className="text-[15px] tracking-tight2 font-medium">{L.save}</span>
          <IcCheck size={16} stroke={1.75}/>
        </button>
      </div>
    </div>
  );
};

// ---------- Photographer · Earnings & Bookings (P8) ----------

const PhotogEarnings = ({ go }) => {
  const { t, lang } = useT();

  const heading = { de: 'Buchungen & Honorare', fr: 'Réservations & honoraires', en: 'Bookings & earnings' }[lang];

  const months = [
    { m: 'JAN', value: 8400  },
    { m: 'FEB', value: 5200  },
    { m: 'MÄR', value: 9800  },
    { m: 'APR', value: 12200 },
    { m: 'MAI', value: 7100  },
    { m: 'JUN', value: 14400 },
  ];
  if (lang === 'fr') months[2].m = 'MAR';
  if (lang === 'en') months[2].m = 'MAR';
  if (lang === 'en') months[4].m = 'MAY';
  const max = Math.max(...months.map(x => x.value));

  const upcoming = [
    { id: 'b1', title_de: 'Porträts — IMD Lausanne', title_fr: 'Portraits — IMD Lausanne', title_en: 'Portraits — IMD Lausanne', date: '02.06.2026', client: 'EPFL Comms',     price: 2200, status: 'confirmed' },
    { id: 'b2', title_de: 'Editorial — On Running',  title_fr: 'Editorial — On Running',   title_en: 'Editorial — On Running',   date: '12.06.2026', client: 'On AG',         price: 8400, status: 'confirmed' },
    { id: 'b3', title_de: 'Hochzeit in Zermatt',     title_fr: 'Mariage à Zermatt',        title_en: 'Wedding in Zermatt',       date: '14.08.2026', client: 'Lena & Tobias K.', price: 3800, status: 'confirmed' },
  ];
  const past = [
    { id: 'p1', title_de: 'Vernissage — Kunsthaus Aarau', title_fr: 'Vernissage — Kunsthaus Aarau', title_en: 'Opening — Kunsthaus Aarau', date: '21.04.2026', client: 'Kunsthaus Aarau', price: 2200, paid: true },
    { id: 'p2', title_de: 'Editorial — Republik Magazin', title_fr: 'Editorial — Republik',          title_en: 'Editorial — Republik',       date: '11.03.2026', client: 'Republik AG',    price: 4200, paid: true },
    { id: 'p3', title_de: 'Architektur — Roche Tower',    title_fr: 'Architecture — Roche Tower',    title_en: 'Architecture — Roche Tower', date: '04.02.2026', client: 'Roche',          price: 3800, paid: false },
  ];

  const lf = (o, k) => o[`${k}_${lang}`] || o[`${k}_de`] || o[k];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar left={<Wordmark />} right={<NotifyButton dot={false}/>} />

      <div className="scroll-area overflow-y-auto flex-1">
        <div className="px-5 pt-8">
          <h1 className="text-[36px] leading-[1.04] tracking-display font-medium text-ink">
            {heading}
          </h1>
        </div>

        {/* Earnings */}
        <div className="px-5 pt-7">
          <div className="flex items-baseline justify-between">
            <span className="label text-mute">
              {{ de: 'Diesen Monat', fr: 'Ce mois-ci', en: 'This month' }[lang]}
            </span>
            <span className="label-sm tabular text-mute">JUN 2026</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-[48px] font-medium tracking-display tabular leading-none text-ink">14'400</span>
            <span className="text-[16px] text-mute tabular">CHF</span>
          </div>
          <div className="mt-1.5 label-sm tabular text-accent">
            {{ de: '+ 26 % gegenüber Mai', fr: '+ 26 % vs. mai', en: '+ 26 % vs May' }[lang]}
          </div>

          {/* bar chart */}
          <div className="mt-7 flex items-end justify-between gap-2.5" style={{ height: 110 }}>
            {months.map((m, i) => {
              const h = (m.value / max) * 100;
              const active = i === months.length - 1;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full" style={{
                    height: `${h}%`, minHeight: 8,
                    background: active ? 'var(--accent)' : 'var(--ink)',
                  }}></div>
                  <span className="label-sm text-mute tabular">{m.m}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming bookings */}
        <SectionHeader num={1} title={
          { de: 'Anstehende Buchungen', fr: 'Réservations à venir', en: 'Upcoming bookings' }[lang]
        } />

        <div className="px-5">
          {upcoming.map((u, i) => (
            <div key={u.id} className="py-4 flex items-baseline gap-5"
                 style={{ borderBottom: i < upcoming.length - 1 ? '0.5px solid #D5D2C9' : 'none' }}>
              <div className="text-right shrink-0" style={{ width: 56 }}>
                <div className="tabular text-[19px] font-medium tracking-display leading-none text-ink">{u.date.split('.')[0]}.{u.date.split('.')[1]}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14.5px] font-medium tracking-tight2 truncate">{lf(u, 'title')}</div>
                <div className="label-sm text-mute mt-1 tabular">{u.client}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="tabular text-[15px] font-medium tracking-tight2 text-ink">{CHF(u.price)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Past bookings */}
        <SectionHeader num={2} title={
          { de: 'Vergangene Buchungen', fr: 'Réservations passées', en: 'Past bookings' }[lang]
        } />

        <div className="px-5 pb-12">
          {past.map((u, i) => (
            <div key={u.id} className="py-4 flex items-baseline gap-5"
                 style={{ borderBottom: i < past.length - 1 ? '0.5px solid #D5D2C9' : 'none' }}>
              <div className="text-right shrink-0" style={{ width: 56 }}>
                <div className="tabular text-[15px] tracking-tight2 leading-none text-mute">{u.date}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14.5px] tracking-tight2 truncate text-ink">{lf(u, 'title')}</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="label-sm text-mute tabular">{u.client}</span>
                  <span className="label-sm tabular" style={{ color: u.paid ? 'var(--ink)' : 'var(--accent)' }}>
                    · {u.paid
                        ? { de:'BEZAHLT', fr:'PAYÉ', en:'PAID' }[lang]
                        : { de:'AUSSTEHEND', fr:'EN ATTENTE', en:'OUTSTANDING' }[lang]}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="tabular text-[14.5px] text-ink">{CHF(u.price)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------- Client · Profile (C8) ----------

const ClientProfile = ({ go }) => {
  const { t, lang } = useT();

  const L = {
    de: { name:'Marko Petrović', sub:'Mitglied seit Januar 2024', bookings:'Buchungen', spent:'Ausgaben', reviews:'Bewertungen',
          row_personal:'Persönliche Angaben', row_billing:'Zahlung & Rechnung', row_bookings:'Vergangene Buchungen', row_reviews:'Hinterlassene Bewertungen',
          row_notif:'Mitteilungen', row_lang:'Sprache', row_help:'Hilfe & Support', row_logout:'Abmelden',
          switch_title:'Auch als Fotograf:in tätig?', switch_sub:'Erstelle ein zweites Profil und wechsle jederzeit zwischen den Rollen.', switch_cta:'Fotograf:innen-Konto erstellen' },
    fr: { name:'Marko Petrović', sub:'Membre depuis janvier 2024', bookings:'Réservations', spent:'Dépenses', reviews:'Avis',
          row_personal:'Informations personnelles', row_billing:'Paiement & facturation', row_bookings:'Réservations passées', row_reviews:'Avis laissés',
          row_notif:'Notifications', row_lang:'Langue', row_help:'Aide & support', row_logout:'Déconnexion',
          switch_title:'Aussi photographe ?', switch_sub:'Crée un second profil et bascule à tout moment.', switch_cta:'Créer un compte photographe' },
    en: { name:'Marko Petrović', sub:'Member since January 2024', bookings:'Bookings', spent:'Spent', reviews:'Reviews',
          row_personal:'Personal info', row_billing:'Payment & billing', row_bookings:'Past bookings', row_reviews:'Reviews given',
          row_notif:'Notifications', row_lang:'Language', row_help:'Help & support', row_logout:'Sign out',
          switch_title:'Also a photographer?', switch_sub:'Create a second profile and switch roles anytime.', switch_cta:'Create photographer account' },
  }[lang];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar left={<Wordmark />} right={<button className="w-9 h-9 -mr-2 flex items-center justify-center press"><IcSettings size={18}/></button>} />

      <div className="scroll-area overflow-y-auto flex-1">
        {/* Identity */}
        <div className="px-5 pt-8 pb-6 flex items-start gap-4">
          <Avatar src={PHOTOGRAPHERS[2].avatar} size={72} />
          <div className="flex-1 min-w-0">
            <h1 className="text-[24px] tracking-display font-medium leading-tight">{L.name}</h1>
            <div className="text-[12.5px] text-mute mt-1 tabular">{L.sub}</div>
            <button className="mt-3 label-sm flex items-center gap-1 press text-ink">
              <IcEdit size={12}/> {lang==='fr'?'Modifier':lang==='en'?'Edit':'Bearbeiten'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="px-5">
          <div className="grid grid-cols-3" style={{ borderTop: '0.5px solid #D5D2C9', borderBottom: '0.5px solid #D5D2C9' }}>
            {[
              { v: '08',         l: L.bookings },
              { v: "CHF 23'600", l: L.spent },
              { v: '07',         l: L.reviews },
            ].map((s, i, a) => (
              <div key={i} className="py-4" style={{ borderRight: i < a.length - 1 ? '0.5px solid #D5D2C9' : 'none', paddingLeft: i === 0 ? 0 : 14, paddingRight: 8 }}>
                <div className="tabular text-[20px] font-medium tracking-display text-ink leading-none whitespace-nowrap">{s.v}</div>
                <div className="mt-2 label-sm text-mute" style={{ lineHeight: 1.3 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Menu list */}
        <div className="px-5 pt-2">
          {[
            { i: IcUser,    l: L.row_personal },
            { i: IcBriefcase, l: L.row_billing },
            { i: IcCal,     l: L.row_bookings },
            { i: IcStar,    l: L.row_reviews },
          ].map(({ i: I, l }, idx, arr) => (
            <button key={l} className="w-full flex items-center gap-4 py-4 press text-left"
                    style={{ borderBottom: idx < arr.length - 1 ? '0.5px solid #D5D2C9' : 'none' }}>
              <I size={18} className="text-ink shrink-0"/>
              <span className="flex-1 text-[14.5px] tracking-tight2">{l}</span>
              <IcChevronRight size={16} className="text-mute"/>
            </button>
          ))}
        </div>

        {/* Switch to photographer card */}
        <div className="mx-5 mt-7 p-5" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
          <span className="label text-paper/55">{lang==='fr'?'Double rôle':lang==='en'?'Dual role':'Doppelrolle'}</span>
          <h3 className="mt-2 text-[18px] tracking-tight2 font-medium leading-snug">{L.switch_title}</h3>
          <p className="mt-2 text-[13px] text-paper/70 leading-[1.5]">{L.switch_sub}</p>
          <button className="mt-4 h-10 px-4 bg-paper text-ink press inline-flex items-center gap-2 text-[13px] tracking-tight2 font-medium">
            {L.switch_cta} <IcArrowRight size={14} />
          </button>
        </div>

        {/* Settings list */}
        <div className="px-5 mt-7">
          {[
            { i: IcBell,    l: L.row_notif,  rt: 'EIN' },
            { i: IcGlobe,   l: L.row_lang,   rt: lang==='fr'?'Français':lang==='en'?'English':'Deutsch' },
            { i: IcSettings,l: L.row_help },
          ].map(({ i: I, l, rt }, idx, arr) => (
            <button key={l} className="w-full flex items-center gap-4 py-4 press text-left"
                    style={{ borderTop: idx === 0 ? '0.5px solid #D5D2C9' : 'none',
                             borderBottom: '0.5px solid #D5D2C9' }}>
              <I size={18} className="text-ink shrink-0"/>
              <span className="flex-1 text-[14.5px] tracking-tight2">{l}</span>
              {rt && <span className="label-sm tabular text-mute">{rt}</span>}
              <IcChevronRight size={16} className="text-mute"/>
            </button>
          ))}
        </div>

        {/* Logout */}
        <div className="px-5 pt-6 pb-10">
          <button className="flex items-center gap-3 press text-mute">
            <IcLogout size={16}/>
            <span className="text-[13.5px] tracking-tight2">{L.row_logout}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------- Auth · Role Picker ----------

const RolePicker = ({ go }) => {
  const { lang } = useT();
  const [pick, setPick] = pUseState(null);

  const L = {
    de: { title:'Was möchtest du machen?', sub:'Du kannst später eine zweite Rolle hinzufügen.',
          c_title:'Ich möchte buchen',  c_sub:'Stelle Aufträge ein und arbeite mit Fotograf:innen für deine Projekte.',
          p_title:'Ich möchte arbeiten', p_sub:'Finde Aufträge, reiche Angebote ein und baue dein Portfolio auf.',
          continue:'Weiter' },
    fr: { title:'Que veux-tu faire ?', sub:'Tu peux ajouter un second rôle plus tard.',
          c_title:'Je veux engager',  c_sub:'Publie des missions et collabore avec des photographes.',
          p_title:'Je veux travailler', p_sub:'Trouve des missions, soumets des offres, construis ton portfolio.',
          continue:'Continuer' },
    en: { title:'What would you like to do?', sub:'You can add a second role later.',
          c_title:'I want to hire',  c_sub:'Post briefs and work with photographers for your projects.',
          p_title:'I want to work',  p_sub:'Find briefs, submit offers, build your portfolio.',
          continue:'Continue' },
  }[lang];

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <div className="sticky top-0 z-30 bg-paper">
        <div className="px-5 h-14 flex items-center justify-between" style={{ borderBottom: '0.5px solid #E5E2DB' }}>
          <Wordmark />
          <span className="label tabular text-mute">01 / 03</span>
        </div>
      </div>

      <div className="scroll-area overflow-y-auto flex-1">
        <div className="px-5 pt-12">
          <h1 className="text-[36px] leading-[1.04] tracking-display font-medium text-ink max-w-[320px]">
            {L.title}
          </h1>
          <p className="mt-3 text-[14px] leading-[1.55] text-mute max-w-[300px]">{L.sub}</p>
        </div>

        <div className="px-5 pt-8 flex flex-col gap-3 pb-32">
          {[
            { id: 'client',       title: L.c_title, sub: L.c_sub, icon: IcPlus,    img: SHOOTS[0].image },
            { id: 'photographer', title: L.p_title, sub: L.p_sub, icon: IcCamera,  img: PHOTOGRAPHERS[0].hero },
          ].map((opt) => {
            const sel = pick === opt.id;
            return (
              <button key={opt.id} onClick={() => setPick(opt.id)}
                      className={`text-left press relative ${sel ? 'opt-selected' : ''}`}
                      style={{ background: sel ? 'var(--surface)' : 'transparent',
                               border: sel ? '1px solid #0A0A0A' : '0.5px solid #D5D2C9' }}>
                <div className="flex">
                  <div className="bg-chip overflow-hidden shrink-0" style={{ width: 120, aspectRatio: '3/4' }}>
                    <img src={opt.img} className="w-full h-full object-cover img-gray" alt=""/>
                  </div>
                  <div className="flex-1 p-4 flex flex-col">
                    <opt.icon size={18} className="text-ink"/>
                    <div className="mt-3 text-[17px] tracking-tight2 font-medium text-ink leading-tight">
                      {opt.title}
                    </div>
                    <div className="mt-2 text-[12.5px] text-mute leading-[1.45]">{opt.sub}</div>
                    {sel && (
                      <div className="mt-auto pt-3 label-sm tabular text-accent flex items-center gap-1.5">
                        <IcCheck size={12} stroke={2}/> {lang==='fr'?'Sélectionné':lang==='en'?'Selected':'Ausgewählt'}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="absolute left-0 right-0 bottom-0 bg-paper px-5 pt-3 pb-5 flex justify-end"
           style={{ borderTop: '0.5px solid #D5D2C9' }}>
        <button className="h-12 px-7 press flex items-center gap-2"
                style={{ background: 'var(--ink)', color: 'var(--paper)', opacity: pick ? 1 : 0.35 }}>
          <span className="text-[14.5px] tracking-tight2 font-medium">{L.continue}</span>
          <IcArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

Object.assign(window, {
  PhotogHome, PhotogMyBids, PhotogProfileEdit, PhotogEarnings,
  ClientProfile, RolePicker,
});
