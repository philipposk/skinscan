"use client";

import { useEffect, useState } from "react";

/**
 * Lesion photos live in a private bucket. The server mints a short-lived signed
 * URL per view after checking access, so nothing is ever served from a
 * guessable public path and a leaked URL expires on its own.
 */
export function SignedImage({
  path,
  alt,
  style,
  onLoadedSize,
}: {
  path: string;
  alt: string;
  style?: React.CSSProperties;
  onLoadedSize?: (w: number, h: number) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/signed-url?path=${encodeURIComponent(path)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => alive && setUrl(j.url))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [path]);

  if (error) {
    return (
      <div
        style={{
          ...style,
          display: "grid",
          placeItems: "center",
          background: "var(--line)",
          color: "var(--fg-soft)",
          fontSize: "0.78rem",
        }}
      >
        Image unavailable
      </div>
    );
  }

  if (!url) {
    return <div style={{ ...style, background: "var(--line)", animation: "pulse 1.6s ease-in-out infinite" }} />;
  }

  /* eslint-disable-next-line @next/next/no-img-element */
  return (
    <img
      src={url}
      alt={alt}
      style={style}
      onLoad={(e) => onLoadedSize?.(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
    />
  );
}
