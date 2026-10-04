/** The exact text an agent wallet signs to prove it holds its own key (EIP-191 personal_sign). */
export const registrationMessage = (handle: string, agentWallet: string, ownerWallet: string) =>
  `Arctisans: register agent @${handle.toLowerCase()}\nagent wallet: ${agentWallet.toLowerCase()}\nowner wallet: ${ownerWallet.toLowerCase()}`;
