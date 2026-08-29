"use client";

import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useState } from "react";
import * as THREE from "three";
import { resolveSite, useBodyParts } from "./BodyModel";
import type { BodyPin } from "@/lib/types";
import type { RiskBand } from "@/lib/clinical";

export interface MapPin {
  id: string;
  label: string;
  pin: BodyPin;
  band: RiskBand | null;
}

const BAND_COLOUR: Record<string, string> = {
  reassuring: "#15803d",
  monitor: "#d97706",
  get_checked: "#ea580c",
  see_doctor_soon: "#dc2626",
};

function Body({
  pins,
  onPlace,
  onSelect,
  placing,
  selectedId,
}: {
  pins: MapPin[];
  onPlace?: (pin: BodyPin, site: string, laterality: string) => void;
  onSelect?: (id: string) => void;
  placing: boolean;
  selectedId?: string | null;
}) {
  const parts = useBodyParts();
  const [hover, setHover] = useState<string | null>(null);

  function handleClick(e: ThreeEvent<MouseEvent>, partName: string, site: string, laterality: string) {
    if (!placing || !onPlace) return;
    e.stopPropagation();
    // event.point is in world space; the body group sits at the origin with no
    // transform, so world coords double as stable model coords.
    const p = e.point;
    onPlace(
      { mesh: partName, x: Number(p.x.toFixed(4)), y: Number(p.y.toFixed(4)), z: Number(p.z.toFixed(4)), view: p.z >= 0 ? "front" : "back" },
      resolveSite(site, p.z),
      laterality,
    );
  }

  return (
    <group>
      {parts.map((part) => (
        <mesh
          key={part.name}
          geometry={part.geometry}
          position={part.position}
          rotation={part.rotation ?? [0, 0, 0]}
          onClick={(e) => handleClick(e, part.name, part.site, part.laterality)}
          onPointerOver={(e) => {
            e.stopPropagation();
            if (placing) setHover(part.name);
          }}
          onPointerOut={() => setHover(null)}
        >
          <meshStandardMaterial
            color={placing && hover === part.name ? "#5eead4" : "#cbd5d5"}
            roughness={0.85}
            metalness={0.02}
            transparent
            opacity={0.97}
          />
        </mesh>
      ))}

      {pins.map((p) => (
        <mesh
          key={p.id}
          position={[p.pin.x, p.pin.y, p.pin.z]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(p.id);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "auto";
          }}
        >
          <sphereGeometry args={[p.id === selectedId ? 0.055 : 0.038, 16, 12]} />
          <meshBasicMaterial color={BAND_COLOUR[p.band ?? "monitor"] ?? "#0f766e"} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export default function BodyMap({
  pins,
  placing = false,
  onPlace,
  onSelect,
  selectedId,
  height = 460,
}: {
  pins: MapPin[];
  placing?: boolean;
  onPlace?: (pin: BodyPin, site: string, laterality: string) => void;
  onSelect?: (id: string) => void;
  selectedId?: string | null;
  height?: number;
}) {
  return (
    <div
      style={{
        height,
        borderRadius: 14,
        overflow: "hidden",
        background: "linear-gradient(180deg, rgba(45,212,191,0.07), transparent 60%)",
        border: "1px solid var(--line)",
        touchAction: "none",
        cursor: placing ? "crosshair" : "grab",
      }}
    >
      <Canvas
        camera={{ position: [0, 1.25, 4.4], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
      >
        <color attach="background" args={["#00000000"]} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[3, 6, 5]} intensity={1.1} />
        <directionalLight position={[-4, 2, -5]} intensity={0.45} />
        <Suspense fallback={null}>
          <Body pins={pins} onPlace={onPlace} onSelect={onSelect} placing={placing} selectedId={selectedId} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          minDistance={2.4}
          maxDistance={7}
          target={[0, 1.1, 0]}
          maxPolarAngle={Math.PI * 0.85}
          minPolarAngle={Math.PI * 0.12}
        />
      </Canvas>
    </div>
  );
}
