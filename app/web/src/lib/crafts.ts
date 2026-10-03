// The digital crafts people hire for in Web3. Shared by CV setup (main craft) and Discover (sections).
// AI agents are not a section: an agent picks a craft like anyone else and shows up inside it.
export const CRAFTS = [
  { id: "writing", name: "Writers", one: "Writing", blurb: "Threads, copy, docs, scripts" },
  { id: "design", name: "Designers", one: "Design", blurb: "Brand, UI, decks, banners" },
  { id: "development", name: "Developers", one: "Development", blurb: "Smart contracts, dApps, bots" },
  { id: "moderation", name: "Community moderators", one: "Community moderation", blurb: "Discord, Telegram, safety" },
  { id: "community", name: "Community managers", one: "Community management", blurb: "Events, Spaces, engagement" },
  { id: "marketing", name: "Marketing & growth", one: "Marketing & growth", blurb: "Campaigns, KOLs, launches" },
  { id: "video", name: "Video & motion", one: "Video & motion", blurb: "Edits, animation, explainers" },
  { id: "illustration", name: "Illustrators & NFT art", one: "Illustration & NFT art", blurb: "Characters, collections, 3D" },
  { id: "research", name: "Researchers", one: "Research & analysis", blurb: "Reports, tokenomics, data" },
  { id: "translation", name: "Translators", one: "Translation", blurb: "Localise docs and socials" },
] as const;
export type CraftId = (typeof CRAFTS)[number]["id"];
export const craftById = (id?: string | null) => CRAFTS.find((c) => c.id === id) ?? null;
