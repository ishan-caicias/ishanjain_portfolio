import { useEffect, useRef, useState } from "react";
import Starfield from "@/components/islands/Starfield";
import { ShipRenderer } from "@/components/islands/space/ShipRenderer";
import SpaceFallback from "@/components/islands/space/SpaceFallback";
import SpaceStations from "@/components/islands/space/SpaceStations";
import {
  readShipQualityPreference,
  shipAssets,
  writeShipQualityPreference,
  type ShipAsset,
  type ShipQualityPreference,
} from "@/components/islands/space/shipQuality";
import { detectShipQuality } from "@/components/islands/space/shipQualityDetection";
import {
  readWarpEvent,
  type WarpPhase,
} from "@/components/islands/space/sceneEvents";
import { createSpaceTravel } from "@/components/islands/space/spaceTravel";
import { useReducedMotion } from "@/components/islands/space/useReducedMotion";
import { canCreateWebGL } from "@/components/islands/space/webglSupport";

export interface SpaceSceneProps {
  /** Injectable capability for deterministic tests; production probes WebGL. */
  webglSupported?: boolean;
  /** Injectable motion preference for deterministic tests. */
  reducedMotion?: boolean;
}

export default function SpaceScene({
  webglSupported,
  reducedMotion,
}: SpaceSceneProps = {}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const shipRendererRef = useRef<ShipRenderer | undefined>(undefined);
  const arrivalTimerRef = useRef<number | undefined>(undefined);
  const warpTimerRef = useRef<number | undefined>(undefined);
  const [shipStatus, setShipStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const [shipAsset, setShipAsset] = useState<ShipAsset>();
  const [activeShipAsset, setActiveShipAsset] = useState<ShipAsset>();
  const [shipQualityPreference, setShipQualityPreference] =
    useState<ShipQualityPreference>("auto");
  const [qualityPreferenceMessage, setQualityPreferenceMessage] = useState<
    string | undefined
  >();
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [warpPhase, setWarpPhase] = useState<WarpPhase>("idle");
  const [selectedStation, setSelectedStation] = useState<string>();
  const [travelMessage, setTravelMessage] = useState("");
  const prefersReducedMotion = useReducedMotion();
  const isReducedMotion = reducedMotion ?? prefersReducedMotion;

  const [hasWebGL, setHasWebGL] = useState<boolean | undefined>(() => {
    if (typeof webglSupported === "boolean") {
      return webglSupported;
    }
    return undefined;
  });

  useEffect(() => {
    if (typeof webglSupported === "boolean") {
      setHasWebGL(webglSupported);
      return;
    }
    setHasWebGL(canCreateWebGL());
  }, [webglSupported]);

  useEffect(() => {
    const handleWarp = (event: Event) => {
      const warpEvent = readWarpEvent(event);
      if (warpEvent) {
        setWarpPhase(warpEvent.phase);
      }
    };

    window.addEventListener("cosmos:warp", handleWarp);
    return () => window.removeEventListener("cosmos:warp", handleWarp);
  }, []);

  useEffect(() => {
    shipRendererRef.current?.setMotion({
      phase: warpPhase,
      targetBank:
        warpPhase === "warp"
          ? -0.24
          : warpPhase === "aim"
            ? 0.12
            : warpPhase === "flip"
              ? 0.4
              : warpPhase === "decel"
                ? 0.08
                : 0,
    });
  }, [warpPhase]);

  useEffect(() => {
    if (!hasWebGL) {
      return;
    }

    setShipQualityPreference(readShipQualityPreference());
    setPreferencesReady(true);
  }, [hasWebGL]);

  useEffect(() => {
    if (!preferencesReady || !hasWebGL) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setShipStatus("loading");
    setActiveShipAsset(undefined);

    void detectShipQuality(controller.signal).then((quality) => {
      if (!cancelled) {
        setShipAsset(shipAssets[quality]);
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [hasWebGL, preferencesReady]);

  useEffect(() => {
    if (!hasWebGL || !shipAsset) {
      return;
    }

    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }

    try {
      const renderer = new ShipRenderer(
        shipAsset,
        () => setShipStatus("failed"),
        (activeAsset) => {
          setActiveShipAsset(activeAsset);
          setShipStatus("ready");
        },
        { reducedMotion: isReducedMotion },
      );
      shipRendererRef.current = renderer;
      renderer.mount(overlay);

      return () => {
        shipRendererRef.current = undefined;
        renderer.dispose();
      };
    } catch {
      setShipStatus("failed");
      return undefined;
    }
  }, [hasWebGL, isReducedMotion, shipAsset]);

  useEffect(
    () => () => {
      if (arrivalTimerRef.current !== undefined) {
        window.clearTimeout(arrivalTimerRef.current);
      }
      if (warpTimerRef.current !== undefined) {
        window.clearTimeout(warpTimerRef.current);
      }
    },
    [],
  );

  const handleStationSelect = (stationId: string) => {
    const travel = createSpaceTravel(stationId, isReducedMotion);
    if (arrivalTimerRef.current !== undefined) {
      window.clearTimeout(arrivalTimerRef.current);
    }
    if (warpTimerRef.current !== undefined) {
      window.clearTimeout(warpTimerRef.current);
    }

    setSelectedStation(stationId);
    setTravelMessage(travel.departureMessage);
    const station = document.getElementById(stationId);
    station?.scrollIntoView({
      behavior: travel.scrollBehavior,
      block: "start",
    });

    if (isReducedMotion) {
      setWarpPhase("idle");
      setTravelMessage(travel.arrivalMessage);
      return;
    }

    setWarpPhase("aim");
    warpTimerRef.current = window.setTimeout(() => {
      setWarpPhase("warp");
    }, 100);
    arrivalTimerRef.current = window.setTimeout(() => {
      setWarpPhase("idle");
      setTravelMessage(travel.arrivalMessage);
    }, 500);
  };

  const handleShipQualityChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const preference = event.target.value as ShipQualityPreference;
    if (writeShipQualityPreference(preference)) {
      setShipQualityPreference(preference);
      setQualityPreferenceMessage(
        "Quality preference saved. It applies on your next page load.",
      );
      return;
    }

    setQualityPreferenceMessage("Quality preference could not be saved.");
  };

  const showFallback = hasWebGL === false || shipStatus === "failed";

  return (
    <div
      data-testid="space-scene"
      data-ship-status={shipStatus}
      data-ship-quality={activeShipAsset?.quality}
      data-warp-phase={warpPhase}
      data-reduced-motion={String(isReducedMotion)}
      className="absolute inset-0"
    >
      {!showFallback && hasWebGL === true && (
        <>
          <div className="pointer-events-none absolute inset-0">
            <Starfield />
          </div>
          <div
            ref={overlayRef}
            data-testid="ship-overlay"
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
          />
        </>
      )}

      {showFallback ? (
        <SpaceFallback
          onSelect={handleStationSelect}
          selectedStation={selectedStation}
        />
      ) : (
        <SpaceStations
          onSelect={handleStationSelect}
          selectedStation={selectedStation}
        />
      )}

      <p
        data-testid="space-travel-status"
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {travelMessage}
      </p>

      {hasWebGL === true && !showFallback && (
        <div className="pointer-events-auto absolute right-3 top-3 z-10 rounded-md bg-slate-950/70 px-2 py-1 text-xs text-slate-100 shadow-sm backdrop-blur-sm">
          <label htmlFor="ship-visual-quality" className="mr-1.5">
            Ship visual quality
          </label>
          <select
            id="ship-visual-quality"
            value={shipQualityPreference}
            onChange={handleShipQualityChange}
            className="rounded border border-slate-500 bg-slate-900 px-1 py-0.5 text-xs text-slate-100"
          >
            <option value="auto">Auto</option>
            <option value="high">High quality</option>
            <option value="data-saver">Data saver</option>
          </select>
          {qualityPreferenceMessage && (
            <p role="status" className="mt-1 max-w-48 text-[11px]">
              {qualityPreferenceMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
