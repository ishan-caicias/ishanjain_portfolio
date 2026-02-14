import { Suspense, useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  Box3,
  Box3Helper,
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  MathUtils,
  Vector3,
  type Group,
  type Mesh,
} from "three";
import {
  orchestratorStore,
  type SectionKey,
} from "@/app/state/orchestratorStore";

const SHIP_GLTF_URL = "/models/low_poly_ship/scene.gltf";

/** Aerial camera: pitch down from above (30°), optional yaw for asymmetry */
export const PITCH_DEG = 30;
export const YAW_DEG = -20;
const pitch = MathUtils.degToRad(PITCH_DEG);
const CAM_DIR = new Vector3(0, Math.sin(pitch), Math.cos(pitch))
  .normalize()
  .clone()
  .applyAxisAngle(new Vector3(0, 1, 0), MathUtils.degToRad(YAW_DEG));
const CAM_TARGET = new Vector3(0, 0, 0);
const FALLBACK_DISTANCE = 3.5;
const CAM_INITIAL_POS = CAM_DIR.clone().multiplyScalar(FALLBACK_DISTANCE);

export const CAMERA_FOV = 50;
const FIT_DISTANCE_MIN = 2.5;
const FIT_DISTANCE_MAX = 7;

/** glTF ship mesh: scale to match previous cylinder (~0.4–0.5 radius, ~1.2 height); model bounds ~0.5×1.9×0.9 */
const SHIP_SCALE = 0.55;

const SECTION_KEYS: SectionKey[] = [
  "bio",
  "skills",
  "experience",
  "projects",
  "writing",
  "connect",
].filter((k): k is NonNullable<SectionKey> => k !== null);

const IDLE_BOB_AMP = 0.08;
const IDLE_BOB_FREQ = 0.6;
const IDLE_YAW_SPEED = 0.15;

/** Door anchor: position and rotation in ship local space (after centering). */
export type DoorAnchor = { pos: [number, number, number]; rot: [number, number, number] };

const HALF_PI = -Math.PI / 2;
/** Default door anchors (ship local space). Tune via debug nudge or paste JSON into DOOR_ANCHORS. */
export const DEFAULT_DOOR_ANCHORS: Record<NonNullable<SectionKey>, DoorAnchor> = {
  bio: { pos: [-0.125, 0.52, -0.09], rot: [HALF_PI, 0, 0] },
  skills: { pos: [-0.125, 0.52, 0.09], rot: [HALF_PI, 0, 0] },
  experience: { pos: [0, 0.52, -0.09], rot: [HALF_PI, 0, 0] },
  projects: { pos: [0, 0.52, 0.09], rot: [HALF_PI, 0, 0] },
  writing: { pos: [0.125, 0.52, -0.09], rot: [HALF_PI, 0, 0] },
  connect: { pos: [0.125, 0.52, 0.09], rot: [HALF_PI, 0, 0] },
};

export const DOOR_ANCHORS_STORAGE_KEY = "shipDoorAnchorsV1";

export function loadAnchorsFromStorage(): Record<NonNullable<SectionKey>, DoorAnchor> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DOOR_ANCHORS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, DoorAnchor>;
    const keys: NonNullable<SectionKey>[] = ["bio", "skills", "experience", "projects", "writing", "connect"];
    for (const k of keys) {
      const a = parsed[k];
      if (!a || !Array.isArray(a.pos) || a.pos.length !== 3 || !Array.isArray(a.rot) || a.rot.length !== 3)
        return null;
    }
    return parsed as Record<NonNullable<SectionKey>, DoorAnchor>;
  } catch {
    return null;
  }
}

/** Iris door (v1): circular aperture + blades */
const IRIS_R = 0.08;
const BLADE_COUNT = 8;
const BLADE_R_IN = 0.012;
const BLADE_R_OUT = 0.11;
const BLADE_ANGULAR_HALF = (Math.PI * 2) / BLADE_COUNT * 0.6;
const BLADE_OPEN_ROT = -0.38;
const BLADE_OPEN_SLIDE = 0.04;
const BLADE_RETRACT = 0.012;
const IRIS_FRAME_R_IN = IRIS_R;
const IRIS_FRAME_R_OUT = IRIS_R * 1.18;
const IRIS_FRAME_DEPTH = 0.008;

