"use client";

import { useEffect } from "react";
import { PageAssistant } from "@page-assistant/widget";
import { skinscanCapabilities } from "@/lib/page-assistant/capabilities";
import { GREETING, KNOWLEDGE, PERSONA, SUGGESTIONS } from "@/lib/page-assistant/knowledge";

/**
 * The in-app assistant.
 *
 * Three settings here are privacy decisions rather than preferences:
 *
 *  - `autoScan: false`. The scanner reads the page's accessibility tree, which
 *    on these pages means every lesion label and outcome the user has on screen.
 *    Capabilities fetch what the assistant needs instead, so health data crosses
 *    to the model only when a tool deliberately sends it.
 *  - `memory: "session"`. A conversation about someone's skin should not sit in
 *    localStorage on a shared laptop until they clear their browser.
 *  - `getPageState` returns the route only. No ids, no labels.
 */
export default function PageAssistantWidget() {
  useEffect(() => {
    const base = window.location.origin;
    PageAssistant.init({
      serverUrl: `${base}/api/pa`,
      appName: "SkinScan",
      launcherIcon: "help",
      persona: PERSONA,
      knowledge: KNOWLEDGE,
      capabilities: skinscanCapabilities(),
      suggestions: SUGGESTIONS,
      greeting: GREETING,
      voice: true,
      autoScan: false,
      memory: "session",
      settingsPageUrl: "/app/settings",
      settingsStorageKey: "skinscan_assistant_settings",
      getPageState: () => ({ path: window.location.pathname }),
    });
  }, []);

  return null;
}
