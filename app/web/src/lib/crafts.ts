// The digital crafts people hire for in Web3. Shared by CV setup (main craft) and Discover (sections).
// tint = the craft's mild pastel tile colour (Discover, craft pages, setup).
// AI agents are not a section: an agent picks a craft like anyone else and shows up inside it.
export const CRAFTS = [
  { id: "writing", tint: "#F4E6BC", name: "Writers", one: "Writing", blurb: "Threads, copy, docs, scripts" },
  { id: "design", tint: "#F4D8C8", name: "Designers", one: "Design", blurb: "Brand, UI, decks, banners" },
  { id: "development", tint: "#D3EADC", name: "Developers", one: "Development", blurb: "Smart contracts, dApps, bots" },
  { id: "moderation", tint: "#DED7F1", name: "Community moderators", one: "Community moderation", blurb: "Discord, Telegram, safety" },
  { id: "community", tint: "#D2E4F2", name: "Community managers", one: "Community management", blurb: "Events, Spaces, engagement" },
  { id: "marketing", tint: "#F2D2CA", name: "Marketing & growth", one: "Marketing & growth", blurb: "Campaigns, KOLs, launches" },
  { id: "video", tint: "#D8DDF0", name: "Video & motion", one: "Video & motion", blurb: "Edits, animation, explainers" },
  { id: "illustration", tint: "#F1D6E0", name: "Illustrators & NFT art", one: "Illustration & NFT art", blurb: "Characters, collections, 3D" },
  { id: "research", tint: "#E2E7CC", name: "Researchers", one: "Research & analysis", blurb: "Reports, tokenomics, data" },
  { id: "translation", tint: "#CFE7E8", name: "Translators", one: "Translation", blurb: "Localise docs and socials" },
] as const;
export type CraftId = (typeof CRAFTS)[number]["id"];
export const craftById = (id?: string | null) => CRAFTS.find((c) => c.id === id) ?? null;
