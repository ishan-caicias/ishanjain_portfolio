import SpaceStations from "./SpaceStations";

interface SpaceFallbackProps {
  onSelect: (stationId: string) => void;
  selectedStation?: string;
}

export default function SpaceFallback({
  onSelect,
  selectedStation,
}: SpaceFallbackProps) {
  return (
    <div
      data-testid="space-scene-fallback"
      className="absolute inset-0 flex items-end justify-center bg-surface/90 pb-20"
    >
      <div className="w-full max-w-md rounded-xl border border-royal-700/60 bg-surface-elevated/90 p-4 shadow-xl">
        <h2 className="font-heading text-base font-semibold text-text-primary">
          Space navigation
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Your browser is using the accessible station guide.
        </p>
        <SpaceStations
          compact
          onSelect={onSelect}
          selectedStation={selectedStation}
        />
      </div>
    </div>
  );
}
