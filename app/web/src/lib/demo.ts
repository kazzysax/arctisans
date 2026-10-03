// Demo content for screens until the API is connected. Photos: Wikimedia Commons (see public/demo/CREDITS.txt) and pravatar.
export type Person = { handle: string; name: string; title: string; city: string; avatar: string; kind: "human" | "agent"; jobs: number; rating: number | null; verified?: boolean };

export const people: Record<string, Person> = {
  amara: { handle: "amara", name: "Mira", title: "Writer", city: "Remote", avatar: "/web3/pfp_5.png", kind: "human", jobs: 38, rating: 4.9, verified: true },
  tobi: { handle: "tobi", name: "Dayo", title: "Developer", city: "Remote", avatar: "/web3/pfp_6.png", kind: "human", jobs: 21, rating: 4.8, verified: true },
  lena: { handle: "lena", name: "Kenji", title: "Brand designer", city: "Remote", avatar: "/web3/pfp_7.png", kind: "human", jobs: 54, rating: 5.0 },
  sami: { handle: "sami", name: "pixelsat", title: "NFT artist", city: "Remote", avatar: "/web3/pfp_1.png", kind: "human", jobs: 17, rating: 4.7 },
  noor: { handle: "noor", name: "Zara", title: "Community manager", city: "Remote", avatar: "/web3/pfp_8.png", kind: "human", jobs: 63, rating: 4.9, verified: true },
  kai: { handle: "kai", name: "punk42", title: "Illustrator", city: "Remote", avatar: "/web3/pfp_3.png", kind: "human", jobs: 9, rating: 4.6 },
  eli: { handle: "eli", name: "Ada", title: "Motion designer", city: "Remote", avatar: "/web3/pfp_9.png", kind: "human", jobs: 12, rating: 4.8 },
  ivy: { handle: "ivy", name: "Nia", title: "Moderator", city: "Remote", avatar: "/web3/pfp_10.png", kind: "human", jobs: 28, rating: 4.9 },
  vee: { handle: "vee", name: "Vee", title: "Researcher", city: "Remote", avatar: "/web3/pfp_2.png", kind: "human", jobs: 31, rating: 4.9 },
  ape: { handle: "ape", name: "ape7", title: "Growth", city: "Remote", avatar: "/web3/pfp_4.png", kind: "human", jobs: 14, rating: 4.7 },
  lux: { handle: "lux", name: "Lux", title: "Translator", city: "Remote", avatar: "/web3/pfp_11.png", kind: "human", jobs: 19, rating: 4.8 },
  degen: { handle: "degen", name: "degen9", title: "Video editor", city: "Remote", avatar: "/web3/pfp_12.png", kind: "human", jobs: 22, rating: 4.8 },
  atlas: { handle: "atlas", name: "Atlas", title: "Research agent", city: "On Arc", avatar: "/demo/agent_atlas.png", kind: "agent", jobs: 112, rating: 4.8, verified: true },
};

export type Post = { id: string; by: string; photos: string[]; video?: string | null; caption: string; skill: string; likes: number; tips: number; ago: string; author?: Person; demo?: boolean; to?: string };

// Sample posts shown under real ones so the feed never looks empty. Authors are not accounts (no profile, no hire).
export const discover: Post[] = [
  { id: "p1", by: "lena", photos: ["/web3/post_1.jpg"], caption: "Brand identity for Nova DAO. Mark, wordmark and palette.", skill: "Design", likes: 312, tips: 14, ago: "2h", demo: true },
  { id: "p2", by: "tobi", photos: ["/web3/post_2.jpg"], caption: "Milestone escrow, audited and 18% cheaper on gas.", skill: "Development", likes: 208, tips: 6, ago: "5h", demo: true },
  { id: "p3", by: "sami", photos: ["/web3/post_4.jpg"], caption: "Builders, a 100-piece pixel series minted on Arc.", skill: "NFT art", likes: 177, tips: 9, ago: "1d", demo: true },
  { id: "p4", by: "eli", photos: ["/web3/post_6.jpg"], caption: "Storyboard for a 12s launch teaser.", skill: "Motion", likes: 141, tips: 11, ago: "1d", demo: true },
];

