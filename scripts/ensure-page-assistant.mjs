#!/usr/bin/env node
/**
 * The page-assistant SDK is vendored as a git submodule and consumed through
 * file: deps, so it has to exist and be built before next build runs. On a
 * clean CI checkout the submodule directory is empty, hence the clone fallback.
 */
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "vendor", "page-assistant");
const built = path.join(dir, "packages", "core", "dist", "index.js");
const cloneOnly = process.argv.includes("--clone-only");
const buildOnly = process.argv.includes("--build-only");

function clone() {
  if (existsSync(built) || existsSync(path.join(dir, "package.json"))) return;
  console.log("[page-assistant] cloning…");
  execSync("git clone --depth 1 https://github.com/philipposk/page-assistant.git vendor/page-assistant", {
    cwd: root,
    stdio: "inherit",
  });
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
