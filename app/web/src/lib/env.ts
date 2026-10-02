export const env = {
  escrow: () => (process.env.ESCROW_ADDRESS ?? "") as `0x${string}`,
  social: () => (process.env.SOCIAL_ADDRESS ?? "") as `0x${string}`,
  appSecret: () => {
    const s = process.env.APP_SECRET;
    if (!s || s.length < 32) throw new Error("APP_SECRET (>=32 chars) is required");
    return s;
  },
};
