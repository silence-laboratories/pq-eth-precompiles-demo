import { PRECOMPILE_ADDRESS } from "@/lib/config";

export type TraceInvocation = {
  from: string;
  to: string;
  type: string;
  depth: number;
  inputSize: number;
  success: boolean;
  error?: string;
};

export type TraceEvidence = {
  traceAvailable: boolean;
  proven: boolean;
  invocations: TraceInvocation[];
};

type TraceNode = {
  from?: string;
  to?: string;
  type?: string;
  input?: string;
  error?: string;
  calls?: TraceNode[];
};

function walk(node: TraceNode, depth: number, hits: TraceInvocation[]) {
  if (node.to?.toLowerCase() === PRECOMPILE_ADDRESS.toLowerCase()) {
    hits.push({
      from: node.from ?? "unknown",
      to: node.to,
      type: node.type ?? "CALL",
      depth,
      inputSize: Math.max(0, ((node.input ?? "0x").length - 2) / 2),
      success: !node.error,
      error: node.error
    });
  }

  for (const child of node.calls ?? []) {
    walk(child, depth + 1, hits);
  }
}

export function analyzeTrace(trace: unknown): TraceEvidence {
  if (!trace || typeof trace !== "object") {
    return { traceAvailable: false, proven: false, invocations: [] };
  }

  const hits: TraceInvocation[] = [];
  walk(trace as TraceNode, 0, hits);
  return {
    traceAvailable: true,
    proven: hits.some((entry) => entry.success && entry.type.toUpperCase() === "STATICCALL"),
    invocations: hits
  };
}
