import { useEffect, useRef, useState } from "react";
import Starfield from "@/components/islands/Starfield";
import { ShipRenderer } from "@/components/islands/space/ShipRenderer";
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

export default function SpaceScene() {
  const overlayRef = useRef<HTMLDivElement>(null);
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
    setShipQualityPreference(readShipQualityPreference());
    setPreferencesReady(true);
  }, []);

  useEffect(() => {
    if (!preferencesReady) {
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
  }, [preferencesReady]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !shipAsset) {
      return;
    }

    const renderer = new ShipRenderer(
      shipAsset,
      () => setShipStatus("failed"),
      (activeAsset) => {
        setActiveShipAsset(activeAsset);
        setShipStatus("ready");
      },
    );
    renderer.mount(overlay);

    return () => renderer.dispose();
  }, [shipAsset]);

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

  return (
    <div
      data-testid="space-scene"
      data-ship-status={shipStatus}
      data-ship-quality={activeShipAsset?.quality}
      data-warp-phase={warpPhase}
      className="absolute inset-0"
    >
      <Starfield />
      <div
        ref={overlayRef}
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      />
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
    </div>
  );
}
