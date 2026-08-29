"use client";

import { useState } from "react";

export default function Settings({ email, accessLog }: { email: string; accessLog: { action: string; created_at: string }[] }) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function wipe() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm }),
    });
    if (res.ok) {
      window.location.href = "/";
      return;
    }
    setError((await res.json().catch(() => ({}))).error ?? "Deletion failed");
    setBusy(false);
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <section className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.4rem" }}>Account</h2>
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>{email}</p>
      </section>

      <section className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.4rem" }}>Take your data with you</h2>
        <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.9rem", lineHeight: 1.6 }}>
          One JSON file with every spot, photo link, assessment, comparison, case and consent record we hold. Photo
          links stay valid for an hour, so download the images promptly.
        </p>
        <a href="/api/export" className="btn btn-ghost">
          Download everything
        </a>
      </section>

      <section className="card" style={{ padding: "1.25rem", marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.4rem" }}>Who has looked at your photos</h2>
        <p className="muted" style={{ margin: "0 0 0.85rem", fontSize: "0.9rem", lineHeight: 1.6 }}>
          Every time a dermatologist opens one of your images it is recorded here. If you have never sent a case, this
          list should be empty.
        </p>
        {accessLog.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>Nobody has accessed your data.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.2rem", display: "grid", gap: "0.3rem" }}>
            {accessLog.map((a, i) => (
              <li key={i} className="muted" style={{ fontSize: "0.85rem" }}>
                {a.action.replace(/_/g, " ")} — {new Date(a.created_at).toLocaleString("en-GB")}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" style={{ padding: "1.25rem", borderColor: "#b91c1c" }}>
        <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.4rem" }}>Delete everything</h2>
        <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.9rem", lineHeight: 1.6 }}>
          Deletes your account, every photo file, and every record. The image files themselves are removed from
          storage, not just unlinked. This cannot be undone and there is no backup we can restore from.
        </p>
        <input
          className="input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type DELETE to confirm"
          style={{ marginBottom: "0.75rem" }}
        />
        {error && <p style={{ color: "#b91c1c", fontSize: "0.86rem", margin: "0 0 0.6rem" }}>{error}</p>}
        <button className="btn btn-ghost" onClick={wipe} disabled={confirm !== "DELETE" || busy} style={{ color: "#b91c1c", borderColor: "#b91c1c" }}>
          {busy ? "Deleting…" : "Permanently delete my account"}
        </button>
      </section>
    </div>
  );
}
