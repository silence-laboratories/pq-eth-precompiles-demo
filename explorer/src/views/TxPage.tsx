"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { PageErrorBlock, PageLoadingBlock } from "@/components/AsyncState";
import {
  formatTimestamp,
  getTransactionPageData,
  renderStatusBadge,
  summarizeTrace,
  type TxPageData,
} from "@/lib/explorer";
import { truncateMiddle } from "@/lib/decoders";

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
          <dl className="kv">
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
            <dd>{data.type}</dd>
            <dt>From</dt>
            <dd className="mono">{data.from}</dd>
            <dt>To</dt>
            <dd className="mono">{data.to ?? "contract creation"}</dd>
            <dt>Block</dt>
            <dd>{data.blockNumber ?? "—"}</dd>
            <dt>Timestamp</dt>
            <dd>{formatTimestamp(data.timestamp)}</dd>
            <dt>Gas used</dt>
            <dd>{data.gasUsed ?? "—"}</dd>
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
          <p className="muted proof-copy">
            {summarizeTrace(data.pqVerification)}
          </p>
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
            <dl className="kv">
              <dt>Wallet method</dt>
              <dd>{data.decodedExecution.method}</dd>
              <dt>Target</dt>
              <dd className="mono">{data.decodedExecution.target}</dd>
              <dt>Value</dt>
              <dd>
                {data.decodedExecution.valueEth} ETH (
                {data.decodedExecution.valueWei} wei)
              </dd>
              <dt>Deadline</dt>
              <dd>{data.decodedExecution.deadline}</dd>
              <dt>Signature length</dt>
              <dd>{data.decodedExecution.signatureLength} bytes</dd>
              {data.decodedExecution.publicKey ? (
                <>
                  <dt>Public key</dt>
                  <dd className="mono">
                    {truncateMiddle(data.decodedExecution.publicKey, 28)}
                  </dd>
                </>
              ) : null}
              {data.decodedExecution.publicKeyHash ? (
                <>
                  <dt>Public key hash</dt>
                  <dd className="mono">
                    {data.decodedExecution.publicKeyHash}
                  </dd>
                </>
              ) : null}
              <dt>Delegate action</dt>
              <dd>{data.decodedExecution.targetCall.summary}</dd>
              <dt>Inner calldata</dt>
              <dd className="mono">{data.decodedExecution.data}</dd>
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
