// Demo fixture dataset. Shapes mirror the real tables in
// `src/lib/supabase/database.types.ts`; content is expanded Swiss sample data
// derived from `supabase/seed.sql`. Image columns hold full hosted URLs so the
// mock storage layer can round-trip them through getPublicUrl().
//
// buildFixtures() returns a fresh deep copy each call so the store can reseed
// cleanly after in-session mutations.

const T = "2026-05-01T09:00:00.000Z"; // fixed "created_at" baseline

const img = (id: string, w = 1000) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;

// ── ids ────────────────────────────────────────────────────────────────
// Clients
const C_LENA = "a0000000-0000-0000-0000-000000000001";
const C_VITRA = "a0000000-0000-0000-0000-000000000002";
// Photographers
const P_MARKO = "a0000000-0000-0000-0000-000000000003";
const P_CLAIRE = "a0000000-0000-0000-0000-000000000004";
const P_NINA = "a0000000-0000-0000-0000-000000000005";
const P_LUCA = "a0000000-0000-0000-0000-000000000006";
const P_SARAH = "a0000000-0000-0000-0000-000000000007";
const P_JONAS = "a0000000-0000-0000-0000-000000000008";

export type DemoData = {
  profiles: any[];
  photographer_details: any[];
  portfolio_images: any[];
  shoot_images: any[];
  shoots: any[];
  bids: any[];
  conversations: any[];
  messages: any[];
  reviews: any[];
  notifications: any[];
  favorites: any[];
  photographer_unavailable: any[];
  reports: any[];
};

