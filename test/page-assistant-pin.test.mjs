// The clone fallback in scripts/ensure-page-assistant.mjs must build the same
// SDK commit the submodule points at, or a checkout without submodules deploys a
// different assistant from the one that was tested.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = readFileSync(path.join(root, "scripts", "ensure-page-assistant.mjs"), "utf8");
const pin = script.match(/const PIN\s*=\s*"([0-9a-f]{40})"/)?.[1];

if (!pin) {
  console.error("FAIL  no 40-character PIN in scripts/ensure-page-assistant.mjs");
  process.exit(1);
}

// Fetch the commit itself: cloning a branch and checking out the PIN breaks once the
// branch the PIN was made on is merged and deleted.
if (!/git fetch --depth 1 origin \$\{PIN\}/.test(script) || /git clone/.test(script)) {
  console.error("FAIL  the fallback must fetch the PIN by SHA, not clone a branch");
  process.exit(1);
}
console.log("PASS  clone fallback fetches the PIN by SHA");

let gitlink;
try {
  // The index, so a staged submodule bump is checked before it is committed.
  gitlink = execSync("git ls-files -s vendor/page-assistant", { cwd: root, encoding: "utf8" }).split(/\s+/)[1];
} catch {
  /* no git metadata (e.g. a deploy tarball): nothing to compare against */
}

if (!gitlink) {
  console.log("SKIP  no submodule pointer to compare the PIN with");
  process.exit(0);
}
if (gitlink !== pin) {
  console.error(`FAIL  PIN ${pin} != submodule ${gitlink}`);
  process.exit(1);
}
console.log(`PASS  clone fallback PIN matches the submodule (${pin.slice(0, 7)})`);
