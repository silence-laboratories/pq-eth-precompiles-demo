import {
  decodeFunctionResult,
  encodeFunctionData,
  formatEther,
  hexToBigInt,
  hexToNumber,
  type Hex,
} from "viem";

import type {
  HomeRecentTransaction,
  TxPageData,
  WalletPageData,
  WalletSummary,
  WalletTransactionData,
  WalletTransactionSummary,
} from "@/lib/explorer";
import {
  DEFAULT_SCAN_BLOCKS,
  PRECOMPILE_ADDRESS,
  REFRESH_SCAN_BLOCKS,
  SCAN_BATCH_SIZE,
} from "@/lib/config";
import { erc20Abi } from "@/lib/contracts";
import { decodeWalletExecution, formatBalance } from "@/lib/decoders";
import {
  debugTraceTransaction,
  ethCall,
  getBalance,
  getBlockByNumber,
  getBlockNumber,
  getCode,
  getTransaction,
  getTransactionReceipt,
  isPrunedHistoryError,
  type RpcReceipt,
  type RpcTransaction,
} from "@/lib/rpc";
import { analyzeTrace, type TraceEvidence } from "@/lib/trace";
import {
  getTrackedWallet,
  getTrackedWallets,
  type TrackedWallet,
} from "@/server/tracked-wallets";
import {
  readPersistedTransactions,
  writePersistedTransactions,
} from "@/server/persistence";

function receiptStatus(
  receipt: RpcReceipt | null,
): "success" | "reverted" | "pending" {
  if (!receipt || !receipt.status) {
    return "pending";
  }
  return receipt.status === "0x1" ? "success" : "reverted";
}

async function getTimestampForBlock(
  wallet: TrackedWallet,
  blockNumber: number | null,
  cache: Map<number, number>,
): Promise<number | null> {
  if (blockNumber === null) {
    return null;
  }
  const cached = cache.get(blockNumber);
  if (cached !== undefined) {
    return cached;
  }
  try {
    const block = await getBlockByNumber(wallet.rpcUrl, blockNumber);
    const ts = hexToNumber(block.timestamp as Hex);
    cache.set(blockNumber, ts);
    return ts;
  } catch (error) {
    if (isPrunedHistoryError(error)) {
      return null;
    }
    throw error;
  }
}

async function maybeGetTransaction(
  rpcUrl: string,
  hash: string,
): Promise<RpcTransaction | null> {
  try {
    return await getTransaction(rpcUrl, hash);
  } catch (error) {
    if (isPrunedHistoryError(error)) {
      return null;
    }
    throw error;
  }
}

async function maybeGetReceipt(
  rpcUrl: string,
  hash: string,
): Promise<RpcReceipt | null> {
  try {
    return await getTransactionReceipt(rpcUrl, hash);
  } catch (error) {
    if (isPrunedHistoryError(error)) {
      return null;
    }
    throw error;
  }
}

async function getTokenBalance(
  wallet: TrackedWallet,
): Promise<string | undefined> {
  if (!wallet.tokenAddress) {
    return undefined;
  }
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [wallet.address],
  });
  const result = await ethCall(wallet.rpcUrl, wallet.tokenAddress, data);
  const balance = decodeFunctionResult({
    abi: erc20Abi,
    functionName: "balanceOf",
    data: result as Hex,
  });
  return `${formatBalance(balance)} ${wallet.tokenSymbol ?? "token"}`;
}

