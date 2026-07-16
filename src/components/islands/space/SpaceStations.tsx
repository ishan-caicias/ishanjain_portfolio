import { spaceStations } from "./stations";

interface SpaceStationsProps {
  onSelect: (stationId: string) => void;
  selectedStation?: string;
  compact?: boolean;
}

/** Semantic controls for the decorative constellation-debris layer. */
export default function SpaceStations({
  onSelect,
  selectedStation,
  compact = false,
}: SpaceStationsProps) {
  return (
    <nav
      aria-label="Space stations"
      className={
        compact
          ? "pointer-events-auto relative z-20 mt-3"
          : "pointer-events-auto absolute inset-x-3 bottom-20 z-20 sm:inset-0 sm:bottom-auto"
      }
    >
      <ol
        className={
          compact
            ? "flex flex-col gap-2"
            : "mx-auto flex max-w-3xl flex-col gap-2 sm:block"
        }
      >
        {spaceStations.map((station, index) => (
          <li
            key={station.id}
            className={`${compact ? "" : "sm:absolute"} ${
              index === 0
                ? "sm:left-[10%] sm:top-[24%]"
                : index === 1
                  ? "sm:right-[9%] sm:top-[34%]"
                  : "sm:bottom-[19%] sm:left-[17%]"
            }`}
          >
            <button
              type="button"
              data-station={station.id}
              data-visual={station.visual}
              aria-current={selectedStation === station.id ? "true" : undefined}
              aria-label={station.accessibleName}
              onClick={() => onSelect(station.id)}
              className={`group ${station.visual} flex min-h-11 w-full items-center gap-2 rounded-full border border-royal-500/50 bg-surface-elevated/85 px-3 py-2 text-left text-xs text-text-muted shadow-lg shadow-black/20 backdrop-blur-sm transition hover:border-gold-400 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 sm:w-auto sm:min-w-32 sm:justify-center`}
            >
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 rounded-full bg-gold-400 shadow-[0_0_10px_rgba(250,204,21,0.8)] ${
                  station.visual === "relay-satellite"
                    ? "rounded-sm"
                    : station.visual === "cargo-fragment"
                      ? "rotate-45"
                      : "ring-2 ring-gold-300/50"
                }`}
              />
              <span>{station.label}</span>
              <span className="sr-only"> station</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
