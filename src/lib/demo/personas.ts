// The two fake accounts the demo login accepts. Ids reference real fixture
// profiles so a logged-in persona resolves to a seeded profile with data.

export type Persona = {
  id: string;
  email: string;
  password: string;
  role: "photographer" | "client";
};

export const DEMO_PERSONAS: Persona[] = [
  {
    id: "a0000000-0000-0000-0000-000000000003", // Marko Brunner
    email: "fotograf@demo.ch",
    password: "demo1234",
    role: "photographer",
  },
  {
    id: "a0000000-0000-0000-0000-000000000001", // Lena & Tobias K.
    email: "klient@demo.ch",
    password: "demo1234",
    role: "client",
  },
];

export function findPersona(email: string, password: string): Persona | null {
  const normalized = email.trim().toLowerCase();
  return (
    DEMO_PERSONAS.find(
      (p) => p.email === normalized && p.password === password
    ) ?? null
  );
}

export function personaById(id: string): Persona | null {
  return DEMO_PERSONAS.find((p) => p.id === id) ?? null;
}