async function scanRecentWalletTransactions(
  wallet: TrackedWallet,
  scanBlocks: number,
  maxMatches?: number,
): Promise<WalletTransactionSummary[]> {
  const latestBlock = await getBlockNumber(wallet.rpcUrl);
  const startBlock = Math.max(0, latestBlock - scanBlocks + 1);
  const matches: WalletTransactionSummary[] = [];

  for (
    let batchEnd = latestBlock;
    batchEnd >= startBlock;
    batchEnd -= SCAN_BATCH_SIZE
  ) {
    if (maxMatches !== undefined && matches.length >= maxMatches) {
      break;
    }

    const batchStart = Math.max(startBlock, batchEnd - SCAN_BATCH_SIZE + 1);
    const blockNumbers: number[] = [];
    for (
      let blockNumber = batchEnd;
      blockNumber >= batchStart;
      blockNumber -= 1
    ) {
      blockNumbers.push(blockNumber);
    }

    const blocks = await Promise.all(
      blockNumbers.map(async (blockNumber) => ({
        blockNumber,
        block: await getBlockByNumber(wallet.rpcUrl, blockNumber),
      })),
    );

    for (const { blockNumber, block } of blocks) {
      if (maxMatches !== undefined && matches.length >= maxMatches) {
        break;
      }

      const timestamp = hexToNumber(block.timestamp as Hex);
      for (const tx of block.transactions) {
        if ((tx.to ?? "").toLowerCase() !== wallet.address.toLowerCase()) {
          continue;
        }

        const receipt = await getTransactionReceipt(wallet.rpcUrl, tx.hash);
        const decoded = decodeWalletExecution(wallet, tx.input);
        matches.push({
          hash: tx.hash,
          blockNumber,
          timestamp,
          from: tx.from,
          to: tx.to,
          kind: decoded ? "execute" : "other",
          status: receiptStatus(receipt),
          method: decoded?.method ?? "unknown",
          actionSummary: decoded?.targetCall.summary ?? "Unknown wallet call",
          valueEth: formatEther(hexToBigInt(tx.value as Hex)),
        });

        if (maxMatches !== undefined && matches.length >= maxMatches) {
          break;
        }
      }
    }
  }
  return matches;
}

function uniqueTransactions(txs: WalletTransactionSummary[]) {
  const map = new Map<string, WalletTransactionSummary>();
  for (const tx of txs) map.set(tx.hash.toLowerCase(), tx);
  return [...map.values()].sort((a, b) => {
    const blockDiff = (b.blockNumber ?? -1) - (a.blockNumber ?? -1);
    if (blockDiff !== 0) return blockDiff;
    return (b.timestamp ?? -1) - (a.timestamp ?? -1);
  });
}

async function mergeAndPersistWalletTransactions(
  wallet: TrackedWallet,
  freshTransactions: WalletTransactionSummary[],
) {
  const persisted = await readPersistedTransactions(wallet.address);
  const merged = uniqueTransactions([...persisted, ...freshTransactions]);
  await writePersistedTransactions(wallet.address, merged);
  return merged;
}

async function persistTransactionSummary(
  wallet: TrackedWallet,
  summary: WalletTransactionSummary,
) {
  await mergeAndPersistWalletTransactions(wallet, [summary]);
}

function serializeWallet(wallet: TrackedWallet): WalletPageData["wallet"] {
  return {
    address: wallet.address,
    label: wallet.label,
    chainId: wallet.chainId,
    tokenAddress: wallet.tokenAddress,
    tokenSymbol: wallet.tokenSymbol,
    tokenName: wallet.tokenName,
  };
}

export async function getHomeWalletsData(): Promise<WalletSummary[]> {
  const tracked = await getTrackedWallets();
  return Promise.all(
    tracked.map(async (wallet) => ({
      address: wallet.address,
      label: wallet.label,
      chainId: wallet.chainId,
      tokenAddress: wallet.tokenAddress,
      tokenSymbol: wallet.tokenSymbol,
      balanceEth: formatEther(await getBalance(wallet.rpcUrl, wallet.address)),
      tokenBalance: await getTokenBalance(wallet),
    })),
  );
}

export async function getHomeRecentTransactionsData(
  refresh = false,
): Promise<HomeRecentTransaction[]> {
  const tracked = await getTrackedWallets();
  const all = await Promise.all(
    tracked.map(async (wallet) => {
      const persisted = await readPersistedTransactions(wallet.address);
      const hasPersistedHistory = persisted.length > 0;
      const scanBlocks = refresh ? REFRESH_SCAN_BLOCKS : DEFAULT_SCAN_BLOCKS;
      const scanned =
        refresh || !hasPersistedHistory
          ? await scanRecentWalletTransactions(wallet, scanBlocks, 5)
          : [];
      const merged = await mergeAndPersistWalletTransactions(wallet, scanned);
      return merged
        .slice(0, 5)
        .map((tx) => ({ ...tx, walletAddress: wallet.address }));
    }),
  );
  return all
    .flat()
    .sort((a, b) => (b.blockNumber ?? 0) - (a.blockNumber ?? 0))
    .slice(0, 12);
}

