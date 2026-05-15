import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import type { WalletTransactionSummary } from "@/lib/explorer";

type PersistedStore = Record<string, unknown>;

function storePath() {
  return path.join(process.cwd(), "data", "discovered-transactions.json");
}

async function ensureStoreDir() {
  await mkdir(path.dirname(storePath()), { recursive: true });
}

async function readStore(): Promise<PersistedStore> {
  try {
    const raw = await readFile(storePath(), "utf8");
    return JSON.parse(raw) as PersistedStore;
  } catch {
    return {};
  }
}

async function writeStore(store: PersistedStore) {
  await ensureStoreDir();
  await writeFile(storePath(), JSON.stringify(store, null, 2));
}

function isWalletTransactionSummary(
  value: unknown,
): value is WalletTransactionSummary {
  if (!value || typeof value !== "object") {
    return false;
  }
  const tx = value as { kind?: unknown; hash?: unknown };
  return (
    typeof tx.hash === "string" &&
    (tx.kind === "execute" || tx.kind === "other")
  );
}

export async function readPersistedTransactions(
  walletAddress: string,
): Promise<WalletTransactionSummary[]> {
  const store = await readStore();
  const transactions = store[walletAddress.toLowerCase()];
  return Array.isArray(transactions)
    ? transactions.filter(isWalletTransactionSummary)
    : [];
}

export async function writePersistedTransactions(
  walletAddress: string,
  transactions: WalletTransactionSummary[],
) {
  const store = await readStore();
  store[walletAddress.toLowerCase()] = transactions;
  await writeStore(store);
}
