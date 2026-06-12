// Sample data — Swiss-flavored, real photographers' names invented, real locations.
// Image URLs use Unsplash CDN IDs picked to evoke alpine / studio / editorial work.

// Helper: Swiss number formatting — "3'200" with apostrophe thousands separator.
const chf = (n) => {
  const s = Math.round(n).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
};
const CHF = (n) => `CHF ${chf(n)}`;
const CHFRange = (a, b) => `CHF ${chf(a)} \u2013 ${chf(b)}`;

// Curated Unsplash photo IDs — alpine, studio, documentary
const UN = (id, w = 800, h = 600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

const SHOOTS = [
  {
    id: 's1',
    title: 'Hochzeit in Zermatt',
    title_fr: 'Mariage à Zermatt',
    title_en: 'Wedding in Zermatt',
    location: 'Zermatt',
    postcode: '3920 VS',
    date: '14.08.2026',
    duration: 10,
    budgetLo: 3200,
    budgetHi: 4500,
    type: 'Hochzeit',
    type_fr: 'Mariage', type_en: 'Wedding',
    offers: 7,
    posted: '2 Std',
    posted_fr: '2 h', posted_en: '2h',
    image: UN('1519741497674-611481863552', 900, 600),
    brief:
      'Trauung um 14:30 in der Bergkapelle, anschliessend Apéro auf der Terrasse mit Matterhorn-Blick. Wir suchen einen dokumentarischen Stil — ehrlich, ruhig, keine gestellten Gruppenbilder ausser der einen Familienreihe.',
    brief_fr:
      'Cérémonie à 14:30 à la chapelle de montagne, puis apéro en terrasse face au Cervin. Style documentaire — honnête, calme, sans poses sauf une photo de famille.',
    brief_en:
      'Ceremony at 14:30 in the mountain chapel, apéro on the terrace with Matterhorn view. Documentary style — honest, quiet, no posed groups except one family row.',
    client: { name: 'Lena & Tobias K.', since: 2024 },
  },
  {
    id: 's2',
    title: 'Editorial — Vitra Sommerkollektion',
    title_fr: 'Editorial — Collection été Vitra',
    title_en: 'Editorial — Vitra Summer Collection',
    location: 'Basel', postcode: '4051 BS',
    date: '03.06.2026', duration: 6,
    budgetLo: 4800, budgetHi: 6200,
    type: 'Commercial', type_fr: 'Commercial', type_en: 'Commercial',
    offers: 12, posted: '5 Std', posted_fr: '5 h', posted_en: '5h',
    image: UN('1556228720-195a672e8a03', 900, 600),
    brief: 'Indoor-Studio, klares Tageslicht, 12 Stühle, ein Sofa. Aesthetik wie der gedruckte Katalog 2024.',
    brief_fr: 'Studio intérieur, lumière du jour, 12 chaises, un canapé. Esthétique du catalogue imprimé 2024.',
    brief_en: 'Indoor studio, clean daylight, 12 chairs, one sofa. Aesthetic of the 2024 print catalogue.',
    client: { name: 'Vitra AG', since: 2022 },
  },
  {
    id: 's3',
    title: 'Porträtserie für Forschungsteam',
    title_fr: 'Série portrait — équipe recherche',
    title_en: 'Portrait series for research team',
    location: 'Lausanne', postcode: '1015 VD',
    date: '21.05.2026', duration: 4,
    budgetLo: 1800, budgetHi: 2400,
    type: 'Porträt', type_fr: 'Portrait', type_en: 'Portrait',
    offers: 4, posted: '8 Std', posted_fr: '8 h', posted_en: '8h',
    image: UN('1545167622-3a6ac756afa4', 900, 600),
    brief: 'EPFL Labor. 18 Personen, je 5–7 Minuten. Schwarzweiss bevorzugt. Keine Lobby-Korporativ-Optik.',
    brief_fr: 'Laboratoire EPFL. 18 personnes, 5–7 min chacune. Noir et blanc préféré.',
    brief_en: 'EPFL lab. 18 people, 5–7 min each. Black & white preferred.',
    client: { name: 'EPFL Comms', since: 2023 },
  },
  {
    id: 's4',
    title: 'Architektur — Wohnüberbauung Oerlikon',
    title_fr: 'Architecture — lotissement Oerlikon',
    title_en: 'Architecture — Oerlikon housing',
    location: 'Zürich', postcode: '8050 ZH',
    date: '02.07.2026', duration: 8,
    budgetLo: 2600, budgetHi: 3400,
    type: 'Architektur', type_fr: 'Architecture', type_en: 'Architecture',
    offers: 9, posted: '1 Tag', posted_fr: '1 j', posted_en: '1d',
    image: UN('1486325212027-8081e485255e', 900, 600),
    brief: 'Aussen + ausgewählte Innenräume. Goldene Stunde gewünscht, Stativ Pflicht.',
    brief_fr: 'Extérieur + intérieurs choisis. Heure dorée souhaitée.',
    brief_en: 'Exterior + selected interiors. Golden hour preferred.',
    client: { name: 'pool Architekten', since: 2021 },
  },
  {
    id: 's5',
    title: 'On Running — Trail-Kampagne',
    title_fr: 'On Running — campagne trail',
    title_en: 'On Running — Trail Campaign',
    location: 'Engelberg', postcode: '6390 OW',
    date: '28.06.2026', duration: 12,
    budgetLo: 7500, budgetHi: 9500,
    type: 'Commercial', type_fr: 'Commercial', type_en: 'Commercial',
    offers: 18, posted: '6 Std', posted_fr: '6 h', posted_en: '6h',
    image: UN('1551632811-561732d1e306', 900, 600),
    brief: 'Zwei Athleten, alpiner Trail, Bewegung. Crew vor Ort. Drohne erwünscht.',
    brief_fr: 'Deux athlètes, trail alpin, mouvement. Équipe sur place. Drone bienvenu.',
    brief_en: 'Two athletes, alpine trail, motion. Crew on site. Drone welcome.',
    client: { name: 'On AG', since: 2020 },
  },
];

const PHOTOGRAPHERS = [
  {
    id: 'p1', name: 'Nora Bachmann', city: 'Zürich', postcode: '8001',
    specialty: 'Hochzeit, Editorial', rating: 4.9, reviews: 47,
    avatar: UN('1438761681033-6461ffad8d80', 200, 200),
    hero: UN('1554080353-a576cf803bda', 1200, 900),
    status: 'available', responds: 2,
    bio_de: 'Ich fotografiere seit 2014. Aus dem Welschland nach Zürich gezogen, jetzt zwischen Bergen und Stadt. Mein Stil ist ruhig und dokumentarisch — ich glaube nicht an perfekte Bilder, ich glaube an wahre Momente.',
    bio_fr: 'Je photographie depuis 2014. Originaire de Romandie, installée à Zurich. Style calme, documentaire — je ne crois pas aux images parfaites, je crois aux vrais moments.',
    bio_en: 'Photographing since 2014. From the French part, now Zürich-based. Calm, documentary style — I don\u2019t believe in perfect images, I believe in true moments.',
    gear: 'Sony A7IV, Profi-Lichtset', gear_fr: 'Sony A7IV, kit lumière pro', gear_en: 'Sony A7IV, pro lighting kit',
    languages: 'DE, FR, EN',
    fromPrice: 2800,
    portfolio: [
      UN('1519741497674-611481863552', 600, 800),
      UN('1545167622-3a6ac756afa4', 600, 800),
      UN('1494790108377-be9c29b29330', 600, 800),
      UN('1517694712202-14dd9538aa97', 600, 800),
      UN('1506905925346-21bda4d32df4', 600, 800),
      UN('1492684223066-81342ee5ff30', 600, 800),
    ],
  },
  {
    id: 'p2', name: 'Andrea Furrer', city: 'Bern', postcode: '3011',
    specialty: 'Commercial, Editorial', rating: 4.8, reviews: 62,
    avatar: UN('1500648767791-00dcc994a43e', 200, 200),
    hero: UN('1517694712202-14dd9538aa97', 1200, 900),
    status: 'booked', bookedUntil: 'August',
    responds: 4,
    bio_de: 'Ehemals Bildredaktor bei Das Magazin. Heute selbständig zwischen Bern und Berlin.',
    bio_fr: 'Ancien rédacteur image chez Das Magazin. Indépendant entre Berne et Berlin.',
    bio_en: 'Former photo editor at Das Magazin. Independent between Bern and Berlin.',
    gear: 'Leica SL2, mittlere Formate', gear_fr: 'Leica SL2, moyen format', gear_en: 'Leica SL2, medium format',
    languages: 'DE, EN',
    fromPrice: 3600,
    portfolio: [],
  },
  {
    id: 'p3', name: 'Sébastien Meyer', city: 'Genève', postcode: '1201',
    specialty: 'Porträt, Reportage', rating: 4.7, reviews: 31,
    avatar: UN('1472099645785-5658abf4ff4e', 200, 200),
    hero: UN('1492684223066-81342ee5ff30', 1200, 900),
    status: 'available', responds: 3,
    bio_de: 'Reportage und ehrliche Porträts. Ich reise gern und liefere in 7 Tagen.',
    bio_fr: 'Reportage et portraits honnêtes. Voyage volontiers, livraison en 7 jours.',
    bio_en: 'Reportage and honest portraits. Happy to travel, 7-day delivery.',
    gear: 'Fujifilm X-T5, Leica Q3', gear_fr: 'Fujifilm X-T5, Leica Q3', gear_en: 'Fujifilm X-T5, Leica Q3',
    languages: 'FR, EN, DE',
    fromPrice: 1900,
    portfolio: [],
  },
  {
    id: 'p4', name: 'Mira Lüthi', city: 'Basel', postcode: '4051',
    specialty: 'Architektur, Interior', rating: 4.9, reviews: 24,
    avatar: UN('1534528741775-53994a69daeb', 200, 200),
    hero: UN('1486325212027-8081e485255e', 1200, 900),
    status: 'available', responds: 2,
    bio_de: 'Studierte an der HGK Basel. Arbeitet ausschliesslich mit natürlichem Licht.',
    bio_fr: 'Diplômée HGK Bâle. Travaille uniquement en lumière naturelle.',
    bio_en: 'HGK Basel graduate. Works exclusively with natural light.',
    gear: 'Hasselblad X2D, Tilt-Shift Set', gear_fr: 'Hasselblad X2D, tilt-shift', gear_en: 'Hasselblad X2D, tilt-shift',
    languages: 'DE, EN',
    fromPrice: 2400,
    portfolio: [],
  },
];

// Offers/bids for shoot s1 detail screen
const BIDS = [
  {
    id: 'b1', photographer: PHOTOGRAPHERS[0], price: 3800,
    delivery: 2,
    message_de: 'Ich kenne die Kapelle gut, habe dort 2023 schon einmal gearbeitet. Dokumentarisch, kein Blitz in der Zeremonie.',
    message_fr: 'Je connais bien la chapelle, j\u2019y ai déjà travaillé en 2023. Documentaire, pas de flash pendant la cérémonie.',
    message_en: 'I know the chapel well, worked there in 2023. Documentary, no flash during the ceremony.',
  },
  {
    id: 'b2', photographer: PHOTOGRAPHERS[2], price: 4100,
    delivery: 3,
    message_de: 'Zweite Kamera möglich, falls gewünscht. Lieferung in 3 Wochen mit Vorauswahl in 5 Tagen.',
    message_fr: 'Deuxième boîtier possible. Livraison en 3 semaines, sélection en 5 jours.',
    message_en: 'Second camera available. 3-week delivery, preview in 5 days.',
  },
  {
    id: 'b3', photographer: PHOTOGRAPHERS[1], price: 4500,
    delivery: 2,
    message_de: 'Mittelformat-Setup für die Hauptmomente, parallel Reportage auf Leica SL2.',
    message_fr: 'Setup moyen format pour les moments clés, reportage en parallèle Leica SL2.',
    message_en: 'Medium format for key moments, parallel reportage on Leica SL2.',
  },
];

const CONVERSATIONS = [
  { id: 'c1', who: PHOTOGRAPHERS[0], last_de: 'Klingt gut. Vorab-Anruf am Donnerstag 10:00?', last_fr: 'Très bien. Appel jeudi 10:00 ?', last_en: 'Sounds good. Call Thursday 10:00?', time: '14:32', unread: true, status: 'booked' },
  { id: 'c2', who: PHOTOGRAPHERS[2], last_de: 'Skizze ist im Anhang.', last_fr: 'Esquisse en pièce jointe.', last_en: 'Sketch attached.', time: '11:08', unread: true },
  { id: 'c3', who: PHOTOGRAPHERS[1], last_de: 'Verfügbar ab dem 18.', last_fr: 'Disponible dès le 18.', last_en: 'Available from the 18th.', time: 'Gestern', unread: false },
  { id: 'c4', who: PHOTOGRAPHERS[3], last_de: 'Honorar bestätigt. Vertrag folgt.', last_fr: 'Honoraire confirmé. Contrat à suivre.', last_en: 'Fee confirmed. Contract to follow.', time: '21.05', unread: false, status: 'booked' },
];

Object.assign(window, { SHOOTS, PHOTOGRAPHERS, BIDS, CONVERSATIONS, CHF, CHFRange, chf, UN });
