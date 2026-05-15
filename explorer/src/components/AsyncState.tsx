import type { ReactNode } from "react";

export function LoadingBlock({ children = "Loading..." }: { children?: ReactNode }) {
  return <div className="loading">{children}</div>;
}

export function ErrorBlock({ message }: { message: string }) {
  return <div className="error">{message}</div>;
}

export function PageLoadingBlock({ children = "Loading..." }: { children?: ReactNode }) {
  return (
    <div className="page-state">
      <LoadingBlock>{children}</LoadingBlock>
    </div>
  );
}

export function PageErrorBlock({ message }: { message: string }) {
  return (
    <div className="page-state">
      <ErrorBlock message={message} />
    </div>
  );
}

export function TransactionsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card skeleton-card" aria-hidden="true">
      <div className="skeleton-table">
        <div className="skeleton-row skeleton-header">
          <span className="skeleton skeleton-line short" />
          <span className="skeleton skeleton-line short" />
          <span className="skeleton skeleton-line short" />
          <span className="skeleton skeleton-line short" />
          <span className="skeleton skeleton-line short" />
        </div>
        {Array.from({ length: rows }).map((_, index) => (
          <div className="skeleton-row" key={index}>
            <span className="skeleton skeleton-line long" />
            <span className="skeleton skeleton-line medium" />
            <span className="skeleton skeleton-line medium" />
            <span className="skeleton skeleton-chip" />
            <span className="skeleton skeleton-line medium" />
          </div>
        ))}
      </div>
    </div>
  );
}
