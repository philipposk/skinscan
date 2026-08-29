import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100dvh", padding: "1.5rem", textAlign: "center" }}>
      <div>
        <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>Not found</h1>
        <p className="muted" style={{ margin: "0 0 1.25rem" }}>That page does not exist.</p>
        <Link href="/app" className="btn btn-primary">
          Back to your log
        </Link>
      </div>
    </main>
  );
}
