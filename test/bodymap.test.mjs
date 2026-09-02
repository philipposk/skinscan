/**
 * Body-map picking test.
 *
 * Reads the part table straight out of BodyModel.tsx so it cannot drift from
 * what the app actually renders, rebuilds the same scene and camera headlessly,
 * and fires rays through it.
 *
 * The laterality assertion is the important one: the model faces the camera, so
 * a limb drawn on the viewer's LEFT belongs to the subject's RIGHT. Getting that
 * backwards would send a dermatologist to the wrong arm.
 *
 *   node test/bodymap.test.mjs
 */
import { readFileSync } from "node:fs";
import * as THREE from "three";

const src = readFileSync(new URL("../src/components/BodyModel.tsx", import.meta.url), "utf8");

const PART_RE =
  /\{\s*name:\s*"([^"]+)",\s*site:\s*"([^"]+)",\s*laterality:\s*"([^"]+)",\s*geometry:\s*([^,]+(?:\([^)]*\))?),\s*position:\s*\[([^\]]+)\](?:,\s*rotation:\s*\[([^\]]+)\])?\s*\}/g;

function buildGeometry(expr) {
  const cap = expr.match(/^capsule\(([\d.]+),\s*([\d.]+)\)$/);
  if (cap) return new THREE.CapsuleGeometry(+cap[1], +cap[2], 6, 18);
  const named = expr.match(/new THREE\.(\w+)\(([^)]*)\)/);
  if (!named) throw new Error(`unparsed geometry: ${expr}`);
  const args = named[2].split(",").map((s) => Number(s.trim()));
  return new THREE[named[1]](...args);
}

const parts = [];
for (const m of src.matchAll(PART_RE)) {
  parts.push({
    name: m[1],
    site: m[2],
    laterality: m[3],
    geometry: buildGeometry(m[4].trim()),
    position: m[5].split(",").map(Number),
    rotation: m[6] ? m[6].split(",").map(Number) : null,
  });
}

const scene = new THREE.Scene();
for (const p of parts) {
  const mesh = new THREE.Mesh(p.geometry, new THREE.MeshStandardMaterial());
  mesh.name = p.name;
  mesh.userData = { site: p.site, laterality: p.laterality };
  mesh.position.set(...p.position);
  if (p.rotation) mesh.rotation.set(...p.rotation);
  scene.add(mesh);
}
scene.updateMatrixWorld(true);

// Must mirror the camera in BodyMap.tsx.
const camera = new THREE.PerspectiveCamera(42, 676 / 398, 0.1, 1000);
camera.position.set(0, 1.25, 4.4);
camera.lookAt(0, 1.1, 0);
camera.updateMatrixWorld(true);

const resolveSite = (site, z) =>
  site === "anterior torso" ? (z >= 0 ? "anterior torso" : "posterior torso") : site;

function pick(ndcX, ndcY) {
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
  const hit = ray.intersectObjects(scene.children, false)[0];
  if (!hit) return null;
  return {
    part: hit.object.name,
    site: resolveSite(hit.object.userData.site, hit.point.z),
    laterality: hit.object.userData.laterality,
    z: hit.point.z,
  };
}

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  → ${detail}` : ""}`);
};

check(`every part parsed out of the source (${parts.length})`, parts.length === 19, `${parts.length} parts`);

const head = pick(0, 0.9);
check("a ray high on the canvas hits the head", head?.part === "Head", head?.part ?? "no hit");

const chest = pick(0, 0.4);
check("mid-upper hits the chest, anterior", chest?.part === "Chest" && chest.site === "anterior torso", `${chest?.part} / ${chest?.site}`);

const belly = pick(0, 0);
check("dead centre hits the abdomen", belly?.part === "Abdomen", belly?.part ?? "no hit");

// The laterality check. Viewer's left (negative NDC x) must return the
// subject's RIGHT limb, because the model is facing us.
const viewerLeft = pick(-0.17, 0.17);
check(
  "viewer's left side is the subject's RIGHT limb",
  viewerLeft?.laterality === "right" && viewerLeft.part.startsWith("Right"),
  `${viewerLeft?.part} (laterality "${viewerLeft?.laterality}")`,
);

const viewerRight = pick(0.17, 0.17);
check(
  "viewer's right side is the subject's LEFT limb",
  viewerRight?.laterality === "left" && viewerRight.part.startsWith("Left"),
  `${viewerRight?.part} (laterality "${viewerRight?.laterality}")`,
);

// Every paired mesh must be named for the side it anatomically belongs to.
const mismatched = parts.filter((p) => {
  const x = p.position[0];
  if (Math.abs(x) < 0.01) return false;
  const expected = x < 0 ? "right" : "left";
  return p.laterality !== expected || !p.name.toLowerCase().startsWith(expected);
});
check("no paired part is named for the wrong side", mismatched.length === 0, mismatched.map((p) => p.name).join(", ") || "all correct");

// Legs are reachable — they sit either side of a narrow gap at dead centre.
const leg = pick(-0.06, -0.5);
check("lower canvas reaches a leg", leg?.site === "lower extremity", `${leg?.part ?? "no hit"}`);

// Clicking empty space must not silently pin to something.
const miss = pick(-0.95, 0.95);
check("a click on empty space misses the body", miss === null, miss?.part ?? "no hit");

// Front/back split, which is what separates anterior from posterior torso.
check(
  "torso resolves front vs back by hit depth",
  resolveSite("anterior torso", 0.3) === "anterior torso" && resolveSite("anterior torso", -0.3) === "posterior torso",
);

console.log(failures === 0 ? "\nAll body-map checks passed." : `\n${failures} FAILURE(S)`);
process.exit(failures ? 1 : 0);