export async function getWalletSummaryData(
  address: string,
): Promise<WalletPageData | null> {
  const wallet = await getTrackedWallet(address);
  if (!wallet) return null;
  const [code, balance, tokenBalance] = await Promise.all([
    getCode(wallet.rpcUrl, wallet.address),
    getBalance(wallet.rpcUrl, wallet.address),
    getTokenBalance(wallet),
  ]);
  return {
    wallet: serializeWallet(wallet),
    balanceEth: formatEther(balance),
    tokenBalance,
  };
}

export async function getWalletTransactionsData(
  address: string,
  refresh = false,
): Promise<WalletTransactionData | null> {
  const wallet = await getTrackedWallet(address);
  if (!wallet) return null;

  const persisted = await readPersistedTransactions(wallet.address);
  const hasPersistedHistory = persisted.length > 0;
  const scanBlocks = refresh ? REFRESH_SCAN_BLOCKS : DEFAULT_SCAN_BLOCKS;
  const scanned =
    refresh || !hasPersistedHistory
      ? await scanRecentWalletTransactions(wallet, scanBlocks)
      : [];

  const merged = await mergeAndPersistWalletTransactions(
    wallet,
    [...persisted, ...scanned],
  );
  return {
    wallet: serializeWallet(wallet),
    transactions: merged,
  };
}

export async function getWalletCodeData(
  address: string,
  kind: "source" | "bytecode",
  source: string,
) {
  const wallet = await getTrackedWallet(address);
  if (!wallet) return null;
  if (kind === "source") {
    return { kind, content: source };
  }
  return { kind, content: await getCode(wallet.rpcUrl, wallet.address) };
}

export async function getTxPageData(hash: string): Promise<TxPageData | null> {
  const trackedWallets = await getTrackedWallets();
  const discoveryRpcUrl = trackedWallets[0]?.rpcUrl;
  if (!discoveryRpcUrl) return null;

  const tx = await maybeGetTransaction(discoveryRpcUrl, hash);

  const wallet = tx?.to ? await getTrackedWallet(tx.to) : null;
  if (!wallet) return null;

  const receipt = await maybeGetReceipt(wallet.rpcUrl, hash);
  const blockNumber = tx?.blockNumber
    ? hexToNumber(tx.blockNumber as Hex)
    : receipt?.blockNumber
      ? hexToNumber(receipt.blockNumber as Hex)
      : null;
  const timestamp = await getTimestampForBlock(wallet, blockNumber, new Map());
  const decodedExecution =
    tx && tx.to ? decodeWalletExecution(wallet, tx.input) : null;
  const traceRaw =
    tx && tx.to && decodedExecution
      ? await debugTraceTransaction(wallet.rpcUrl, hash)
      : null;
  const pqVerification =
    tx && tx.to && decodedExecution
      ? analyzeTrace(traceRaw)
      : ({
          traceAvailable: false,
          proven: false,
          invocations: [],
        } as TraceEvidence);

  if (tx) {
    await persistTransactionSummary(wallet, {
      hash,
      blockNumber,
      timestamp,
      from: tx.from,
      to: tx.to,
      kind: decodedExecution ? "execute" : "other",
      status: receiptStatus(receipt),
      method: decodedExecution?.method ?? "unknown",
      actionSummary:
        decodedExecution?.targetCall.summary ?? "Unknown wallet call",
      valueEth: formatEther(hexToBigInt(tx.value as Hex)),
    });
  }

  return {
    hash,
    wallet: serializeWallet(wallet),
    type: decodedExecution ? "execute" : "unknown",
    from: tx?.from ?? "unknown",
    to: tx?.to ?? null,
    blockNumber,
    timestamp,
    status: receiptStatus(receipt),
    gasUsed: receipt?.gasUsed ?? null,
    valueEth: tx ? formatEther(hexToBigInt(tx.value as Hex)) : "0",
    decodedExecution,
    pqVerification: {
      ...pqVerification,
      precompileAddress: PRECOMPILE_ADDRESS,
    },
    rawInput: tx?.input ?? "0x",
  };
}
