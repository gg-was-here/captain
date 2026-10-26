"use client";

import { useEffect } from "react";

/** Replaces the root layout when it fails, so it brings its own document and minimal styling. */
export default function GlobalError({ error, retry }: { readonly error: Error & { digest?: string }; readonly retry: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", height: "100dvh", margin: 0, alignItems: "center", justifyContent: "center" }}>
        <title>Bambii</title>
        <div style={{ textAlign: "center", maxWidth: 360, padding: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>Bambii hit a problem</h1>
          <p style={{ color: "#666", fontSize: 14 }}>Something went wrong while loading Bambii.</p>
          <button onClick={() => retry()} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, border: "1px solid #ccc", background: "#111", color: "#fff", cursor: "pointer" }} type="button">
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
