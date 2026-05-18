"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { PageErrorBlock, PageLoadingBlock } from "@/components/AsyncState";
import {
  formatTimestamp,
  getTransactionPageData,
  renderStatusBadge,
  type TxPageData,
} from "@/lib/explorer";
import { truncateMiddle } from "@/lib/decoders";

const ADDRESS_PATTERN = /0x[a-fA-F0-9]{40}/g;

function formatInlineAddresses(value: string) {
  return value.replace(ADDRESS_PATTERN, (address) =>
    truncateMiddle(address, 8),
  );
}

function formatDeadline(deadline: string) {
  const timestamp = Number(deadline);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return null;
  }
  return formatTimestamp(timestamp);
}

function formatByteCount(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatHexQuantity(value: string | null) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.NumberFormat().format(BigInt(value));
  } catch {
    return value;
  }
}

function renderPqVerificationEvidence(trace: TxPageData["pqVerification"]) {
  if (!trace.traceAvailable) {
    return (
      <div className="proof-callout warning">
        <div className="proof-line">Trace unavailable</div>
        <div>PQ verification cannot be proven from this RPC node.</div>
      </div>
    );
  }

  if (!trace.proven) {
    return (
      <div className="proof-callout warning">
        <div className="proof-line">PQ verification not proven</div>
        <div>
          No successful <span className="code-pill hash-value">STATICCALL</span>{" "}
          to <span className="code-pill hash-value">precompile 0x1b</span> was
          found.
        </div>
      </div>
    );
  }

  const hit = trace.invocations.find((entry) => entry.success);

  return (
    <div className="proof-callout">
      <div className="proof-line">PQ verification passed:</div>
      <div>
        <span className="code-pill hash-value">STATICCALL</span> to{" "}
        <span className="code-pill hash-value">precompile 0x1b</span>
        <span>successfully made by the MLDSAWallet contract </span>
        <span className="code-pill hash-value" title={hit?.from ?? ""}>
          {truncateMiddle(hit?.from ?? "", 12)}
        </span>
      </div>
    </div>
  );
}

