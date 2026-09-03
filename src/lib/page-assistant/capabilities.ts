import type { Capability } from "@page-assistant/core";
import { LIMITATIONS, RED_FLAGS, RISK_BANDS, type RiskBand } from "@/lib/clinical";

/**
 * The assistant's entire action surface.
 *
 * Two deliberate absences. There is no capability that interprets a lesion —
 * the persona refuses, and there is nothing here it could call even if it
 * tried. And there is no destructive capability: deleting a spot or an account
 * stays a thing the user does with their own hands, because an assistant that
 * can be talked into a delete is worse than no assistant.
 *
 * `run()` executes in the browser against the signed-in session, so every read
 * is already scoped to the caller by RLS.
 */

async function api<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "same-origin" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error || `Request failed (${r.status})`);
  return d as T;
}

interface Spot {
  id: string;
  label: string;
  site: string;
  band: RiskBand | null;
  photos: number;
  lastPhoto: string | null;
  dueOn: string | null;
  overdue: boolean;
}

interface ContextPayload {
  spots: Spot[];
  cases: { ref: string; status: string; answered: boolean; urgency: string | null }[];
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

function describeSpot(s: Spot): string {
  const band = s.band ? RISK_BANDS[s.band].label : "not assessed yet";
  return `- **${s.label}** (${s.site}) — ${s.photos} ${s.photos === 1 ? "photo" : "photos"}, last on ${fmt(s.lastPhoto)}. Outcome: ${band}. Next check ${s.dueOn ? fmt(s.dueOn) + (s.overdue ? " (overdue)" : "") : "not scheduled"}.`;
}

export function skinscanCapabilities(): Capability[] {
  return [
    {
      name: "list_my_spots",
      description:
        "List the spots the signed-in user has logged: name, body site, photo count, last photo date, the app's outcome for it, and when the next check is due. Use this before answering anything about their own log. Returns no photographs.",
      parameters: { type: "object", properties: {} },
      async run() {
        return api<ContextPayload>("/api/pa/context");
      },
      render: (r: ContextPayload) =>
        r.spots.length
          ? `${r.spots.length} spot${r.spots.length === 1 ? "" : "s"} logged:\n${r.spots.map(describeSpot).join("\n")}`
          : "No spots logged yet.",
    },
    {
      name: "whats_due",
      description:
        "List only the spots that are due or overdue for a new photograph. Use when the user asks what they should do now, or what needs re-checking.",
      parameters: { type: "object", properties: {} },
      async run() {
        const d = await api<ContextPayload>("/api/pa/context");
        return { due: d.spots.filter((s) => s.dueOn && s.overdue) };
      },
      render: (r: { due: Spot[] }) =>
        r.due.length
          ? `Due for a new photo:\n${r.due.map(describeSpot).join("\n")}\n\nTake the new photo the same way as the last one — same distance, same light, coin in frame — or the comparison will not mean anything.`
          : "Nothing is due for a re-check right now.",
    },
    {
      name: "review_status",
      description: "Report the status of the user's dermatologist review cases.",
      parameters: { type: "object", properties: {} },
      async run() {
        const d = await api<ContextPayload>("/api/pa/context");
        return { cases: d.cases };
      },
      render: (r: ContextPayload) =>
        r.cases.length
          ? r.cases
              .map(
                (c) =>
                  `- Case ${c.ref}: ${c.status.replace(/_/g, " ")}${c.answered && c.urgency ? ` — the dermatologist marked it "${c.urgency.replace(/_/g, " ")}"` : ""}.`,
              )
              .join("\n")
          : "No dermatologist reviews yet.",
    },
    {
      name: "photo_guidance",
      description:
        "Explain how to take a photograph the app can actually use, including why a coin matters. Use for any question about photo quality, blur, lighting, or measuring size.",
      parameters: { type: "object", properties: {} },
      async run() {
        return {};
      },
      render: () =>
        [
          "**Light** — daylight near a window. Not a ceiling light, and flash off: flash creates a glare spot right where the detail is.",
          "**Distance** — about 10-15cm, close enough that the spot fills the frame. Tap the screen on the spot to focus, then hold still.",
          "**Scale** — put a €1 coin (23.25mm across) flat on the skin beside it. Without something of known size, the app cannot measure width at all, because apparent size changes with how close you held the camera. This is the single thing that most improves a mole log.",
          "**Consistency** — a second photo has to match the first: same distance, same light, same coin. A comparison is only as good as the consistency between the two shots.",
        ].join("\n\n"),
    },
    {
      name: "explain_outcome",
      description:
        "Explain what one of the app's four outcomes means and how soon to re-check. Valid values: reassuring, monitor, get_checked, see_doctor_soon.",
      parameters: {
        type: "object",
        properties: {
          band: {
            type: "string",
            description: "One of: reassuring, monitor, get_checked, see_doctor_soon",
          },
        },
        required: ["band"],
      },
      async run({ band }: { band: string }) {
        const key = band as RiskBand;
        if (!(key in RISK_BANDS)) throw new Error(`Unknown outcome "${band}".`);
        return { band: key };
      },
      render: (r: { band: RiskBand }) =>
        `**${RISK_BANDS[r.band].label}** — ${RISK_BANDS[r.band].blurb}\n\nIt is an instruction about what to do next, not a statement about what the spot is. The app does not diagnose and cannot rule anything out.`,
    },
    {
      name: "red_flags",
      description:
        "List the signs that mean see a doctor promptly regardless of what the app said. Use whenever a user mentions bleeding, itching, a sore that will not heal, fast growth, a nail stripe, or a spot on a palm, sole, lip or genitals.",
      parameters: { type: "object", properties: {} },
      async run() {
        return {};
      },
      render: () =>
        `See a doctor promptly if any of these apply, whatever the app told you:\n${RED_FLAGS.map((f) => `- ${f.label}`).join("\n")}\n\nIf a spot is bleeding heavily or growing quickly and you feel unwell with it, do not wait — in Greece, EKAB is 166.`,
    },
    {
      name: "limitations",
      description:
        "State plainly what SkinScan cannot do. Use when a user asks how accurate it is, whether they can trust it, or whether a result means they are fine.",
      parameters: { type: "object", properties: {} },
      async run() {
        return {};
      },
      render: () => LIMITATIONS.map((l) => `- ${l}`).join("\n"),
    },
    {
      name: "go_to",
      description:
        "Navigate the user to a page in the app. Valid destinations: spots (their list and body map), add (log a new spot), reviews (dermatologist cases), ask_dermatologist (start a review), settings (export and delete), legal (privacy and regulatory position).",
      parameters: {
        type: "object",
        properties: {
          destination: {
            type: "string",
            description: "spots | add | reviews | ask_dermatologist | settings | legal",
          },
        },
        required: ["destination"],
      },
      async run({ destination }: { destination: string }) {
        const routes: Record<string, { path: string; name: string }> = {
          spots: { path: "/app", name: "your spots" },
          add: { path: "/app/new", name: "add a spot" },
          reviews: { path: "/app/cases", name: "dermatologist reviews" },
          ask_dermatologist: { path: "/app/cases/new", name: "ask a dermatologist" },
          settings: { path: "/app/settings", name: "settings" },
          legal: { path: "/legal", name: "privacy and regulatory position" },
        };
        const target = routes[destination];
        if (!target) throw new Error(`Unknown destination "${destination}".`);
        window.location.assign(target.path);
        return target;
      },
      render: (r: { name: string }) => `Opening ${r.name}.`,
    },
    {
      name: "open_spot",
      description:
        "Open one of the user's spots by its id, so they can see its photo history and comparison. Get the id from list_my_spots first.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "The spot's id from list_my_spots" } },
        required: ["id"],
      },
      async run({ id }: { id: string }) {
        if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("That does not look like a spot id.");
        window.location.assign(`/app/lesions/${id}`);
        return { id };
      },
      render: () => "Opening that spot.",
    },
    {
      name: "export_my_data",
      description:
        "Download everything the app holds about the user as a JSON file, including links to every photo. Use for data export, GDPR, or 'give me my records' requests.",
      parameters: { type: "object", properties: {} },
      confirm: true,
      async run() {
        window.location.assign("/api/export");
        return {};
      },
      render: () =>
        "Your export is downloading. The photo links inside it stay valid for one hour, so save the images now if you need them.",
    },
  ];
}
