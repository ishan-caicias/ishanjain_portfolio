import { useState, useEffect } from "react";
import {
  orchestratorStore,
  type SectionKey,
} from "@/app/state/orchestratorStore";
import {
  CAMERA_FOV,
  DEBUG_DOOR_MARKERS,
  DEFAULT_DOOR_ANCHORS,
  DOOR_ANCHORS_STORAGE_KEY,
  loadAnchorsFromStorage,
  type DoorAnchor,
} from "./SpaceshipScene";

type CameraDebugData = {
  position: [number, number, number];
  target: [number, number, number];
  maxDim: number;
  fitDistance: number;
  pitch?: number;
  yaw?: number;
};

const SECTION_KEYS: NonNullable<SectionKey>[] = [
  "bio",
  "skills",
  "experience",
  "projects",
  "writing",
  "connect",
];

function isDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("ship-debug");
}

export default function ShipDebugUI() {
  const [state, setState] = useState(orchestratorStore.getState());
  const [show, setShow] = useState(false);
  const [cameraDebug, setCameraDebug] = useState<CameraDebugData | null>(() => {
    if (typeof window === "undefined") return null;
    return (window as unknown as { __SHIP_CAMERA_DEBUG__?: CameraDebugData })
      .__SHIP_CAMERA_DEBUG__ ?? null;
  });
  const [doorProgress, setDoorProgress] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const v = (window as unknown as { __SHIP_DOOR_PROGRESS__?: number }).__SHIP_DOOR_PROGRESS__;
    return v != null ? v : null;
  });
  const [anchorEdit, setAnchorEdit] = useState<Record<NonNullable<SectionKey>, DoorAnchor>>(() =>
    loadAnchorsFromStorage() ?? { ...DEFAULT_DOOR_ANCHORS }
  );
  const [selectedAnchorKey, setSelectedAnchorKey] = useState<NonNullable<SectionKey>>("bio");

  const saveAnchorsAndNotify = (next: Record<NonNullable<SectionKey>, DoorAnchor>) => {
    setAnchorEdit(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(DOOR_ANCHORS_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("ship-door-anchors-changed"));
    }
  };
  const nudgePos = (axis: 0 | 1 | 2, delta: number) => {
    const anchor = anchorEdit[selectedAnchorKey];
    if (!anchor) return;
    const pos: [number, number, number] = [
      anchor.pos[0] + (axis === 0 ? delta : 0),
      anchor.pos[1] + (axis === 1 ? delta : 0),
      anchor.pos[2] + (axis === 2 ? delta : 0),
    ];
    saveAnchorsAndNotify({ ...anchorEdit, [selectedAnchorKey]: { ...anchor, pos } });
  };
  const nudgeRot = (axis: 0 | 1 | 2, delta: number) => {
    const anchor = anchorEdit[selectedAnchorKey];
    if (!anchor) return;
    const rot: [number, number, number] = [
      anchor.rot[0] + (axis === 0 ? delta : 0),
      anchor.rot[1] + (axis === 1 ? delta : 0),
      anchor.rot[2] + (axis === 2 ? delta : 0),
    ];
    saveAnchorsAndNotify({ ...anchorEdit, [selectedAnchorKey]: { ...anchor, rot } });
  };
  const copyAnchorsJson = () => {
    const json = JSON.stringify(anchorEdit, null, 2);
    void navigator.clipboard.writeText(json);
  };

  useEffect(() => {
    setShow(isDebugEnabled());
  }, []);

  useEffect(() => {
    const win = typeof window !== "undefined" ? window : null;
    if (!win) return;
    const onCameraDebug = (e: CustomEvent<CameraDebugData>) => {
      setCameraDebug(e.detail);
    };
    win.addEventListener("ship-camera-debug", onCameraDebug as EventListener);
    setCameraDebug(
      (win as unknown as { __SHIP_CAMERA_DEBUG__?: CameraDebugData })
        .__SHIP_CAMERA_DEBUG__ ?? null
    );
    const onDoorProgress = (e: CustomEvent<{ doorProgress: number }>) => {
      setDoorProgress(e.detail.doorProgress);
    };
    win.addEventListener("ship-door-progress", onDoorProgress as EventListener);
    return () => {
      win.removeEventListener(
        "ship-camera-debug",
        onCameraDebug as EventListener
      );
      win.removeEventListener(
        "ship-door-progress",
        onDoorProgress as EventListener
      );
    };
  }, []);

  useEffect(() => {
    return orchestratorStore.subscribe(setState);
  }, []);

  if (!show) return null;

  return (
    <>
      {/* Door Test Controls: trigger open/close without scrolling */}
      <div
        className="fixed left-4 top-4 z-[100] flex flex-col gap-2 rounded-lg border border-royal-500 bg-surface-elevated/95 p-3 font-mono text-xs"
        data-testid="door-test-controls"
      >
        <div className="text-text-dim font-semibold uppercase tracking-wider">
          Door Test Controls
        </div>
        <div>
          <span className="text-text-dim">shipState:</span>{" "}
          <span data-testid="door-test-ship-state">{state.shipState}</span>
        </div>
        <div>
          <span className="text-text-dim">activeSection:</span>{" "}
          <span data-testid="door-test-active-section">
            {state.activeSection ?? "—"}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {SECTION_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => orchestratorStore.selectSection(key)}
              className="rounded bg-royal-700 px-2 py-1 text-royal-200 hover:bg-royal-600"
              data-testid={`door-test-${key}`}
            >
              {key}
            </button>
          ))}
          <button
            type="button"
            onClick={() => orchestratorStore.closeSection()}
            className="rounded bg-royal-800 px-2 py-1 text-royal-300 hover:bg-royal-700"
            data-testid="door-test-close"
          >
            Close
          </button>
        </div>
      </div>

      <div
        className="fixed bottom-20 left-4 z-[100] flex flex-col gap-2 rounded-lg border border-royal-600 bg-surface-elevated/95 p-3 font-mono text-xs"
        data-testid="ship-debug-ui"
      >
      <div>
        <span className="text-text-dim">ship:</span>{" "}
        <span data-testid="ship-state">{state.shipState}</span>
      </div>
      <div>
        <span className="text-text-dim">section:</span>{" "}
        <span data-testid="active-section">{state.activeSection ?? "—"}</span>
      </div>
      <div>
        <span className="text-text-dim">camera:</span>{" "}
        <span data-testid="ship-bounds">
          {cameraDebug
            ? `pos [${cameraDebug.position.map((n) => n.toFixed(2)).join(", ")}] · target [${cameraDebug.target.join(", ")}] · maxDim ${cameraDebug.maxDim.toFixed(2)} · dist ${cameraDebug.fitDistance.toFixed(2)} · fov ${CAMERA_FOV}${cameraDebug.pitch != null || cameraDebug.yaw != null ? ` · pitch ${cameraDebug.pitch ?? "—"}° · yaw ${cameraDebug.yaw ?? "—"}°` : ""}`
            : `fov ${CAMERA_FOV} (waiting for bounds)`}
        </span>
      </div>
      <div>
        <span className="text-text-dim">doors:</span>{" "}
        <span data-testid="doors-mounted">
          {DEBUG_DOOR_MARKERS ? "true" : "false"}
        </span>
      </div>
      <div>
        <span className="text-text-dim">doorProgress:</span>{" "}
        <span data-testid="door-progress">
          {doorProgress != null ? doorProgress.toFixed(2) : "—"}
        </span>
      </div>

      {/* Door Anchor Nudge (debug only) */}
      <div className="border-t border-royal-600 pt-2 mt-2">
        <div className="text-text-dim font-semibold uppercase tracking-wider mb-1">
          Door Anchor Nudge
        </div>
        <div className="flex flex-wrap gap-1 mb-1">
          {SECTION_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedAnchorKey(key)}
              className={`rounded px-2 py-0.5 text-xs ${selectedAnchorKey === key ? "bg-royal-600 text-white" : "bg-royal-800 text-royal-300 hover:bg-royal-700"}`}
              data-testid={`anchor-select-${key}`}
            >
              {key}
            </button>
          ))}
        </div>
        {(() => {
          const a = anchorEdit[selectedAnchorKey];
          if (!a) return null;
          return (
            <div className="mb-1.5 text-text-dim text-[11px]">
              pos [{a.pos[0].toFixed(3)}, {a.pos[1].toFixed(3)}, {a.pos[2].toFixed(3)}]<br />
              rot [{a.rot[0].toFixed(3)}, {a.rot[1].toFixed(3)}, {a.rot[2].toFixed(3)}]
            </div>
          );
        })()}
        <div className="flex flex-wrap gap-1 mb-1">
          {(["X", "Y", "Z"] as const).map((axis, i) => (
            <span key={axis} className="flex items-center gap-0.5">
              <button type="button" onClick={() => nudgePos(i, -0.02)} className="rounded bg-royal-800 px-1.5 py-0.5 text-royal-300 hover:bg-royal-700" aria-label={`${axis}-`}>{axis}-</button>
              <button type="button" onClick={() => nudgePos(i, 0.02)} className="rounded bg-royal-800 px-1.5 py-0.5 text-royal-300 hover:bg-royal-700" aria-label={`${axis}+`}>{axis}+</button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 mb-1">
          {(["RX", "RY", "RZ"] as const).map((axis, i) => (
            <span key={axis} className="flex items-center gap-0.5">
              <button type="button" onClick={() => nudgeRot(i, -0.05)} className="rounded bg-royal-800 px-1.5 py-0.5 text-royal-300 hover:bg-royal-700" aria-label={`${axis}-`}>{axis}-</button>
              <button type="button" onClick={() => nudgeRot(i, 0.05)} className="rounded bg-royal-800 px-1.5 py-0.5 text-royal-300 hover:bg-royal-700" aria-label={`${axis}+`}>{axis}+</button>
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={copyAnchorsJson}
          className="rounded bg-royal-700 px-2 py-1 text-royal-200 hover:bg-royal-600 text-xs"
          data-testid="anchor-copy-json"
        >
          Copy JSON
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {SECTION_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => orchestratorStore.selectSection(key)}
            className="rounded bg-royal-700 px-2 py-1 text-royal-200 hover:bg-royal-600"
            data-testid={`debug-section-${key}`}
          >
            {key}
          </button>
        ))}
        <button
          type="button"
          onClick={() => orchestratorStore.closeSection()}
          className="rounded bg-royal-800 px-2 py-1 text-royal-300 hover:bg-royal-700"
          data-testid="debug-close"
        >
          close
        </button>
      </div>
    </div>
    </>
  );
}