export function TxPage({ hash }: { hash: string }) {
  const [data, setData] = useState<TxPageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    getTransactionPageData(hash)
      .then((next) => {
        if (!cancelled) {
          if (!next) {
            setError("Transaction is not part of the tracked MLDSAWallet demo");
          } else {
            setData(next);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load transaction",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hash]);

  if (error) {
    return <PageErrorBlock message={error} />;
  }
  if (!data) {
    return <PageLoadingBlock>Loading transaction...</PageLoadingBlock>;
  }

  const status = renderStatusBadge(data.status);
  const externalTxUrl = `https://daisugi.fyi/explorer/tx/${data.hash}`;

  return (
    <div className="stack">
      <div className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Transaction</span>
      </div>

      <section className="hero">
        <div className="row">
          <h1>Transaction Detail</h1>
          <span className={status.className}>{status.label}</span>
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <h2 className="section-title">Summary</h2>
          <dl className="kv call-kv">
            <dt>Transaction hash</dt>
            <dd>
              <a
                className="mono transaction-hash-link transaction-hash-detail-link"
                href={externalTxUrl}
                target="_blank"
                rel="noreferrer"
              >
                {data.hash}
              </a>
            </dd>
            <dt>Type</dt>
            <dd>
              <span className="code-pill">{data.type}</span>
            </dd>
            <dt>From</dt>
            <dd>
              <span className="code-pill hash-value" title={data.from}>
                {truncateMiddle(data.from, 12)}
              </span>
            </dd>
            <dt>To</dt>
            <dd>
              {data.to ? (
                <span className="code-pill hash-value" title={data.to}>
                  {truncateMiddle(data.to, 12)}
                </span>
              ) : (
                "contract creation"
              )}
            </dd>
            <dt>Block</dt>
            <dd>
              {data.blockNumber === null
                ? "—"
                : new Intl.NumberFormat().format(data.blockNumber)}
            </dd>
            <dt>Timestamp</dt>
            <dd>{formatTimestamp(data.timestamp)}</dd>
            <dt>Gas used</dt>
            <dd>{formatHexQuantity(data.gasUsed)}</dd>
            <dt>Value</dt>
            <dd>{data.valueEth} ETH</dd>
          </dl>
        </div>

        <div className="card">
          <h2 className="section-title">PQ Verification</h2>
          <div className="pill-list">
            <span
              className={
                data.pqVerification.proven ? "badge success" : "badge warning"
              }
            >
              {data.pqVerification.proven ? "Proven by trace" : "Not proven"}
            </span>
            <span className="badge info badge-wrap mono">
              Precompile {data.pqVerification.precompileAddress}
            </span>
          </div>
          {renderPqVerificationEvidence(data.pqVerification)}
          {data.pqVerification.invocations.length > 0 ? (
            <div className="table-scroll">
              <table className="table table-tight">
                <thead>
                  <tr>
                    <th>Depth</th>
                    <th>Type</th>
                    <th>From</th>
                    <th>Input Size</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pqVerification.invocations.map((entry, index) => (
                    <tr key={`${entry.from}-${index}`}>
                      <td>{entry.depth}</td>
                      <td>{entry.type}</td>
                      <td className="mono">{truncateMiddle(entry.from)}</td>
                      <td>{entry.inputSize} bytes</td>
                      <td>
                        {entry.success ? "success" : (entry.error ?? "failed")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>

      <section className="stack">
        <h2 className="section-title">Decoded Wallet Call</h2>
        {data.decodedExecution ? (
          <div className="card">
            <dl className="kv call-kv">
              <dt>Wallet method</dt>
              <dd>
                <span className="code-pill">
                  {data.decodedExecution.method}
                </span>
              </dd>
              <dt>Target</dt>
              <dd>
                <span
                  className="code-pill hash-value"
                  title={data.decodedExecution.target}
                >
                  {truncateMiddle(data.decodedExecution.target, 12)}
                </span>
              </dd>
              <dt>Value</dt>
              <dd>
                <span>{data.decodedExecution.valueEth} ETH</span>
                <span className="detail-meta mono">
                  {data.decodedExecution.valueWei} wei
                </span>
              </dd>
              <dt>Deadline</dt>
              <dd>
                <span>
                  {formatDeadline(data.decodedExecution.deadline) ??
                    data.decodedExecution.deadline}
                </span>
                {formatDeadline(data.decodedExecution.deadline) ? (
                  <span className="detail-meta mono">
                    {data.decodedExecution.deadline}
                  </span>
                ) : null}
              </dd>
              <dt>Signature length</dt>
              <dd>
                {formatByteCount(data.decodedExecution.signatureLength)} bytes
              </dd>
              {data.decodedExecution.publicKey ? (
                <>
                  <dt>Public key</dt>
                  <dd>
                    <span
                      className="code-pill hash-value"
                      title={data.decodedExecution.publicKey}
                    >
                      {truncateMiddle(data.decodedExecution.publicKey, 28)}
                    </span>
                  </dd>
                </>
              ) : null}
              {data.decodedExecution.publicKeyHash ? (
                <>
                  <dt>Public key hash</dt>
                  <dd>
                    <span
                      className="code-pill hash-value"
                      title={data.decodedExecution.publicKeyHash}
                    >
                      {truncateMiddle(data.decodedExecution.publicKeyHash, 28)}
                    </span>
                  </dd>
                </>
              ) : null}
              <dt>Delegate action</dt>
              <dd title={data.decodedExecution.targetCall.summary}>
                {formatInlineAddresses(
                  data.decodedExecution.targetCall.summary,
                )}
              </dd>
              <dt>Inner calldata</dt>
              <dd>
                <code className="detail-code-block">
                  {data.decodedExecution.data}
                </code>
              </dd>
            </dl>
          </div>
        ) : (
          <div className="empty">
            This transaction is not a decoded{" "}
            <code>MLDSAWallet.execute(...)</code> call.
          </div>
        )}
      </section>

      <section className="stack">
        <h2 className="section-title">Raw Input</h2>
        <div className="card mono" style={{ overflowX: "auto" }}>
          {data.rawInput}
        </div>
      </section>
    </div>
  );
}
