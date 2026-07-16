import { useEffect, useRef, useState } from "react";
import Starfield from "@/components/islands/Starfield";
import { ShipRenderer } from "@/components/islands/space/ShipRenderer";
import {
  readWarpEvent,
  type WarpPhase,
} from "@/components/islands/space/sceneEvents";

export default function SpaceScene() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [shipStatus, setShipStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
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
    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }

    const renderer = new ShipRenderer(
      () => setShipStatus("failed"),
      () => setShipStatus("ready"),
    );
    renderer.mount(overlay);

    return () => renderer.dispose();
  }, []);

  return (
    <div
      data-testid="space-scene"
      data-ship-status={shipStatus}
      data-warp-phase={warpPhase}
      className="absolute inset-0"
    >
      <Starfield />
      <div
        ref={overlayRef}
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      />
    </div>
  );
}
