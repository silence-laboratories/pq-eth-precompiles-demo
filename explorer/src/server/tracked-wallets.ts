import path from "node:path";
import { readFile } from "node:fs/promises";
import { getAddress } from "viem";

import type { TrackedWallet } from "@/lib/tracked-wallet";

export type { TrackedWallet } from "@/lib/tracked-wallet";

type TrackedWalletRecord = {
  address: string;
  label?: string;
  chainId: number;
  demoRecipientAddress?: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  tokenName?: string;
};

const RPC_URL_ENV_VAR = "PQ_RPC_URL";

function trackedWalletsPath() {
  return path.join(process.cwd(), "public", "tracked-wallets.json");
}

function getRpcUrl() {
  const rpcUrl = process.env[RPC_URL_ENV_VAR]?.trim();
  if (!rpcUrl) {
    throw new Error(
      `Missing ${RPC_URL_ENV_VAR}. Set it to the RPC endpoint for the tracked wallet chain.`,
    );
  }

  try {
    new URL(rpcUrl);
  } catch {
    throw new Error(`${RPC_URL_ENV_VAR} must be a valid URL.`);
  }

  return rpcUrl;
}

function normalize(record: TrackedWalletRecord, rpcUrl: string): TrackedWallet {
  return {
    address: getAddress(record.address),
    label: record.label ?? "MLDSAWallet",
    rpcUrl,
    chainId: record.chainId,
    demoRecipientAddress: record.demoRecipientAddress
      ? getAddress(record.demoRecipientAddress)
      : undefined,
    tokenAddress: record.tokenAddress
      ? getAddress(record.tokenAddress)
      : undefined,
    tokenSymbol: record.tokenSymbol,
    tokenName: record.tokenName,
  };
}

export async function getTrackedWallets(): Promise<TrackedWallet[]> {
  const raw = await readFile(trackedWalletsPath(), "utf8");
  const records = JSON.parse(raw) as TrackedWalletRecord[];
  if (records.length === 0) {
    return [];
  }
  const rpcUrl = getRpcUrl();
  return records.map((record) => normalize(record, rpcUrl));
}

export async function getTrackedWallet(
  address: string,
): Promise<TrackedWallet | null> {
  const wallets = await getTrackedWallets();
  return (
    wallets.find(
      (wallet) => wallet.address.toLowerCase() === address.toLowerCase(),
    ) ?? null
  );
}