function data(): DemoData {
  return {
    profiles: [
      { id: C_LENA, role: "client", display_name: "Lena & Tobias K.", avatar_url: img("1494790108377-be9c29b29330", 200), city: "Zürich", canton: "ZH", locale: "de", bio: null, created_at: T, role_confirmed: true, is_admin: false },
      { id: C_VITRA, role: "client", display_name: "Vitra AG", avatar_url: img("1560250097-0b93528c311a", 200), city: "Basel", canton: "BS", locale: "de", bio: null, created_at: T, role_confirmed: true, is_admin: false },
      { id: P_MARKO, role: "photographer", display_name: "Marko Brunner", avatar_url: img("1633332755192-727a05c4013d", 200), city: "Zürich", canton: "ZH", locale: "de", bio: "Dokumentarischer Hochzeits- und Porträtfotograf. Ruhig, ehrlich, unaufdringlich.", created_at: T, role_confirmed: true, is_admin: false },
      { id: P_CLAIRE, role: "photographer", display_name: "Claire Dubois", avatar_url: img("1438761681033-6461ffad8d80", 200), city: "Lausanne", canton: "VD", locale: "fr", bio: "Photographe commerciale & architecture. Lumière naturelle maîtrisée.", created_at: T, role_confirmed: true, is_admin: false },
      { id: P_NINA, role: "photographer", display_name: "Nina Hofer", avatar_url: img("1544005313-94ddf0286df2", 200), city: "Bern", canton: "BE", locale: "de", bio: "Familien- und Neugeborenenfotografie mit Herz.", created_at: T, role_confirmed: true, is_admin: false },
      { id: P_LUCA, role: "photographer", display_name: "Luca Ferrari", avatar_url: img("1492562080023-ab3db95bfbce", 200), city: "Lugano", canton: "TI", locale: "it", bio: "Eventi e ritratti aziendali in tutto il Ticino.", created_at: T, role_confirmed: true, is_admin: false },
      { id: P_SARAH, role: "photographer", display_name: "Sarah Meier", avatar_url: img("1534528741775-53994a69daeb", 200), city: "St. Gallen", canton: "SG", locale: "de", bio: "Editorial- und Modefotografie für Marken in der Ostschweiz.", created_at: T, role_confirmed: true, is_admin: false },
      { id: P_JONAS, role: "photographer", display_name: "Jonas Weber", avatar_url: img("1507003211169-0a1dd7228f2d", 200), city: "Luzern", canton: "LU", locale: "de", bio: "Hochzeiten und Paare in den Zentralschweizer Bergen.", created_at: T, role_confirmed: true, is_admin: false },
    ],

    photographer_details: [
      { profile_id: P_MARKO, specialties: ["wedding", "portrait"], coverage_cantons: ["ZH", "ZG", "SZ", "VS"], hourly_rate_chf: 280, website_url: "https://markobrunner.example.ch", instagram_url: "https://instagram.com/markobrunner", created_at: T },
      { profile_id: P_CLAIRE, specialties: ["commercial", "architecture", "portrait"], coverage_cantons: ["VD", "GE", "FR"], hourly_rate_chf: 320, website_url: "https://clairedubois.example.ch", instagram_url: null, created_at: T },
      { profile_id: P_NINA, specialties: ["family", "portrait"], coverage_cantons: ["BE", "SO", "FR"], hourly_rate_chf: 210, website_url: null, instagram_url: "https://instagram.com/ninahofer", created_at: T },
      { profile_id: P_LUCA, specialties: ["event", "portrait", "commercial"], coverage_cantons: ["TI"], hourly_rate_chf: 240, website_url: "https://lucaferrari.example.ch", instagram_url: null, created_at: T },
      { profile_id: P_SARAH, specialties: ["commercial", "portrait", "event"], coverage_cantons: ["SG", "TG", "AR", "AI"], hourly_rate_chf: 300, website_url: null, instagram_url: "https://instagram.com/sarahmeier", created_at: T },
      { profile_id: P_JONAS, specialties: ["wedding", "family"], coverage_cantons: ["LU", "OW", "NW", "UR"], hourly_rate_chf: 260, website_url: "https://jonasweber.example.ch", instagram_url: null, created_at: T },
    ],

    portfolio_images: [
      ...portfolioFor(P_MARKO, ["1519741497674-611481863552", "1606216794074-735e91aa2c92", "1511285560929-80b456fea0bc", "1583939003579-730e3918a45a"]),
      ...portfolioFor(P_CLAIRE, ["1497366216548-37526070297c", "1486406146926-c627a92ad1ab", "1497366811353-6870744d04b2"]),
      ...portfolioFor(P_NINA, ["1476703993599-0035a21b17a9", "1602052577122-f73b9710adba", "1491013516836-7db643ee125a"]),
      ...portfolioFor(P_LUCA, ["1511578314322-379afb476865", "1505236858219-8359eb29e329", "1540575467063-178a50c2df87"]),
      ...portfolioFor(P_SARAH, ["1469334031218-e382a71b716b", "1483985988355-763728e1935b", "1490481651871-ab68de25d43d"]),
      ...portfolioFor(P_JONAS, ["1519225421980-715cb0215aed", "1465495976277-4387d4b0b4c6", "1522673607200-164d1b6ce486"]),
    ],

    shoot_images: [],

    shoots: [
      { id: "a0000000-0000-0000-0001-000000000001", client_id: C_LENA, title: "Hochzeit in Zermatt", type: "wedding", brief: "Trauung um 14:30 in der Bergkapelle, anschliessend Apéro auf der Terrasse mit Matterhorn-Blick. Dokumentarischer Stil — ehrlich, ruhig.", location_city: "Zermatt", location_postcode: "3920", canton: "VS", shoot_date: "2026-08-14", duration_hours: 10, budget_min_chf: 3200, budget_max_chf: 4500, status: "open", accepted_bid_id: null, created_at: T, cancellation_reason: null },
      { id: "a0000000-0000-0000-0001-000000000002", client_id: C_VITRA, title: "Editorial — Vitra Sommerkollektion", type: "commercial", brief: "Indoor-Studio, klares Tageslicht, 12 Stühle, ein Sofa. Aesthetik wie der gedruckte Katalog 2024.", location_city: "Basel", location_postcode: "4051", canton: "BS", shoot_date: "2026-07-03", duration_hours: 6, budget_min_chf: 4800, budget_max_chf: 6200, status: "open", accepted_bid_id: null, created_at: T, cancellation_reason: null },
      { id: "a0000000-0000-0000-0001-000000000003", client_id: C_LENA, title: "Porträtserie für Forschungsteam", type: "portrait", brief: "EPFL Labor. 18 Personen, je 5–7 Minuten. Schwarzweiss bevorzugt.", location_city: "Lausanne", location_postcode: "1015", canton: "VD", shoot_date: "2026-07-21", duration_hours: 4, budget_min_chf: 1800, budget_max_chf: 2400, status: "open", accepted_bid_id: null, created_at: T, cancellation_reason: null },
      { id: "a0000000-0000-0000-0001-000000000004", client_id: C_VITRA, title: "Produktfotografie Bürostuhl EVO", type: "commercial", brief: "Drei Farbvarianten des Stuhls, Weisshintergrund und Lifestyle-Setting im Showroom.", location_city: "Basel", location_postcode: "4058", canton: "BS", shoot_date: "2026-09-10", duration_hours: 5, budget_min_chf: 3500, budget_max_chf: 5000, status: "assigned", accepted_bid_id: "a0000000-0000-0000-0002-000000000003", created_at: T, cancellation_reason: null },
      { id: "a0000000-0000-0000-0001-000000000005", client_id: C_LENA, title: "Familienportrait Weihnachten", type: "portrait", brief: "Abgesagt — Termin nicht mehr aktuell.", location_city: "Bern", location_postcode: "3011", canton: "BE", shoot_date: "2026-12-22", duration_hours: 2, budget_min_chf: 800, budget_max_chf: 1200, status: "cancelled", accepted_bid_id: null, created_at: T, cancellation_reason: "Termin nicht mehr aktuell." },
      { id: "a0000000-0000-0000-0001-000000000006", client_id: C_VITRA, title: "Markenshooting Frühjahr (abgeschlossen)", type: "commercial", brief: "Abgeschlossenes Lifestyle-Shooting für die Frühjahrskampagne.", location_city: "Zürich", location_postcode: "8005", canton: "ZH", shoot_date: "2026-03-12", duration_hours: 6, budget_min_chf: 4000, budget_max_chf: 5500, status: "completed", accepted_bid_id: "a0000000-0000-0000-0002-000000000004", created_at: T, cancellation_reason: null },
    ],

    bids: [
      { id: "a0000000-0000-0000-0002-000000000001", shoot_id: "a0000000-0000-0000-0001-000000000001", photographer_id: P_MARKO, amount_chf: 3800, message: "Dokumentarischer Stil ist genau mein Ansatz — ruhig, unaufdringlich, ehrlich.", status: "pending", created_at: T },
      { id: "a0000000-0000-0000-0002-000000000002", shoot_id: "a0000000-0000-0000-0001-000000000002", photographer_id: P_CLAIRE, amount_chf: 5600, message: "Je travaille régulièrement pour des marques de mobilier — lumière naturelle maîtrisée.", status: "pending", created_at: T },
      { id: "a0000000-0000-0000-0002-000000000003", shoot_id: "a0000000-0000-0000-0001-000000000004", photographer_id: P_MARKO, amount_chf: 4200, message: "Studio-Produktfotografie ist eine meiner Kernkompetenzen.", status: "accepted", created_at: T },
      { id: "a0000000-0000-0000-0002-000000000004", shoot_id: "a0000000-0000-0000-0001-000000000006", photographer_id: P_SARAH, amount_chf: 4800, message: "Lifestyle-Kampagnen sind mein Schwerpunkt.", status: "accepted", created_at: T },
      { id: "a0000000-0000-0000-0002-000000000005", shoot_id: "a0000000-0000-0000-0001-000000000002", photographer_id: P_SARAH, amount_chf: 5200, message: "Editorial-Erfahrung mit Möbelmarken, gerne Referenzen.", status: "pending", created_at: T },
      { id: "a0000000-0000-0000-0002-000000000006", shoot_id: "a0000000-0000-0000-0001-000000000001", photographer_id: P_JONAS, amount_chf: 4100, message: "Berghochzeiten sind meine Leidenschaft.", status: "pending", created_at: T },
    ],

    conversations: [
      { id: "a0000000-0000-0000-0003-000000000001", shoot_id: "a0000000-0000-0000-0001-000000000004", client_id: C_VITRA, photographer_id: P_MARKO, created_at: T, last_message_at: "2026-05-02T10:15:00.000Z", client_last_read_at: "2026-05-02T10:16:00.000Z", photographer_last_read_at: "2026-05-02T10:15:30.000Z" },
    ],

    messages: [
      { id: "a0000000-0000-0000-0004-000000000001", conversation_id: "a0000000-0000-0000-0003-000000000001", sender_id: C_VITRA, body: "Hallo Marko, freut uns sehr! Wann könnten Sie im Showroom vorbeikommen?", created_at: "2026-05-02T10:00:00.000Z" },
      { id: "a0000000-0000-0000-0004-000000000002", conversation_id: "a0000000-0000-0000-0003-000000000001", sender_id: P_MARKO, body: "Guten Tag! Nächste Woche Dienstag oder Donnerstag würde mir gut passen.", created_at: "2026-05-02T10:15:00.000Z" },
    ],

    reviews: [
      { id: "a0000000-0000-0000-0005-000000000001", shoot_id: "a0000000-0000-0000-0001-000000000006", client_id: C_VITRA, photographer_id: P_SARAH, rating: 5, comment: "Hervorragende Arbeit, sehr professionell und pünktlich.", created_at: "2026-03-20T09:00:00.000Z" },
      { id: "a0000000-0000-0000-0005-000000000002", shoot_id: "a0000000-0000-0000-0001-00000000000a", client_id: C_LENA, photographer_id: P_MARKO, rating: 5, comment: "Marko hat unsere Hochzeit wunderschön festgehalten. Absolute Empfehlung!", created_at: "2026-02-14T09:00:00.000Z" },
      { id: "a0000000-0000-0000-0005-000000000003", shoot_id: "a0000000-0000-0000-0001-00000000000b", client_id: C_VITRA, photographer_id: P_MARKO, rating: 4, comment: "Tolle Produktbilder, kleine Verzögerung bei der Lieferung.", created_at: "2026-01-10T09:00:00.000Z" },
    ],

    notifications: [
      { id: "a0000000-0000-0000-0006-000000000001", user_id: P_MARKO, type: "bid_accepted", shoot_id: "a0000000-0000-0000-0001-000000000004", bid_id: "a0000000-0000-0000-0002-000000000003", read_at: null, created_at: "2026-05-02T09:00:00.000Z" },
      { id: "a0000000-0000-0000-0006-000000000002", user_id: C_LENA, type: "bid_received", shoot_id: "a0000000-0000-0000-0001-000000000001", bid_id: "a0000000-0000-0000-0002-000000000001", read_at: null, created_at: "2026-05-01T12:00:00.000Z" },
      { id: "a0000000-0000-0000-0006-000000000003", user_id: C_LENA, type: "bid_received", shoot_id: "a0000000-0000-0000-0001-000000000001", bid_id: "a0000000-0000-0000-0002-000000000006", read_at: "2026-05-01T13:00:00.000Z", created_at: "2026-05-01T12:30:00.000Z" },
    ],

    favorites: [
      { user_id: C_LENA, photographer_id: P_MARKO, created_at: T },
      { user_id: C_LENA, photographer_id: P_JONAS, created_at: T },
    ],

    photographer_unavailable: [
      { photographer_id: P_MARKO, date: "2026-08-01" },
      { photographer_id: P_MARKO, date: "2026-08-02" },
      { photographer_id: P_CLAIRE, date: "2026-07-15" },
    ],

    reports: [],
  };
}

function portfolioFor(photographerId: string, photoIds: string[]) {
  return photoIds.map((pid, i) => ({
    id: `${photographerId.slice(0, 28)}p${i + 1}`,
    photographer_id: photographerId,
    storage_path: img(pid),
    sort_order: i,
    created_at: T,
  }));
}

export function buildFixtures(): DemoData {
  return structuredClone(data());
}
