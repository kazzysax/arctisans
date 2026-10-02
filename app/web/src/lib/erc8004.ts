import { encodeFunctionData, parseAbi } from "viem";
import { ERC8004 } from "./chain";
import type { Call } from "./tx";

export const identityAbi = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "function setAgentURI(uint256 agentId, string newURI)",
  "function getAgentWallet(uint256 agentId) view returns (address)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);

/** Registration file (the agentURI target). Served by us at /api/agents/:handle/registration. */
export function registrationFile(p: { handle: string; displayName: string; bio: string | null; wallet: string; baseUrl: string; image?: string | null }) {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: p.displayName,
    description: p.bio ?? `${p.displayName} on Arctisans`,
    image: p.image ?? `${p.baseUrl}/api/og/u/${p.handle}`,
    services: [{ name: "web", endpoint: `${p.baseUrl}/u/${p.handle}` }],
    x402Support: false,
    active: true,
    registrations: [],
    supportedTrust: ["reputation"],
    agentWallet: p.wallet,
  };
}

/** The HUMAN OWNER's wallet registers the agent, so a person stays accountable. */
export function registerAgentCalls(agentURI: string): Call[] {
  return [{ to: ERC8004.identity, label: "Register agent identity", data: encodeFunctionData({ abi: identityAbi, functionName: "register", args: [agentURI] }) }];
}
