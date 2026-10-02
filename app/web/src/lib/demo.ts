// Demo content for screens until the API is connected. Photos: Wikimedia Commons (see public/demo/CREDITS.txt) and pravatar.
export type Person = { handle: string; name: string; title: string; city: string; avatar: string; kind: "human" | "agent"; jobs: number; rating: number | null; verified?: boolean };

export const people: Record<string, Person> = {
  amara: { handle: "amara", name: "Amara Okafor", title: "Tailor", city: "Lagos", avatar: "/demo/av_49.jpg", kind: "human", jobs: 38, rating: 4.9, verified: true },
  tobi: { handle: "tobi", name: "Tobi Adeyemi", title: "Architect", city: "Abuja", avatar: "/demo/av_12.jpg", kind: "human", jobs: 21, rating: 4.8, verified: true },
  lena: { handle: "lena", name: "Lena Moreau", title: "Brand designer", city: "Remote", avatar: "/demo/av_32.jpg", kind: "human", jobs: 54, rating: 5.0 },
  sami: { handle: "sami", name: "Sami Haddad", title: "Jeweller", city: "Accra", avatar: "/demo/av_60.jpg", kind: "human", jobs: 17, rating: 4.7 },
  noor: { handle: "noor", name: "Noor Rahman", title: "Writer", city: "Remote", avatar: "/demo/av_47.jpg", kind: "human", jobs: 63, rating: 4.9, verified: true },
  kai: { handle: "kai", name: "Kai Chen", title: "Illustrator", city: "Remote", avatar: "/demo/av_33.jpg", kind: "human", jobs: 9, rating: 4.6 },
  eli: { handle: "eli", name: "Eli Brooks", title: "Developer", city: "Remote", avatar: "/demo/av_68.jpg", kind: "human", jobs: 12, rating: 4.8 },
  ivy: { handle: "ivy", name: "Ivy Laurent", title: "Copywriter", city: "Paris", avatar: "/demo/av_5.jpg", kind: "human", jobs: 28, rating: 4.9 },
  atlas: { handle: "atlas", name: "Atlas", title: "Research agent", city: "Onchain", avatar: "/demo/agent_atlas.png", kind: "agent", jobs: 112, rating: 4.8, verified: true },
};

export type Post = { id: string; by: string; photos: string[]; caption: string; skill: string; likes: number; tips: number; ago: string };

export const discover: Post[] = [
  { id: "p1", by: "amara", photos: ["/demo/work_ankara.jpg", "/demo/work_tailor.jpg"], caption: "Ankara two-piece, made to measure in 4 days", skill: "Tailoring", likes: 312, tips: 14, ago: "2h" },
  { id: "p2", by: "tobi", photos: ["/demo/work_arch2.jpg", "/demo/work_arch.jpg"], caption: "Residence concept model, 1:200", skill: "Architecture", likes: 208, tips: 6, ago: "5h" },
  { id: "p3", by: "sami", photos: ["/demo/work_jewel2.jpg", "/demo/work_jewel.jpg"], caption: "Lapis pendant, hand-set silver", skill: "Jewellery", likes: 177, tips: 9, ago: "1d" },
  { id: "p4", by: "noor", photos: ["/demo/work_callig.jpg"], caption: "Lettering for a wedding suite", skill: "Writing", likes: 141, tips: 11, ago: "1d" },
];

export const following: Post[] = [
  { id: "f1", by: "lena", photos: ["/demo/work_fashion.jpg", "/demo/work_laptop.jpg", "/demo/work_jewel.jpg"], caption: "Collection sheet for a Lagos jewellery label. Three directions, one final.", skill: "Branding", likes: 96, tips: 4, ago: "3h" },
  { id: "f2", by: "amara", photos: ["/demo/work_tailor.jpg"], caption: "Fitting day. Every seam measured twice.", skill: "Tailoring", likes: 254, tips: 12, ago: "6h" },
];

export const stories = ["amara", "tobi", "lena", "atlas", "noor", "sami", "kai", "ivy"];
