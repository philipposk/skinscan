import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://skinscan.6x7.gr"),
  title: {
    default: "SkinScan — track your moles over time",
    template: "%s · SkinScan",
  },
  description:
    "Photograph a mole, pin it on a body map, and watch what it does over months. Optional review by a real dermatologist. Not a diagnosis.",
  openGraph: {
    title: "SkinScan",
    description:
      "A photo diary for your skin, with AI that describes what it sees and a dermatologist you can ask.",
    url: "https://skinscan.6x7.gr",
    siteName: "SkinScan",
    type: "website",
  },
  // Health data. Nothing under /app or /doctor should ever be indexed.
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1416" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
