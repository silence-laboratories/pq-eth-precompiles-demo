import { hexToBigInt, hexToNumber, type Hex } from "viem";

type RpcError = {
  code: number;
  message: string;
  data?: unknown;
};

type RpcResponse<T> = {
  result?: T;
  error?: RpcError;
};

export type RpcTransaction = {
  hash: string;
  from: string;
  to: string | null;
  value: Hex;
  input: string;
  blockNumber: Hex | null;
  transactionIndex: Hex | null;
};

export type RpcReceipt = {
  transactionHash: string;
  status: Hex | null;
  blockNumber: Hex;
  gasUsed: Hex;
  to: string | null;
  contractAddress: string | null;
};

export type RpcBlock = {
  number: Hex;
  timestamp: Hex;
  transactions: RpcTransaction[];
};

async function rpcCall<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params
      })
    });
  } catch (error) {
    throw new Error(
      `${method} could not reach the RPC from the explorer backend. Check network access. ${
        error instanceof Error ? error.message : ""
      }`.trim(),
    );
  }

  const json = (await res.json()) as RpcResponse<T>;
  if (json.error) {
    throw new Error(`${method} failed (${json.error.code}): ${json.error.message}`);
  }
  if (json.result === undefined) {
    throw new Error(`${method} returned no result`);
  }
  return json.result;
}

export function isPrunedHistoryError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("old data not available due to pruning") ||
    message.includes("history is available from block") ||
    message.includes("pruning")
  );
}

export async function getBlockNumber(rpcUrl: string): Promise<number> {
  return hexToNumber(await rpcCall<Hex>(rpcUrl, "eth_blockNumber", []));
}

export async function getBlockByNumber(rpcUrl: string, blockNumber: number): Promise<RpcBlock> {
  return rpcCall<RpcBlock>(rpcUrl, "eth_getBlockByNumber", [
    `0x${blockNumber.toString(16)}`,
    true
  ]);
}

export async function getTransaction(rpcUrl: string, hash: string): Promise<RpcTransaction | null> {
  return rpcCall<RpcTransaction | null>(rpcUrl, "eth_getTransactionByHash", [hash]);
}

export async function getTransactionReceipt(
  rpcUrl: string,
  hash: string,
): Promise<RpcReceipt | null> {
  return rpcCall<RpcReceipt | null>(rpcUrl, "eth_getTransactionReceipt", [hash]);
}

export async function getCode(rpcUrl: string, address: string): Promise<string> {
  return rpcCall<string>(rpcUrl, "eth_getCode", [address, "latest"]);
}

export async function getBalance(rpcUrl: string, address: string): Promise<bigint> {
  return hexToBigInt(await rpcCall<Hex>(rpcUrl, "eth_getBalance", [address, "latest"]));
}

export async function ethCall(rpcUrl: string, to: string, data: string): Promise<Hex> {
  return rpcCall<Hex>(rpcUrl, "eth_call", [{ to, data }, "latest"]);
}

export async function debugTraceTransaction(
  rpcUrl: string,
  hash: string,
): Promise<unknown | null> {
  try {
    return await rpcCall<unknown>(rpcUrl, "debug_traceTransaction", [
      hash,
      { tracer: "callTracer" }
    ]);
  } catch {
    try {
      return await rpcCall<unknown>(rpcUrl, "debug_traceTransaction", [hash]);
    } catch {
      return null;
    }
  }
}
