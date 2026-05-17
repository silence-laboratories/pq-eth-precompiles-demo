"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import {
  ErrorBlock,
  LoadingBlock,
  PageErrorBlock,
  PageLoadingBlock,
  TransactionsSkeleton,
} from "@/components/AsyncState";
import {
  formatTimestamp,
  getWalletPageData,
  getWalletTransactionData,
  getWalletCodeData,
  renderStatusBadge,
  truncateMiddle,
  type WalletPageData,
  type WalletTransactionData,
} from "@/lib/explorer";

const TRANSACTION_POLL_INTERVAL_MS = 2_000;

export function WalletPage({
  address,
  showBreadcrumbs = true,
}: {
  address: string;
  showBreadcrumbs?: boolean;
}) {
  const [summary, setSummary] = useState<WalletPageData | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [txData, setTxData] = useState<WalletTransactionData | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [summaryReloadToken, setSummaryReloadToken] = useState(0);
  const [txReloadToken, setTxReloadToken] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPollingTransactions, setIsPollingTransactions] = useState(false);
  const txPollInFlightRef = useRef(false);
  const [activeCodeTab, setActiveCodeTab] = useState<"source" | "bytecode">(
    "source",
  );
  const [codeContent, setCodeContent] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    setSummaryError(null);
    getWalletPageData(address, summaryReloadToken > 0)
      .then((next) => {
        if (!cancelled) {
          if (!next) {
            setSummaryError("Wallet not found in tracked-wallets.json");
          } else {
            setSummary(next);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSummaryError(
            err instanceof Error ? err.message : "Failed to load wallet",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [address, summaryReloadToken]);

  useEffect(() => {
    let cancelled = false;
    setTxError(null);
    setTxData((current) => (txReloadToken === 0 ? current : null));
    getWalletTransactionData(address, txReloadToken > 0)
      .then((next) => {
        if (!cancelled) {
          if (!next) {
            setTxError("Wallet transactions could not be loaded");
          } else {
            setTxData(next);
            setLiveError(null);
          }
          setIsRefreshing(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setTxError(
            err instanceof Error
              ? err.message
              : "Failed to load wallet transactions",
          );
          setIsRefreshing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [address, txReloadToken]);

  useEffect(() => {
    let cancelled = false;

    async function pollTransactions() {
      if (txPollInFlightRef.current || document.visibilityState === "hidden") {
        return;
      }

      txPollInFlightRef.current = true;
      setIsPollingTransactions(true);

      try {
        const next = await getWalletTransactionData(address, true);
        if (!cancelled) {
          if (next) {
            setTxData(next);
            setTxError(null);
            setLiveError(null);
          } else {
            setLiveError("Wallet transactions could not be loaded");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setLiveError(
            err instanceof Error
              ? err.message
              : "Failed to refresh wallet transactions",
          );
        }
      } finally {
        txPollInFlightRef.current = false;
        if (!cancelled) {
          setIsPollingTransactions(false);
        }
      }
    }

    const intervalId = window.setInterval(
      pollTransactions,
      TRANSACTION_POLL_INTERVAL_MS,
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [address]);

  useEffect(() => {
    let cancelled = false;
    if (!summary) {
      return () => {
        cancelled = true;
      };
    }

    setCodeContent(null);
    setCodeError(null);

    getWalletCodeData(summary.wallet.address, activeCodeTab)
      .then((payload) => {
        if (!cancelled) {
          setCodeContent(payload.content);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCodeError(
            err instanceof Error ? err.message : "Failed to load contract code",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeCodeTab, summary]);

  function refreshWalletData() {
    if (!address || isRefreshing) {
      return;
    }
    setIsRefreshing(true);
    setCodeContent(null);
    setCodeError(null);
    setSummaryReloadToken((value) => value + 1);
    setTxReloadToken((value) => value + 1);
  }

  if (summaryError) {
    return <PageErrorBlock message={summaryError} />;
  }
  if (!summary) {
    return <PageLoadingBlock>Loading wallet details...</PageLoadingBlock>;
  }

  const transactionCount = txData?.transactions.length ?? 0;
  const transactionCountLabel = `Total: ${transactionCount}`;

  const refreshIcon = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );

  async function copyBytecode() {
    if (!codeContent) {
      return;
    }

    try {
      await navigator.clipboard.writeText(codeContent);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 1800);
    }
  }

  return (
    <div className="stack">
      {showBreadcrumbs ? (
        <div className="breadcrumbs">
          <Link href="/">Home</Link>
          <span>/</span>
          <span>Wallet</span>
        </div>
      ) : null}

      <section className="hero">
        <div className="row">
          <h1>{summary.wallet.label}</h1>
          <div className="actions">
            <button
              className={`button icon-button${isRefreshing ? " spinning" : ""}`}
              type="button"
              onClick={refreshWalletData}
              disabled={isRefreshing}
              title={isRefreshing ? "Refreshing data" : "Refresh data"}
              aria-label={isRefreshing ? "Refreshing data" : "Refresh data"}
            >
              {refreshIcon}
            </button>
          </div>
        </div>
        <p className="muted">
          Runtime-key MLDSAWallet. Post-Quantum Public key comes from calldata
          on each execute call.
        </p>
      </section>

      <section className="grid two">
        <div className="card">
          <h2 className="section-title">MLDSAWallet Contract</h2>
          <dl className="kv">
            <dt>Address</dt>
            <dd>{summary.wallet.address}</dd>
            <dt>ETH balance</dt>
            <dd>{summary.balanceEth}</dd>
            <dt>Token balance</dt>
            <dd>{summary.tokenBalance ?? "—"}</dd>
          </dl>
        </div>

        <div className="card">
          <h2 className="section-title">Demo Token Contract</h2>
          <dl className="kv">
            <dt>Token address</dt>
            <dd>{summary.wallet.tokenAddress ?? "—"}</dd>
            <dt>Token symbol</dt>
            <dd>{summary.wallet.tokenSymbol ?? "—"}</dd>
            <dt>Authorization</dt>
            <dd>Runtime public key supplied in calldata</dd>
          </dl>
        </div>
      </section>

      <section className="stack">
        <div className="row">
          <h2 className="section-title">Transactions</h2>
          <div className="transaction-header-actions">
            {txData ? (
              <span className="badge info">{transactionCountLabel}</span>
            ) : null}
            <span
              className={`badge live-status${liveError ? " warning" : " success"}${isPollingTransactions ? " checking" : ""}`}
            >
              {liveError
                ? "Live delayed"
                : isPollingTransactions
                  ? "Scanning..."
                  : "Live"}
            </span>
          </div>
        </div>
        {txError ? (
          <ErrorBlock message={txError} />
        ) : txData === null ? (
          <TransactionsSkeleton />
        ) : (
          <>
            {txData.transactions.length === 0 ? (
              <div className="empty">
                No transactions found for this wallet.
              </div>
            ) : (
              <div className="card transactions-card">
                <div className="transactions-table-scroll">
                  <table className="table transactions-table">
                    <thead>
                      <tr>
                        <th>Hash</th>
                        <th>Kind</th>
                        <th>Action</th>
                        <th>Status</th>
                        <th>Block Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txData.transactions.map((tx) => {
                        const status = renderStatusBadge(tx.status);
                        return (
                          <tr key={tx.hash}>
                            <td>
                              <Link
                                href={`/tx/${tx.hash}`}
                                className="mono transaction-hash-link"
                                title={tx.hash}
                              >
                                {truncateMiddle(tx.hash, 9)}
                              </Link>
                            </td>
                            <td>{tx.kind}</td>
                            <td>{tx.actionSummary}</td>
                            <td>
                              <span className={status.className}>
                                {status.label}
                              </span>
                            </td>
                            <td>{formatTimestamp(tx.timestamp)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="stack">
        <div className="row">
          <h2 className="section-title">Contract Code</h2>
          <div className="actions">
            <div
              className="tab-strip"
              role="tablist"
              aria-label="Contract code tabs"
            >
              <button
                type="button"
                className={`tab-button${activeCodeTab === "source" ? " active" : ""}`}
                onClick={() => setActiveCodeTab("source")}
                aria-pressed={activeCodeTab === "source"}
              >
                Source
              </button>
              <button
                type="button"
                className={`tab-button${activeCodeTab === "bytecode" ? " active" : ""}`}
                onClick={() => setActiveCodeTab("bytecode")}
                aria-pressed={activeCodeTab === "bytecode"}
              >
                Bytecode
              </button>
            </div>
          </div>
        </div>
        <div className="card code-card">
          <div className="code-toolbar">
            <span className="muted">
              {activeCodeTab === "source"
                ? "Local verified source served by the explorer backend"
                : "Live on-chain bytecode fetched with eth_getCode. Copy it into a decompiler that accepts raw bytecode."}
            </span>
          </div>
          {activeCodeTab === "source" ? (
            codeError ? (
              <div className="code-state">
                <ErrorBlock message={codeError} />
              </div>
            ) : codeContent === null ? (
              <div className="code-state">
                <LoadingBlock>Loading contract source...</LoadingBlock>
              </div>
            ) : (
              <pre className="source-view">
                <code>{codeContent}</code>
              </pre>
            )
          ) : codeError ? (
            <div className="code-state">
              <ErrorBlock message={codeError} />
            </div>
          ) : codeContent === null ? (
            <div className="code-state">
              <LoadingBlock>Loading on-chain bytecode...</LoadingBlock>
            </div>
          ) : (
            <div className="code-pane">
              <button
                className={`copy-inline-button${copyState === "copied" ? " copied" : ""}${copyState === "failed" ? " failed" : ""}`}
                type="button"
                onClick={copyBytecode}
                title={
                  copyState === "copied"
                    ? "Copied"
                    : copyState === "failed"
                      ? "Copy failed"
                      : "Copy bytecode"
                }
                aria-label={
                  copyState === "copied"
                    ? "Copied"
                    : copyState === "failed"
                      ? "Copy failed"
                      : "Copy bytecode"
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
              <pre className="source-view">
                <code>{codeContent}</code>
              </pre>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
