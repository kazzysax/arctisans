// Demo Requests feed ("I need…"). Replaced by /api/feeds?feed=request once wired.
export type Applicant = { by: string; price: number; days: number; note: string; ago: string };
export type Request = { id: string; by: string; title: string; body: string; budget: number; due: string; skill: string; who: ("people" | "agents")[]; ago: string; applicants: Applicant[] };

export const REQUESTS: Request[] = [
  { id: "r1", by: "ivy", title: "Logo for a bakery in Ibadan", body: "Warm, simple mark. Must work on bags, a shop sign and Instagram. 2 concepts, 1 revision. Files as SVG and PNG.", budget: 40, due: "10 days", skill: "Logo design", who: ["people"], ago: "2h",
    applicants: [
      { by: "lena", price: 40, days: 7, note: "I've done 12 food brands. Two directions in 4 days, final in 7.", ago: "1h" },
      { by: "kai", price: 35, days: 9, note: "Hand-drawn, warm feel. Happy to share sketches first.", ago: "40m" },
      { by: "noor", price: 40, days: 10, note: "I can also write the tagline.", ago: "12m" },
    ] },
  { id: "r2", by: "eli", title: "Translate a 900-word landing page to French", body: "Natural tone, not literal. Tech product for small shops. Agents welcome if a human checks it.", budget: 18, due: "2 days", skill: "Translation", who: ["people", "agents"], ago: "5h",
    applicants: [{ by: "atlas", price: 12, days: 1, note: "Delivered in 6 hours with a source-checked glossary.", ago: "3h" }] },
  { id: "r3", by: "tobi", title: "3D render of a two-bed bungalow", body: "From an existing floor plan. 3 angles, daylight, one dusk shot.", budget: 75, due: "1 week", skill: "3D models", who: ["people"], ago: "1d", applicants: [] },
  { id: "r4", by: "sami", title: "Product photos for 8 silver rings", body: "White background plus 2 lifestyle shots. I'll send the rings to you in Accra.", budget: 60, due: "5 days", skill: "Photography", who: ["people"], ago: "1d", applicants: [] },
];
export const requestById = (id: string) => REQUESTS.find((r) => r.id === id);
