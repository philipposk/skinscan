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
 *  - `disableChatHistory: true`. The SDK's chat sidebar is localStorage-backed,
 *    which would quietly undo the line above and keep skin conversations on the
 *    machine after the tab closes.
 *
 * No `lang` or `strings`: SkinScan renders in English only, and the SDK's
 * defaults are English.
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
      // Keep the 0.2.0 chrome this app has always shown. 0.5.0 would otherwise
      // add a chat sidebar, an export button and a larger settings modal, none
      // of which anyone asked for in a mic bug-fix.
      disableChatHistory: true,
      useExtendedSettings: false,
      autoScan: false,
      memory: "session",
      settingsPageUrl: "/app/settings",
      settingsStorageKey: "skinscan_assistant_settings",
      getPageState: () => ({ path: window.location.pathname }),
    });
  }, []);

  return null;
}
