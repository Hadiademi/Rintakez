// Tri-lingual dictionary. DE is primary; FR + EN are translations.
// Microcopy is Swiss-direct: short, factual, no marketing speak.

const DICT = {
  de: {
    // top bar
    notifications: 'Mitteilungen',

    // greetings
    hello_morning: 'Guten Morgen, Marko.',
    hello_day:     'Guten Tag, Marko.',
    greeting_sub:  'Drei neue Angebote für deinen Shoot in Zermatt.',

    // primary
    new_job_title: 'Neuen Auftrag erstellen',
    new_job_desc:  'Brief in fünf Schritten. Erste Angebote meist innerhalb von vier Stunden.',

    // sections
    sec_your_jobs:  'Deine Aufträge',
    sec_recommend:  'Empfohlene Kreative',
    sec_offers:     'Angebote',
    sec_brief:      'Briefing',
    sec_client:     'Auftraggeber',

    // browse
    browse_title: 'Offene Aufträge',
    browse_count: (n) => `${n} verfügbar`,
    chip_all: 'Alle', chip_wedding: 'Hochzeit', chip_event: 'Event',
    chip_portrait: 'Porträt', chip_commercial: 'Commercial', chip_week: 'Diese Woche',
    sort: 'Sortieren', filter: 'Filter',
    offers_n: (n) => `${String(n).padStart(2,'0')} Angebote`,
    posted_ago: (s) => `vor ${s}`,

    // detail
    status_open: 'Offen',
    spec_date:  'Datum',
    spec_loc:   'Ort',
    spec_dur:   'Dauer',
    spec_budget:'Budget',
    spec_type:  'Art',
    member_since: (y) => `Mitglied seit ${y}`,
    submit_offer: 'Angebot abgeben',
    budget_hint: (a,b) => `Budget ${a} – ${b}`,
    view_profile: 'Profil ansehen',

    // sheet
    your_price:   'Dein Preis',
    your_message: 'Nachricht an den Kunden',
    available_from: 'Verfügbar ab',
    send_offer: 'Angebot senden',
    customer_budget: (a,b) => `Budget des Kunden: ${a} – ${b}`,
    char_count: (n,max) => `${n} / ${max}`,
    message_placeholder: 'Worauf legst du den Fokus? Wie ist dein Stil?',

    // profile
    available: 'Verfügbar',
    booked_until: (m) => `Gebucht bis ${m}`,
    responds_in: (h) => `Antwortet meist innerhalb ${h} Std`,
    tab_about: 'Über', tab_portfolio: 'Portfolio', tab_reviews: 'Bewertungen',
    spec_specialization: 'Spezialisierung',
    spec_gear: 'Ausrüstung',
    spec_langs: 'Sprachen',
    spec_from: 'Ab',
    half_day: 'halber Tag',
    send_request: 'Anfrage senden',

    // create
    step_of: (a,b) => `${String(a).padStart(2,'0')} / ${String(b).padStart(2,'0')}`,
    q_type: 'Welche Art von Shoot ist es?',
    back: 'Zurück', next: 'Weiter',

    // inbox
    inbox_title: 'Nachrichten',
    tab_all: 'Alle', tab_unread: 'Ungelesen', tab_booked: 'Gebucht',

    // nav
    nav_home: 'Home', nav_search: 'Suchen', nav_create: 'Erstellen',
    nav_inbox: 'Nachrichten', nav_profile: 'Profil',
    nav_jobs: 'Aufträge', nav_bids: 'Angebote',

    // misc
    hours: 'Std',
    duration_h: (h) => `${h} STD`,
    delivery_weeks: (w) => `Lieferung ${w} Wochen`,
    empty_offers: 'Keine Angebote bisher. Die meisten Aufträge erhalten ihr erstes Angebot innerhalb von vier Stunden.',
    open_to_offers: (n) => `Offen · ${String(n).padStart(2,'0')} Angebote`,
  },

  fr: {
    notifications: 'Notifications',
    hello_morning: 'Bonjour, Marko.',
    hello_day:     'Bonjour, Marko.',
    greeting_sub:  'Trois nouvelles offres pour ton shoot à Zermatt.',
    new_job_title: 'Créer une nouvelle mission',
    new_job_desc:  'Brief en cinq étapes. Premières offres en moins de quatre heures.',
    sec_your_jobs: 'Tes missions',
    sec_recommend: 'Créatifs recommandés',
    sec_offers:    'Offres',
    sec_brief:     'Briefing',
    sec_client:    'Mandant',
    browse_title:  'Missions ouvertes',
    browse_count:  (n) => `${n} disponibles`,
    chip_all:'Toutes', chip_wedding:'Mariage', chip_event:'Événement',
    chip_portrait:'Portrait', chip_commercial:'Commercial', chip_week:'Cette semaine',
    sort:'Trier', filter:'Filtrer',
    offers_n: (n) => `${String(n).padStart(2,'0')} offres`,
    posted_ago: (s) => `il y a ${s}`,
    status_open:'Ouvert',
    spec_date:'Date', spec_loc:'Lieu', spec_dur:'Durée', spec_budget:'Budget', spec_type:'Type',
    member_since: (y) => `Membre depuis ${y}`,
    submit_offer:'Soumettre une offre',
    budget_hint:(a,b)=>`Budget ${a} – ${b}`,
    view_profile:'Voir le profil',
    your_price:'Ton prix',
    your_message:'Message au client',
    available_from:'Disponible dès',
    send_offer:'Envoyer l\u2019offre',
    customer_budget: (a,b)=>`Budget du client: ${a} – ${b}`,
    char_count: (n,m)=>`${n} / ${m}`,
    message_placeholder:'Quel est ton angle ? Décris ton approche.',
    available:'Disponible',
    booked_until:(m)=>`Réservé jusqu\u2019en ${m}`,
    responds_in: (h)=>`Répond en moins de ${h}h`,
    tab_about:'À propos', tab_portfolio:'Portfolio', tab_reviews:'Avis',
    spec_specialization:'Spécialisation', spec_gear:'Équipement', spec_langs:'Langues', spec_from:'Dès',
    half_day:'demi-journée',
    send_request:'Envoyer une demande',
    step_of:(a,b)=>`${String(a).padStart(2,'0')} / ${String(b).padStart(2,'0')}`,
    q_type:'Quel type de shoot ?',
    back:'Retour', next:'Continuer',
    inbox_title:'Messages', tab_all:'Tous', tab_unread:'Non lus', tab_booked:'Réservés',
    nav_home:'Accueil', nav_search:'Recherche', nav_create:'Créer', nav_inbox:'Messages', nav_profile:'Profil',
    nav_jobs: 'Missions', nav_bids: 'Offres',
    hours:'h',
    duration_h:(h)=>`${h} H`,
    delivery_weeks:(w)=>`Livraison ${w} semaines`,
    empty_offers:'Aucune offre pour l\u2019instant. La plupart des missions reçoivent une première offre en moins de quatre heures.',
    open_to_offers:(n)=>`Ouvert · ${String(n).padStart(2,'0')} offres`,
  },

  en: {
    notifications: 'Notifications',
    hello_morning: 'Good morning, Marko.',
    hello_day:     'Good afternoon, Marko.',
    greeting_sub:  'Three new offers for your Zermatt shoot.',
    new_job_title: 'Create a new brief',
    new_job_desc:  'Five steps. Most briefs get a first offer within four hours.',
    sec_your_jobs: 'Your briefs',
    sec_recommend: 'Recommended creatives',
    sec_offers:    'Offers',
    sec_brief:     'Briefing',
    sec_client:    'Client',
    browse_title:  'Open briefs',
    browse_count:  (n) => `${n} available`,
    chip_all:'All', chip_wedding:'Wedding', chip_event:'Event',
    chip_portrait:'Portrait', chip_commercial:'Commercial', chip_week:'This week',
    sort:'Sort', filter:'Filter',
    offers_n: (n) => `${String(n).padStart(2,'0')} offers`,
    posted_ago: (s) => `${s} ago`,
    status_open:'Open',
    spec_date:'Date', spec_loc:'Location', spec_dur:'Duration', spec_budget:'Budget', spec_type:'Type',
    member_since:(y)=>`Member since ${y}`,
    submit_offer:'Submit offer',
    budget_hint:(a,b)=>`Budget ${a} – ${b}`,
    view_profile:'View profile',
    your_price:'Your price',
    your_message:'Message to client',
    available_from:'Available from',
    send_offer:'Send offer',
    customer_budget: (a,b)=>`Client budget: ${a} – ${b}`,
    char_count:(n,m)=>`${n} / ${m}`,
    message_placeholder:'What\u2019s your angle? Briefly describe your approach.',
    available:'Available',
    booked_until:(m)=>`Booked until ${m}`,
    responds_in:(h)=>`Replies within ${h}h`,
    tab_about:'About', tab_portfolio:'Portfolio', tab_reviews:'Reviews',
    spec_specialization:'Specialisation', spec_gear:'Gear', spec_langs:'Languages', spec_from:'From',
    half_day:'half day',
    send_request:'Send request',
    step_of:(a,b)=>`${String(a).padStart(2,'0')} / ${String(b).padStart(2,'0')}`,
    q_type:'What kind of shoot?',
    back:'Back', next:'Continue',
    inbox_title:'Messages', tab_all:'All', tab_unread:'Unread', tab_booked:'Booked',
    nav_home:'Home', nav_search:'Search', nav_create:'Create', nav_inbox:'Messages', nav_profile:'Profile',
    nav_jobs: 'Briefs', nav_bids: 'Offers',
    hours:'h',
    duration_h:(h)=>`${h} H`,
    delivery_weeks:(w)=>`${w}-week delivery`,
    empty_offers:'No offers yet. Most briefs get their first offer within four hours.',
    open_to_offers:(n)=>`Open · ${String(n).padStart(2,'0')} offers`,
  },
};

const I18nCtx = React.createContext({ lang: 'de', t: DICT.de });

const I18nProvider = ({ lang, children }) => {
  const t = DICT[lang] || DICT.de;
  return <I18nCtx.Provider value={{ lang, t }}>{children}</I18nCtx.Provider>;
};

const useT = () => React.useContext(I18nCtx);

Object.assign(window, { DICT, I18nCtx, I18nProvider, useT });
