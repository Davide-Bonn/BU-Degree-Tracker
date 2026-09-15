"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: 400,
            width: "100%",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: "2rem",
            textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,.08)",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              background: "#fee2e2",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
            }}
          >
            <svg
              style={{ width: 24, height: 24, color: "#cc0000" }}
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

          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            Application error
          </h2>
          <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "1.5rem", lineHeight: 1.5 }}>
            The app encountered a critical error and could not load. Please try refreshing the page.
          </p>

          <button
            onClick={unstable_retry}
            style={{
              width: "100%",
              padding: "0.5rem 1rem",
              background: "#cc0000",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload page
          </button>

          {error.digest && (
            <p style={{ marginTop: "1rem", fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
              Error ID: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