export const following: Post[] = [
  { id: "f1", by: "amara", photos: ["/web3/post_3.jpg"], caption: "Ghostwrote this thread for a stablecoin team. 48k views in a day.", skill: "Writing", likes: 96, tips: 4, ago: "3h", demo: true },
  { id: "f2", by: "noor", photos: ["/web3/post_5.jpg"], caption: "Builders Night #14 is Thursday. Bring questions.", skill: "Community", likes: 254, tips: 12, ago: "6h", demo: true },
];

export const stories = ["amara", "tobi", "lena", "atlas", "noor", "sami", "kai", "ivy", "vee", "degen"];
export const paidToday = ["lena", "atlas"]; // finished a paid job today (from JobClosed events)
export const postById = (id: string) => [...discover, ...following].find((p) => p.id === id);

export type Profile = {
  bio: string; scope: string[]; skills: { name: string; jobs: number }[];
  links: { kind: "linkedin" | "x" | "instagram" | "tiktok" | "github" | "web"; url: string }[];
  cover: string; earned: number; onTime: number; clients: number; tips: number; since: string;
  settled: number; deadlocked: number; owner?: string; agentId?: number;
};

export const profiles: Record<string, Profile> = {
  amara: {
    bio: "Made-to-measure tailoring in Lagos. Ankara, aso-oke and clean modern cuts. I take on 6 pieces a month so each one gets the time it needs.",
    scope: ["Made-to-measure dresses and suits", "Bridal and aso-ebi orders", "Alterations and restyling", "Pattern drafting for small labels"],
    skills: [{ name: "Tailoring", jobs: 22 }, { name: "Bridal", jobs: 9 }, { name: "Pattern drafting", jobs: 7 }],
    links: [{ kind: "instagram", url: "https://instagram.com" }, { kind: "tiktok", url: "https://tiktok.com" }, { kind: "linkedin", url: "https://linkedin.com" }, { kind: "web", url: "https://example.com" }],
    cover: "/demo/work_jewel.jpg", earned: 2840, onTime: 97, clients: 31, tips: 186, since: "Oct 2026", settled: 1, deadlocked: 0,
  },
  tobi: {
    bio: "Architect. Residential concepts, scale models and planning drawings for clients across West Africa.",
    scope: ["Concept design", "Scale models", "Planning drawings"], skills: [{ name: "Architecture", jobs: 14 }, { name: "3D models", jobs: 7 }],
    links: [{ kind: "linkedin", url: "https://linkedin.com" }, { kind: "web", url: "https://example.com" }], cover: "/demo/work_arch.jpg",
    earned: 1960, onTime: 95, clients: 18, tips: 64, since: "Oct 2026", settled: 0, deadlocked: 0,
  },
  atlas: {
    bio: "Research agent. Market scans, competitor briefs and source-checked summaries, delivered in hours. Owned and supervised by @eli.",
    scope: ["Market research briefs", "Competitor scans", "Source-checked summaries"], skills: [{ name: "Research", jobs: 81 }, { name: "Summaries", jobs: 31 }],
    links: [{ kind: "github", url: "https://github.com" }, { kind: "web", url: "https://example.com" }], cover: "/demo/bg_blue.jpg",
    earned: 1530, onTime: 99, clients: 64, tips: 22, since: "Oct 2026", settled: 2, deadlocked: 0, owner: "eli", agentId: 412,
  },
};
export function profileOf(handle: string): Profile {
  return profiles[handle] ?? { ...profiles.tobi, bio: `${people[handle]?.title ?? "Arctisan"} on Arctisans.`, cover: "/demo/work_laptop.jpg" };
}

export const portfolio: Record<string, string[]> = {
  amara: ["/demo/work_ankara.jpg", "/demo/work_tailor.jpg", "/demo/work_fashion.jpg", "/demo/work_jewel.jpg", "/demo/work_callig.jpg", "/demo/work_laptop.jpg"],
};

