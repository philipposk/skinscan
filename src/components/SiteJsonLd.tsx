/** Site-wide structured data (WebSite, Organization, SoftwareApplication) for search engines. */
const SITE_URL = "https://skinscan.6x7.gr";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "SkinScan",
      description: "Photograph a mole, pin it on a body map and watch what it does over months, with optional review by a real dermatologist. Not a diagnosis.",
      publisher: { "@id": "https://6x7.gr/#organization" },
      inLanguage: "en",
    },
    {
      "@type": "Organization",
      "@id": "https://6x7.gr/#organization",
      name: "6x7",
      url: "https://6x7.gr",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: "SkinScan",
      url: SITE_URL,
      description: "Photograph a mole, pin it on a body map and watch what it does over months, with optional review by a real dermatologist. Not a diagnosis.",
      applicationCategory: "HealthApplication",
      operatingSystem: "Web",
      publisher: { "@id": "https://6x7.gr/#organization" },
    },
  ],
};

export function SiteJsonLd() {
  return (
    <script
      type="application/ld+json"
      // Escape "<" so the JSON can never close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}
