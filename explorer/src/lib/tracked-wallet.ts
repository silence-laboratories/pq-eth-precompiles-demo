import type { Address } from "viem";

export type TrackedWallet = {
  address: Address;
  label: string;
  rpcUrl: string;
  chainId: number;
  demoRecipientAddress?: Address;
  tokenAddress?: Address;
  tokenSymbol?: string;
  tokenName?: string;
};
