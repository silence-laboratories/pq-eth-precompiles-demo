export type WalletSummary = {
  address: string;
  label: string;
  chainId: number;
  tokenAddress?: string;
  tokenSymbol?: string;
  balanceEth: string;
  tokenBalance?: string;
};

export type WalletTransactionSummary = {
  hash: string;
  blockNumber: number | null;
  timestamp: number | null;
  from: string;
  to: string | null;
  kind: "execute" | "other";
  status: "success" | "reverted" | "pending";
  method: string;
  actionSummary: string;
  valueEth: string;
};

export type HomeRecentTransaction = WalletTransactionSummary & {
  walletAddress: string;
};

export type WalletPageData = {
  wallet: {
    address: string;
    label: string;
    chainId: number;
    tokenAddress?: string;
    tokenSymbol?: string;
    tokenName?: string;
  };
  balanceEth: string;
  tokenBalance?: string;
};

export type WalletTransactionData = {
  wallet: WalletPageData["wallet"];
  transactions: WalletTransactionSummary[];
};

export type TxPageData = {
  hash: string;
  wallet: WalletPageData["wallet"] | null;
  type: "execute" | "unknown";
  from: string;
  to: string | null;
  blockNumber: number | null;
  timestamp: number | null;
  status: "success" | "reverted" | "pending";
  gasUsed: string | null;
  valueEth: string;
  decodedExecution: {
    kind: "runtime-execute";
    method: "execute";
    walletAddress: string;
    target: string;
    valueWei: string;
    valueEth: string;
    data: string;
    deadline: string;
    signatureLength: number;
    publicKey?: string;
    publicKeyHash?: string;
    targetCall: {
      kind: "erc20-transfer" | "demo-note" | "unknown";
      method: string;
      summary: string;
      details: Record<string, string>;
    };
  } | null;
  pqVerification: {
    traceAvailable: boolean;
    proven: boolean;
    invocations: Array<{
      from: string;
      to: string;
      type: string;
      depth: number;
      inputSize: number;
      success: boolean;
      error?: string;
    }>;
    precompileAddress: string;
  };
  rawInput: string;
};

type JsonInit = {
  method?: "GET" | "POST";
  body?: unknown;
};

async function fetchJson<T>(path: string, init: JsonInit = {}): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? "GET",
    headers: init.body ? { "content-type": "application/json" } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      payload?.error ?? `${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

export function getHomeWallets() {
  return fetchJson<WalletSummary[]>("/api/home/wallets");
}

export function getHomeRecentTransactions(refresh = false) {
  const suffix = refresh ? "?refresh=1" : "";
  return fetchJson<HomeRecentTransaction[]>(`/api/home/recent${suffix}`);
}

export function getWalletPageData(address: string, refresh = false) {
  const suffix = refresh ? "?refresh=1" : "";
  return fetchJson<WalletPageData | null>(
    `/api/wallet/${address}/summary${suffix}`,
  );
}

export function getWalletTransactionData(address: string, refresh = false) {
  const suffix = refresh ? "?refresh=1" : "";
  return fetchJson<WalletTransactionData | null>(
    `/api/wallet/${address}/transactions${suffix}`,
  );
}

export function getWalletCodeData(
  address: string,
  kind: "source" | "bytecode",
) {
  return fetchJson<{ kind: "source" | "bytecode"; content: string }>(
    `/api/wallet/${address}/code?kind=${kind}`,
  );
}

export function getTransactionPageData(hash: string) {
  return fetchJson<TxPageData | null>(`/api/tx/${hash}`);
}

export function renderStatusBadge(status: string) {
  switch (status) {
    case "success":
      return { label: "Success", className: "badge success" };
    case "reverted":
      return { label: "Reverted", className: "badge danger" };
    default:
      return { label: "Pending", className: "badge warning" };
  }
}

export function formatTimestamp(timestamp: number | null) {
  if (timestamp === null) {
    return "—";
  }
  return new Date(timestamp * 1000).toLocaleString();
}

export function truncateMiddle(value: string, keep = 12): string {
  if (!value || value.length <= keep * 2) {
    return value;
  }
  return `${value.slice(0, keep)}...${value.slice(-keep)}`;
}

export function summarizeTrace(trace: TxPageData["pqVerification"]) {
  if (!trace.traceAvailable) {
    return "Trace unavailable from RPC. PQ verification cannot be proven from this node.";
  }
  if (!trace.proven) {
    return "No successful STATICCALL to precompile 0x1b was found in the trace.";
  }
  const hit = trace.invocations.find((entry) => entry.success);
  return `Found ${hit?.type ?? "call"} to precompile 0x1b from MLDSAWallet contract: ${truncateMiddle(hit?.from ?? "")}.`;
}
