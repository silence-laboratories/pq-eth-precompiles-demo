import {
  decodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  keccak256,
  type Hex
} from "viem";

import { demoRecipientAbi, erc20Abi, walletRuntimeAbi } from "@/lib/contracts";
import type { TrackedWallet } from "@/lib/tracked-wallet";

export type DecodedTargetCall =
  | {
      kind: "erc20-transfer";
      method: "transfer";
      summary: string;
      details: { recipient: string; amount: string };
    }
  | {
      kind: "demo-note";
      method: "setNote";
      summary: string;
      details: { note: string };
    }
  | {
      kind: "unknown";
      method: string;
      summary: string;
      details: Record<string, string>;
    };

export type DecodedWalletExecution = {
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
  targetCall: DecodedTargetCall;
};

export function truncateMiddle(value: string, keep = 12): string {
  if (!value || value.length <= keep * 2) {
    return value;
  }
  return `${value.slice(0, keep)}...${value.slice(-keep)}`;
}

function decodeTargetCall(wallet: TrackedWallet, target: string, data: Hex): DecodedTargetCall {
  try {
    const decoded = decodeFunctionData({ abi: erc20Abi, data });
    if (
      decoded.functionName === "transfer" &&
      wallet.tokenAddress &&
      wallet.tokenAddress.toLowerCase() === target.toLowerCase()
    ) {
      const [recipient, amount] = decoded.args;
      return {
        kind: "erc20-transfer",
        method: "transfer",
        summary: `Transfer ${formatUnits(amount, 18)} ${wallet.tokenSymbol ?? "token"} to ${recipient}`,
        details: {
          recipient,
          amount: amount.toString()
        }
      };
    }
  } catch {}

  try {
    const decoded = decodeFunctionData({ abi: demoRecipientAbi, data });
    if (
      decoded.functionName === "setNote" &&
      wallet.demoRecipientAddress &&
      wallet.demoRecipientAddress.toLowerCase() === target.toLowerCase()
    ) {
      const [note] = decoded.args;
      return {
        kind: "demo-note",
        method: "setNote",
        summary: `Set demo note to "${note}"`,
        details: { note }
      };
    }
  } catch {}

  return {
    kind: "unknown",
    method: "unknown",
    summary: "Unknown delegate action",
    details: { target, calldata: data }
  };
}

export function decodeWalletExecution(
  wallet: TrackedWallet,
  input: string,
): DecodedWalletExecution | null {
  try {
    const decoded = decodeFunctionData({
      abi: walletRuntimeAbi,
      data: input as Hex
    });
    if (decoded.functionName !== "execute") {
      return null;
    }

    const [publicKey, target, value, innerData, deadline, signature] = decoded.args;
    const checksumTarget = getAddress(target);
    return {
      kind: "runtime-execute",
      method: "execute",
      walletAddress: wallet.address,
      target: checksumTarget,
      valueWei: value.toString(),
      valueEth: formatEther(value),
      data: innerData,
      deadline: deadline.toString(),
      signatureLength: Math.max(0, (signature.length - 2) / 2),
      publicKey,
      publicKeyHash: keccak256(publicKey),
      targetCall: decodeTargetCall(wallet, checksumTarget, innerData)
    };
  } catch {
    return null;
  }
}

export function formatBalance(rawBalance: bigint, decimals = 18): string {
  return formatUnits(rawBalance, decimals);
}
