import { defineChain } from "viem";

export const arc = defineChain({
  id: 5042,
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.arc.io"] } },
  blockExplorers: { default: { name: "Arc Explorer", url: "https://explorer.arc.io" } },
});

export const USDC = "0x3600000000000000000000000000000000000000" as const;
export const USDC_DECIMALS = 6;
export const ERC8004 = {
  identity: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  reputation: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
} as const;
