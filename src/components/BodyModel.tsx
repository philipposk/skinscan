"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * The body mesh is built from primitives in code rather than loaded from a file.
 *
 * That is a deliberate trade. Every good-looking human GLB is either
 * research-licence only (SMPL/SMPL-X), non-commercial, or a multi-megabyte
 * download that hurts on mobile. A parametric body made of capsules is uglier,
 * but it is unambiguously ours to ship commercially, it is a few kilobytes, and
 * for the actual job — "which part of me is this spot on, and where roughly" —
 * it is entirely sufficient.
 *
 * Each part carries a `userData.site` matching the ISIC anatom_site_general
 * vocabulary, so a pin resolves to a body site the moment it is placed.
 *
 * LATERALITY: the model faces the camera, so a limb at NEGATIVE world x is
 * drawn on the viewer's left but belongs to the subject's RIGHT side. The
 * names below follow the subject, which is what a clinician reads. Do not
 * "fix" them to match the screen.
 */

export interface BodyPart {
  name: string;
  site: string;
  laterality: "left" | "right" | "midline";
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
  rotation?: [number, number, number];
}

const capsule = (radius: number, length: number) => new THREE.CapsuleGeometry(radius, length, 6, 18);

export function useBodyParts(): BodyPart[] {
  return useMemo<BodyPart[]>(() => {
    const parts: BodyPart[] = [
      { name: "Head", site: "head/neck", laterality: "midline", geometry: new THREE.SphereGeometry(0.30, 32, 24), position: [0, 2.62, 0] },
      { name: "Neck", site: "head/neck", laterality: "midline", geometry: capsule(0.11, 0.16), position: [0, 2.30, 0] },
      { name: "Chest", site: "anterior torso", laterality: "midline", geometry: new THREE.CapsuleGeometry(0.36, 0.52, 6, 22), position: [0, 1.80, 0] },
      { name: "Abdomen", site: "anterior torso", laterality: "midline", geometry: new THREE.CapsuleGeometry(0.31, 0.40, 6, 22), position: [0, 1.24, 0] },
      { name: "Pelvis", site: "anterior torso", laterality: "midline", geometry: new THREE.CapsuleGeometry(0.30, 0.16, 6, 22), position: [0, 0.92, 0] },

      { name: "Right shoulder", site: "upper extremity", laterality: "right", geometry: new THREE.SphereGeometry(0.16, 20, 16), position: [-0.46, 2.05, 0] },
      { name: "Left shoulder", site: "upper extremity", laterality: "left", geometry: new THREE.SphereGeometry(0.16, 20, 16), position: [0.46, 2.05, 0] },

      { name: "Right upper arm", site: "upper extremity", laterality: "right", geometry: capsule(0.105, 0.46), position: [-0.585, 1.66, 0], rotation: [0, 0, 0.13] },
      { name: "Left upper arm", site: "upper extremity", laterality: "left", geometry: capsule(0.105, 0.46), position: [0.585, 1.66, 0], rotation: [0, 0, -0.13] },
      { name: "Right forearm", site: "upper extremity", laterality: "right", geometry: capsule(0.085, 0.44), position: [-0.70, 1.12, 0], rotation: [0, 0, 0.10] },
      { name: "Left forearm", site: "upper extremity", laterality: "left", geometry: capsule(0.085, 0.44), position: [0.70, 1.12, 0], rotation: [0, 0, -0.10] },
      { name: "Right hand", site: "palms/soles", laterality: "right", geometry: new THREE.SphereGeometry(0.10, 18, 14), position: [-0.775, 0.79, 0] },
      { name: "Left hand", site: "palms/soles", laterality: "left", geometry: new THREE.SphereGeometry(0.10, 18, 14), position: [0.775, 0.79, 0] },

      { name: "Right thigh", site: "lower extremity", laterality: "right", geometry: capsule(0.145, 0.56), position: [-0.175, 0.52, 0] },
      { name: "Left thigh", site: "lower extremity", laterality: "left", geometry: capsule(0.145, 0.56), position: [0.175, 0.52, 0] },
      { name: "Right shin", site: "lower extremity", laterality: "right", geometry: capsule(0.115, 0.54), position: [-0.175, -0.12, 0] },
      { name: "Left shin", site: "lower extremity", laterality: "left", geometry: capsule(0.115, 0.54), position: [0.175, -0.12, 0] },
      { name: "Right foot", site: "palms/soles", laterality: "right", geometry: new THREE.BoxGeometry(0.19, 0.11, 0.34), position: [-0.175, -0.50, 0.08] },
      { name: "Left foot", site: "palms/soles", laterality: "left", geometry: new THREE.BoxGeometry(0.19, 0.11, 0.34), position: [0.175, -0.50, 0.08] },
    ];
    return parts;
  }, []);
}

/** Front-facing hemisphere means anterior; behind means posterior. */
export function resolveSite(partSite: string, worldZ: number): string {
  if (partSite === "anterior torso") return worldZ >= 0 ? "anterior torso" : "posterior torso";
  return partSite;
}