export type Review = { by: string; rating: number; text: string; job: string; amount: number; ago: string };
export const reviews: Review[] = [
  { by: "lena", rating: 5, text: "Fit was perfect on the first try. Clear about timing and delivered a day early.", job: "Two-piece Ankara set", amount: 85, ago: "1w" },
  { by: "tobi", rating: 5, text: "Professional from the agreement to delivery. Will hire again.", job: "Groom's agbada", amount: 100, ago: "3w" },
  { by: "atlas", rating: 4, text: "Good communication, one revision used as agreed.", job: "Uniform pattern set", amount: 40, ago: "1mo" },
];

export type JobState = "Proposed" | "Funded" | "Active" | "Delivered" | "Settlement" | "Completed";
export type Job = { id: string; title: string; client: string; artisan: string; total: number; split: string; state: JobState; deadline: string; revisions: string; released: number; next: string };
export const jobs: Job[] = [
  { id: "1042", title: "Bakery brand identity", client: "amara", artisan: "lena", total: 60, split: "30% on start (Trusted) · 70% on approval", state: "Delivered", deadline: "Oct 18", revisions: "1 of 2 used", released: 18, next: "Review the delivery" },
  { id: "1039", title: "Ankara two-piece set", client: "kai", artisan: "amara", total: 85, split: "50% on start (Pro) · 50% on approval", state: "Active", deadline: "Oct 21", revisions: "0 of 1 used", released: 42.5, next: "Waiting for delivery" },
  { id: "1033", title: "Market brief: Lagos fintech", client: "eli", artisan: "atlas", total: 25, split: "100% on approval", state: "Completed", deadline: "Oct 9", revisions: "0 of 1 used", released: 25, next: "Leave a review" },
  { id: "1051", title: "Shop sign hand-lettering", client: "ivy", artisan: "amara", total: 50, split: "100% on approval", state: "Settlement", deadline: "Oct 16", revisions: "2 of 2 used", released: 0, next: "Answer the split offer" },
  { id: "1048", title: "Wedding invitation lettering", client: "sami", artisan: "amara", total: 40, split: "3 milestones", state: "Proposed", deadline: "Oct 30", revisions: "2 included", released: 0, next: "Accept terms" },
];

export const notifications = [
  { kind: "tip", who: "tobi", text: "tipped you $2 on Ankara two-piece", ago: "4m" },
  { kind: "paid", who: "kai", text: "funded Ankara two-piece set · $85 in escrow", ago: "1h" },
  { kind: "review", who: "lena", text: "left you a 5★ review", ago: "1d" },
  { kind: "follow", who: "noor", text: "started following you", ago: "2d" },
  { kind: "released", who: "ivy", text: "released $42.50 to your wallet", ago: "3d" },
];

import { computeBadges, type Badge } from "./badges";
import { computeReputation } from "./reputation";
export function demoCard(handle: string): { level: { level: 1 | 2 | 3; name: string; upfrontPct: number }; badges: Badge[] } {
  const p = people[handle], f = profileOf(handle);
  const jobs = p?.jobs ?? 0;
  const lvl: 1 | 2 | 3 = !p?.verified ? 1 : jobs >= 20 && f.clients >= 10 ? 3 : jobs >= 5 && f.clients >= 3 ? 2 : 1;
  const rep = { ...computeReputation("0x0", [], [], []), completed: jobs, earned: f.earned * 1e6, tipsCount: Math.round(f.tips / 2), deadlocked: f.deadlocked };
  const badges = computeBadges({
    rep, level: lvl, verified: !!p?.verified, onTimeCount: Math.round((jobs * f.onTime) / 100),
    ratingsInOrder: handle === "amara" ? [5, 5, 4, 5, 5, 5, 4, 5, 5] : [5, 5, 4, 5], maxJobsFromOneClient: handle === "amara" ? 4 : 2,
    agentsHired: handle === "eli" ? 1 : 0, joinedAt: Date.UTC(2026, 9, 14), launchAt: Date.UTC(2026, 9, 14),
  });
  return { level: { level: lvl, name: ["New", "Trusted", "Pro"][lvl - 1], upfrontPct: [0, 30, 50][lvl - 1] }, badges };
}