/** Open/close animation durations (seconds) */
const OPEN_DURATION = 0.45;
const CLOSE_DURATION = 0.35;

const isShipDebug =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("ship-debug");

/** When true, render magenta spheres at ship origin and each door anchor. Only on when URL has ship-debug=1. */
export const DEBUG_DOOR_MARKERS = isShipDebug;

/** Single blade wedge in YZ plane (hatch local): r_in..r_out, -aw..+aw */
function createBladeGeometry(): BufferGeometry {
  const r_in = BLADE_R_IN;
  const r_out = BLADE_R_OUT;
  const aw = BLADE_ANGULAR_HALF;
  const positions = new Float32Array([
    0, r_in * Math.cos(-aw), r_in * Math.sin(-aw),
    0, r_out * Math.cos(-aw), r_out * Math.sin(-aw),
    0, r_out * Math.cos(aw), r_out * Math.sin(aw),
    0, r_in * Math.cos(aw), r_in * Math.sin(aw),
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  const geom = new BufferGeometry();
  geom.setAttribute("position", new BufferAttribute(positions, 3));
  geom.setIndex(new BufferAttribute(indices, 1));
  geom.computeVertexNormals();
  return geom;
}

/** Circle line in YZ plane for debug iris outline */
function createIrisCircleGeometry(): BufferGeometry {
  const n = 32;
  const points: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    points.push(0, IRIS_R * Math.cos(t), IRIS_R * Math.sin(t));
  }
  const geom = new BufferGeometry();
  geom.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
  return geom;
}

const BLADE_GEOM = createBladeGeometry();
const IRIS_CIRCLE_GEOM = createIrisCircleGeometry();
const IRIS_CIRCLE_LINES = Array.from({ length: 6 }, () =>
  new Line(IRIS_CIRCLE_GEOM, new LineBasicMaterial({ color: 0x00ff00, depthTest: false }))
);

const IRIS_BLADE_MATERIAL_PROPS = {
  color: "#0b1633",
  metalness: 0.25,
  roughness: 0.75,
  emissive: "#1e3a8a",
  emissiveIntensity: 0.3,
} as const;
const IRIS_FRAME_EMISSIVE_DIM = 0.12;
const IRIS_FRAME_EMISSIVE_ACTIVE = 0.42;
/** Seam light: thin ring, only active door, subtle pulse */
const SEAM_R_IN = IRIS_R - 0.012;
const SEAM_R_OUT = IRIS_R;
const SEAM_EMISSIVE_BASE = 0.25;
const SEAM_PULSE_AMP = 0.12;
const SEAM_PULSE_FREQ = 2.5;

function ShipDebugBounds({
  center,
  size,
}: {
  center: Vector3;
  size: Vector3;
}) {
  const box = useMemo(() => {
    const c = new Vector3(-center.x, -center.y, -center.z);
    return new Box3().setFromCenterAndSize(c, size);
  }, [center, size]);
  const boxHelper = useMemo(() => new Box3Helper(box, 0x888888), [box]);
  const axisLen = useMemo(
    () => Math.max(size.x, size.y, size.z) * 0.5,
    [size]
  );
  const lineX = useMemo(() => {
    const g = new BufferGeometry().setFromPoints([
      new Vector3(0, 0, 0),
      new Vector3(axisLen, 0, 0),
    ]);
    return new Line(g, new LineBasicMaterial({ color: 0xff0000 }));
  }, [axisLen]);
  const lineY = useMemo(() => {
    const g = new BufferGeometry().setFromPoints([
      new Vector3(0, 0, 0),
      new Vector3(0, axisLen, 0),
    ]);
    return new Line(g, new LineBasicMaterial({ color: 0x00ff00 }));
  }, [axisLen]);
  const lineZ = useMemo(() => {
    const g = new BufferGeometry().setFromPoints([
      new Vector3(0, 0, 0),
      new Vector3(0, 0, axisLen),
    ]);
    return new Line(g, new LineBasicMaterial({ color: 0x0000ff }));
  }, [axisLen]);
  return (
    <>
      <primitive object={boxHelper} />
      <primitive object={lineX} />
      <primitive object={lineY} />
      <primitive object={lineZ} />
    </>
  );
}

function easeInOutCubic(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

function ShipGltf({
  onBoundsReady,
}: {
  onBoundsReady?: (center: Vector3, size: Vector3) => void;
}) {
  const { scene } = useGLTF(SHIP_GLTF_URL);
  const clone = useMemo(() => scene.clone(true), [scene]);
  const reported = useRef(false);
  useFrame(() => {
    if (!onBoundsReady || reported.current) return;
    reported.current = true;
    clone.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(clone);
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    onBoundsReady(center, size);
  });
  return (
    <primitive
      object={clone}
      scale={[SHIP_SCALE, SHIP_SCALE, SHIP_SCALE]}
      castShadow={false}
      receiveShadow={false}
    />
  );
}

interface ShipModelProps {
  onShipOpened: (key: NonNullable<SectionKey>) => void;
  fitRef: React.MutableRefObject<{ distance: number | null; maxDim: number | null }>;
  onCameraDebug: (data: {
    position: [number, number, number];
    target: [number, number, number];
    maxDim: number;
    fitDistance: number;
    pitch?: number;
    yaw?: number;
  }) => void;
  doorAnchors: Record<NonNullable<SectionKey>, DoorAnchor>;
}

function ShipModel({ onShipOpened, fitRef, onCameraDebug, doorAnchors }: ShipModelProps) {
  const groupRef = useRef<Group>(null);
  const shipRootRef = useRef<Group>(null);
  const shipSizeRef = useRef<Vector3 | null>(null);
  const doorGroupRefs = useRef<(Group | null)[]>([]);
  const doorBladeRefs = useRef<(Mesh | null)[][]>(
    Array.from({ length: SECTION_KEYS.length }, () =>
      Array.from({ length: BLADE_COUNT }, () => null)
    )
  );
  const doorFrameRefs = useRef<(Mesh | null)[]>(
    Array.from({ length: SECTION_KEYS.length }, () => null)
  );
  const doorSeamRefs = useRef<(Mesh | null)[]>(
    Array.from({ length: SECTION_KEYS.length }, () => null)
  );
  const [activeSectionFromStore, setActiveSectionFromStore] = useState(
    () => orchestratorStore.getState().activeSection
  );
  useEffect(() => {
    return orchestratorStore.subscribe(() =>
      setActiveSectionFromStore(orchestratorStore.getState().activeSection)
    );
  }, []);
  const progressRef = useRef(0);
  const openedFiredRef = useRef(false);
  const closedFiredRef = useRef(false);
  const lastShipStateRef = useRef(orchestratorStore.getState().shipState);
  const reducedMotion = useReducedMotion();

  const [debugBounds, setDebugBounds] = useState<{
    center: Vector3;
    size: Vector3;
  } | null>(null);

  useEffect(() => {
    SECTION_KEYS.forEach((key, i) => {
      const doorGroup = doorGroupRefs.current[i];
      if (!doorGroup) return;
      const anchor = doorAnchors[key];
      if (!anchor) return;
      doorGroup.position.set(anchor.pos[0], anchor.pos[1], anchor.pos[2]);
      doorGroup.rotation.set(anchor.rot[0], anchor.rot[1], anchor.rot[2]);
    });
  }, [doorAnchors, activeSectionFromStore]);

  const handleBoundsReady = (center: Vector3, size: Vector3) => {
    shipRootRef.current?.position.set(-center.x, -center.y, -center.z);
    shipSizeRef.current = size.clone();
    const topY = size.y / 2 + 0.02;
    if (DEBUG_DOOR_MARKERS && typeof window !== "undefined") {
      setDebugBounds({ center: center.clone(), size: size.clone() });
      (window as unknown as { __SHIP_BOUNDS__?: { size: { x: number; y: number; z: number }; topY: number } }).__SHIP_BOUNDS__ = {
        size: { x: size.x, y: size.y, z: size.z },
        topY,
      };
    }
    const maxDim = Math.max(size.x, size.y, size.z);
    const halfFov = (CAMERA_FOV * Math.PI) / 180 / 2;
    const fitDistance = Math.max(
      FIT_DISTANCE_MIN,
      Math.min(FIT_DISTANCE_MAX, maxDim / (2 * Math.tan(halfFov)))
    );
    fitRef.current = { distance: fitDistance, maxDim };
    const pos = CAM_TARGET.clone().add(CAM_DIR.clone().multiplyScalar(fitDistance));
    onCameraDebug({
      position: [pos.x, pos.y, pos.z],
      target: [0, 0, 0],
      maxDim,
      fitDistance,
      pitch: PITCH_DEG,
      yaw: YAW_DEG,
    });
  };

  useFrame((_, delta) => {
    const { shipState, activeSection } = orchestratorStore.getState();
    const group = groupRef.current;
    if (!group) return;

    // Idle: gentle bob + yaw
    const t = performance.now() * 0.001;
    group.position.y = IDLE_BOB_AMP * Math.sin(t * IDLE_BOB_FREQ * Math.PI * 2);
    group.rotation.y += delta * IDLE_YAW_SPEED;

    const activeIdx = activeSection ? SECTION_KEYS.indexOf(activeSection) : -1;
    const targetOpen = (shipState === "opening" || shipState === "open") && activeSection ? 1 : 0;

    if (shipState === "opening" && lastShipStateRef.current !== "opening") {
      progressRef.current = 0;
      openedFiredRef.current = false;
    }
    if (shipState === "closing" && lastShipStateRef.current !== "closing") {
      closedFiredRef.current = false;
    }
    lastShipStateRef.current = shipState;

    if (targetOpen === 1) {
      if (reducedMotion) {
        progressRef.current = 1;
        orchestratorStore.setShipState("open");
        if (!openedFiredRef.current) {
          openedFiredRef.current = true;
          onShipOpened(activeSection!);
        }
      } else {
        progressRef.current = Math.min(1, progressRef.current + delta / OPEN_DURATION);
        if (progressRef.current >= 1) {
          orchestratorStore.setShipState("open");
          if (!openedFiredRef.current) {
            openedFiredRef.current = true;
            onShipOpened(activeSection!);
          }
        }
      }
    } else {
      if (reducedMotion) {
        progressRef.current = 0;
        orchestratorStore.setShipState("idle");
        closedFiredRef.current = true;
      } else {
        progressRef.current = Math.max(0, progressRef.current - delta / CLOSE_DURATION);
        if (progressRef.current <= 0 && !closedFiredRef.current) {
          closedFiredRef.current = true;
          orchestratorStore.setShipState("idle");
        }
      }
    }

    const progress = progressRef.current;
    const eased = easeInOutCubic(progress);

    const pulseT = performance.now() * 0.001;
    const seamPulse = SEAM_EMISSIVE_BASE + SEAM_PULSE_AMP * Math.sin(pulseT * SEAM_PULSE_FREQ * Math.PI * 2);
    const frameRamp = IRIS_FRAME_EMISSIVE_DIM + (IRIS_FRAME_EMISSIVE_ACTIVE - IRIS_FRAME_EMISSIVE_DIM) * eased;

    doorBladeRefs.current.forEach((blades, i) => {
      const open = activeIdx === i ? eased : 0;
      const isActive = activeIdx === i;
      blades.forEach((blade, j) => {
        if (!blade) return;
        const theta = (j / BLADE_COUNT) * Math.PI * 2;
        blade.rotation.x = theta + open * BLADE_OPEN_ROT;
        blade.position.y = open * BLADE_OPEN_SLIDE * Math.cos(theta);
        blade.position.z = open * BLADE_OPEN_SLIDE * Math.sin(theta);
        blade.position.x = -open * BLADE_RETRACT;
      });
      const frame = doorFrameRefs.current[i];
      if (frame?.material && "emissiveIntensity" in frame.material) {
        (frame.material as { emissiveIntensity: number }).emissiveIntensity =
          isActive ? frameRamp : IRIS_FRAME_EMISSIVE_DIM;
      }
      const seam = doorSeamRefs.current[i];
      if (seam) {
        seam.visible = isActive && (shipState === "opening" || shipState === "open");
        if (seam.visible && seam.material && "emissiveIntensity" in seam.material) {
          (seam.material as { emissiveIntensity: number }).emissiveIntensity = seamPulse;
        }
      }
    });

    if (isShipDebug && typeof window !== "undefined") {
      (window as unknown as { __SHIP_DOOR_PROGRESS__?: number }).__SHIP_DOOR_PROGRESS__ = progress;
      window.dispatchEvent(
        new CustomEvent("ship-door-progress", { detail: { doorProgress: progress } })
      );
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={shipRootRef}>
        <ShipGltf onBoundsReady={handleBoundsReady} />
      </group>
      {/* Debug: ship origin marker only (hatch markers are per-group below when DEBUG_DOOR_MARKERS) */}
      {DEBUG_DOOR_MARKERS && (
        <mesh position={[0, 0, 0]} renderOrder={999}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshBasicMaterial color="#ff00ff" depthTest={false} />
        </mesh>
      )}
      {/* Debug: bbox wireframe + RGB axes (ship-debug only) */}
      {DEBUG_DOOR_MARKERS && debugBounds && (
        <ShipDebugBounds center={debugBounds.center} size={debugBounds.size} />
      )}
      {/* Iris doors: only visible when a section is selected or ship-debug */}
      {((activeSectionFromStore !== null) || DEBUG_DOOR_MARKERS) &&
        SECTION_KEYS.map((key, i) => (
          <group
            key={key}
            ref={(el) => {
              doorGroupRefs.current[i] = el;
            }}
          >
            {DEBUG_DOOR_MARKERS && (
              <mesh position={[0, 0, 0]} renderOrder={999}>
                <sphereGeometry args={[0.03, 12, 12]} />
                <meshBasicMaterial color="#ff00ff" depthTest={false} />
              </mesh>
            )}
            {/* Recessed frame ring (YZ plane); emissive ramped in useFrame when active */}
            <mesh
              ref={(el) => {
                doorFrameRefs.current[i] = el;
              }}
              position={[0, 0, -IRIS_FRAME_DEPTH / 2]}
              rotation={[0, Math.PI / 2, 0]}
              castShadow={false}
              receiveShadow={false}
            >
              <ringGeometry args={[IRIS_FRAME_R_IN, IRIS_FRAME_R_OUT, 32]} />
              <meshStandardMaterial
                color="#060d1a"
                metalness={0.2}
                roughness={0.8}
                emissive="#1e3a8a"
                emissiveIntensity={IRIS_FRAME_EMISSIVE_DIM}
                side={2}
              />
            </mesh>
            {/* Seam light: thin ring, only visible for active door during opening/open, pulsed in useFrame */}
            <mesh
              ref={(el) => {
                doorSeamRefs.current[i] = el;
              }}
              position={[0.002, 0, 0]}
              rotation={[0, Math.PI / 2, 0]}
              visible={false}
              castShadow={false}
              receiveShadow={false}
            >
              <ringGeometry args={[SEAM_R_IN, SEAM_R_OUT, 32]} />
              <meshStandardMaterial
                color="#0b1633"
                emissive="#3b82f6"
                emissiveIntensity={SEAM_EMISSIVE_BASE}
                metalness={0.1}
                roughness={0.9}
                side={2}
              />
            </mesh>
            {Array.from({ length: BLADE_COUNT }, (_, j) => (
              <mesh
                key={j}
                ref={(el) => {
                  doorBladeRefs.current[i][j] = el;
                }}
                geometry={BLADE_GEOM}
                castShadow={false}
                receiveShadow={false}
              >
                <meshStandardMaterial {...IRIS_BLADE_MATERIAL_PROPS} />
              </mesh>
            ))}
            {DEBUG_DOOR_MARKERS && (
              <primitive object={IRIS_CIRCLE_LINES[i]} renderOrder={999} />
            )}
          </group>
        ))}
    </group>
  );
}

function CameraController({
  fitRef,
}: {
  fitRef: React.MutableRefObject<{
    distance: number | null;
    maxDim: number | null;
  }>;
}) {
  const { camera } = useThree();
  useFrame(() => {
    const d = fitRef.current?.distance ?? null;
    camera.position.copy(
      CAM_TARGET.clone().add(CAM_DIR.clone().multiplyScalar(d ?? FALLBACK_DISTANCE))
    );
    camera.lookAt(CAM_TARGET);
  });
  return null;
}

interface SceneContentProps {
  fitRef: React.MutableRefObject<{
    distance: number | null;
    maxDim: number | null;
  }>;
  onCameraDebug: (data: {
    position: [number, number, number];
    target: [number, number, number];
    maxDim: number;
    fitDistance: number;
    pitch?: number;
    yaw?: number;
  }) => void;
  onShipOpened: (key: NonNullable<SectionKey>) => void;
  doorAnchors: Record<NonNullable<SectionKey>, DoorAnchor>;
}

function SceneContent({
  fitRef,
  onCameraDebug,
  onShipOpened,
  doorAnchors,
}: SceneContentProps) {
  return (
    <>
      <ShipModel
        onShipOpened={onShipOpened}
        fitRef={fitRef}
        onCameraDebug={onCameraDebug}
        doorAnchors={doorAnchors}
      />
      <CameraController fitRef={fitRef} />
    </>
  );
}

export interface SpaceshipSceneProps {
  onShipOpened?: (key: NonNullable<SectionKey>) => void;
  className?: string;
}

function sectionDisplayName(key: SectionKey): string {
  if (key == null) return "";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function getInitialAnchors(): Record<NonNullable<SectionKey>, DoorAnchor> {
  if (DEBUG_DOOR_MARKERS) {
    const stored = loadAnchorsFromStorage();
    if (stored) return stored;
  }
  return DEFAULT_DOOR_ANCHORS;
}

export default function SpaceshipScene({
  onShipOpened = () => {},
  className = "",
}: SpaceshipSceneProps) {
  const fitRef = useRef<{ distance: number | null; maxDim: number | null }>({
    distance: null,
    maxDim: null,
  });
  const [doorAnchors, setDoorAnchors] = useState<Record<NonNullable<SectionKey>, DoorAnchor>>(getInitialAnchors);
  useEffect(() => {
    if (!DEBUG_DOOR_MARKERS) return;
    const onAnchorsChanged = () => {
      setDoorAnchors(loadAnchorsFromStorage() ?? DEFAULT_DOOR_ANCHORS);
    };
    window.addEventListener("ship-door-anchors-changed", onAnchorsChanged);
    return () => window.removeEventListener("ship-door-anchors-changed", onAnchorsChanged);
  }, []);
  const [hudState, setHudState] = useState(() => {
    const s = orchestratorStore.getState();
    return { activeSection: s.activeSection, shipState: s.shipState };
  });
  useEffect(() => {
    return orchestratorStore.subscribe(() => {
      const s = orchestratorStore.getState();
      setHudState({ activeSection: s.activeSection, shipState: s.shipState });
    });
  }, []);
  const onCameraDebug = (data: {
    position: [number, number, number];
    target: [number, number, number];
    maxDim: number;
    fitDistance: number;
    pitch?: number;
    yaw?: number;
  }) => {
    if (typeof window === "undefined") return;
    (window as unknown as { __SHIP_CAMERA_DEBUG__?: typeof data }).__SHIP_CAMERA_DEBUG__ =
      data;
    window.dispatchEvent(
      new CustomEvent("ship-camera-debug", { detail: data })
    );
  };
  const showDockingHud =
    hudState.activeSection != null &&
    (hudState.shipState === "opening" || hudState.shipState === "open");
  const dockingLabel = showDockingHud
    ? hudState.shipState === "open"
      ? `Docked: ${sectionDisplayName(hudState.activeSection)}`
      : `Docking: ${sectionDisplayName(hudState.activeSection)}`
    : "";

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        background: "transparent",
      }}
      data-testid="spaceship-scene"
    >
      {showDockingHud && (
        <div
          aria-live="polite"
          aria-atomic="true"
          className="absolute left-1/2 top-2 -translate-x-1/2 rounded border border-royal-500/60 bg-surface-elevated/90 px-3 py-1.5 font-mono text-xs text-royal-200"
          data-testid="docking-hud"
        >
          {dockingLabel}
        </div>
      )}
      <Canvas
        camera={{
          position: [CAM_INITIAL_POS.x, CAM_INITIAL_POS.y, CAM_INITIAL_POS.z],
          fov: CAMERA_FOV,
        }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
        frameloop="always"
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 2, 2]} intensity={0.8} />
        <Suspense fallback={null}>
          <SceneContent
            fitRef={fitRef}
            onCameraDebug={onCameraDebug}
            onShipOpened={onShipOpened}
            doorAnchors={doorAnchors}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
