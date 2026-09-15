#!/usr/bin/env node
/**
 * The page-assistant SDK is vendored as a git submodule and consumed through
 * file: deps, so it has to exist and be built before next build runs. On a
 * clean CI checkout the submodule directory is empty, hence the clone fallback.
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "vendor", "page-assistant");
const built = path.join(dir, "packages", "core", "dist", "index.js");
const cloneOnly = process.argv.includes("--clone-only");
const buildOnly = process.argv.includes("--build-only");

/**
 * The commit the submodule points at. The fallback fetches this commit by SHA
 * rather than cloning a branch: the default branch may not have what this app
 * imports, and the branch the commit was made on can be deleted after a merge.
 * Keep it equal to the submodule pointer; test/page-assistant-pin.test.mjs checks.
 */
const PIN = "d0d8856ccb28be4e18ce97e9c470083dd3b764ea";
const REPO = "https://github.com/philipposk/page-assistant.git";

function clone() {
  if (existsSync(built) || existsSync(path.join(dir, "package.json"))) return;
  console.log(`[page-assistant] fetching ${PIN.slice(0, 7)}…`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const cmd of [
    "git init -q",
    `git remote add origin ${REPO}`,
    `git fetch --depth 1 origin ${PIN}`,
    "git checkout -q FETCH_HEAD",
  ]) {
    execSync(cmd, { cwd: dir, stdio: "inherit" });
  }
}

function build() {
  if (existsSync(built)) return;
  if (!existsSync(path.join(dir, "package.json"))) {
    console.warn("[page-assistant] vendor/page-assistant is missing — the assistant will not build");
    return;
  }
  console.log("[page-assistant] building packages…");
  execSync("npm ci --include=dev && npm run build", { cwd: dir, stdio: "inherit" });
}

if (!buildOnly) clone();
if (!cloneOnly) build();
