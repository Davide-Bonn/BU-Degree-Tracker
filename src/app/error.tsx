"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[App Error]", error);
  }, [error]);

  const isDbError =
    error.message?.includes("reach database") ||
    error.message?.includes("pooler") ||
    error.message?.includes("prisma") ||
    error.message?.toLowerCase().includes("connection");

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="max-w-md w-full bg-card border border-card-border rounded-xl p-8 text-center shadow-sm">
        <div className="w-12 h-12 bg-accent-light rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-accent"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        <h2 className="text-lg font-semibold mb-2">
          {isDbError ? "Database unavailable" : "Something went wrong"}
        </h2>

        <p className="text-sm text-muted mb-6 leading-relaxed">
          {isDbError
            ? "The database server is temporarily unreachable. This is usually resolved in a few seconds — please try again."
            : "An unexpected error occurred while loading this page. Try refreshing or come back in a moment."}
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={unstable_retry}
            className="w-full px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
          <a
            href="/"
            className="w-full px-4 py-2 border border-card-border rounded-lg text-sm text-muted hover:border-accent/40 transition-colors"
          >
            Go to dashboard
          </a>
        </div>

        {error.digest && (
          <p className="mt-4 text-[11px] text-muted font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
