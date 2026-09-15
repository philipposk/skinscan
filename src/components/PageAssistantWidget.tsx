"use client";

import { useEffect } from "react";
import { PageAssistant, supabaseChatHistoryAdapter } from "@page-assistant/widget";
import { createClient } from "@/lib/supabase/client";
import { skinscanCapabilities } from "@/lib/page-assistant/capabilities";
import { GREETING, KNOWLEDGE, PERSONA, SUGGESTIONS } from "@/lib/page-assistant/knowledge";

/**
 * The in-app assistant.
 *
 * These settings are privacy decisions rather than preferences:
 *
 *  - `autoScan: false`. The scanner reads the page's accessibility tree, which
 *    on these pages means every lesion label and outcome the user has on screen.
 *    Capabilities fetch what the assistant needs instead, so health data crosses
 *    to the model only when a tool deliberately sends it.
 *  - `memory: "session"`. Facts the assistant is told to remember are not kept
 *    in localStorage on a shared laptop.
 *  - `getPageState` returns the route only. No ids, no labels.
 *  - Chat history defaults to `"off"` ("Don't save"): a conversation about
 *    someone's skin lasts for the page and is gone on reload, as before. Not
 *    `"device"`, which keeps chats in localStorage after the tab closes — the
 *    same shared-laptop problem `memory: "session"` avoids. The user can choose
 *    otherwise in the assistant's settings (Data tab):
 *      - "Save to my account" is the explicit opt-in. Chats go to
 *        `skinscan_assistant_chats` (supabase/migrations/0006) through the
 *        browser's own signed-in client, so RLS limits every read and write to
 *        the user's own rows; inactive chats are deleted after 12 months. The
 *        hint above the choice says plainly what is stored and where.
 *      - "Save on this device" stays available as their own choice, kept per
 *        signed-in user (the adapter's `currentUserId()`), so the next person on
 *        the same browser never sees it.
 *    `chatHistoryFallbackMode: "off"`: if account is chosen but the session is
 *    gone, nothing falls through to localStorage. `offerSignedOutChats: false`:
 *    chats someone made on this browser while signed out are never offered to
 *    whoever signs in next.
 */
export default function PageAssistantWidget() {
  useEffect(() => {
    const base = window.location.origin;
    const supabase = createClient();
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
      chatHistoryMode: "off",
      chatHistoryFallbackMode: "off",
      offerSignedOutChats: false,
      chatHistoryAdapter: supabaseChatHistoryAdapter(supabase, {
        table: "skinscan_assistant_chats",
        app: "skinscan",
        retentionMonths: 12,
      }),
      // The message only: never the chat itself.
      onChatHistoryError: (e) => console.error("[pa/history]", e instanceof Error ? e.message : String(e)),
      strings: {
        historyModeAccountHint:
          "Your chats with the assistant, which may mention your skin or health, are stored with your SkinScan account in the EU so they are there on any device you sign in on. Choose this only if you want them kept. You can delete them here at any time.",
        historyModeDeviceHint:
          "Your chats stay in this browser, even after you close it, until you delete them. Not for a shared computer.",
      },
    });

    // Sign-in and sign-out change whose chats may be shown.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void PageAssistant.refreshChatHistory();
    });
    return () => subscription.unsubscribe();
  }, []);

  return null;
}
