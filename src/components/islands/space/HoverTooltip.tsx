export interface HoverTooltipData {
  name: string;
  type: string;
  rarity: string;
  color: string;
  rarityColor: string;
  dist: string;
  mg: string;
  cta: string;
  x: number;
  y: number;
}

/**
 * Tooltip shown while hovering a curated body or field star. Flips above/below the cursor
 * depending on vertical position. Ported from Space Portfolio.dc.html lines 827-841.
 */
export default function HoverTooltip({
  data,
}: {
  data: HoverTooltipData | null;
}) {
  if (!data) return null;

  const x = Math.max(140, Math.min(window.innerWidth - 140, data.x));
  const flip = data.y < 170;

  return (
    <div
      className="pointer-events-none fixed z-[80] w-[236px] rounded-xl border border-[#3f51b5]/50 bg-[#0d1120]/94 px-3.5 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.5)] backdrop-blur-md"
      style={{
        left: x,
        top: data.y,
        transform: `translate(-50%, ${flip ? "22px" : "calc(-100% - 18px)"})`,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: data.color, boxShadow: `0 0 8px ${data.color}` }}
        />
        <span className="font-heading text-[16.5px] font-bold text-text-primary">
          {data.name}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span
          className="rounded px-1.5 py-px font-mono text-[10px] font-bold tracking-wider text-[#0a0e27]"
          style={{ background: data.rarityColor }}
        >
          {data.rarity}
        </span>
        <span className="rounded border border-[#3f51b5]/50 px-1.5 py-px font-mono text-[10px] tracking-wider text-[#9fa8da]">
          {data.type}
        </span>
      </div>
      <div className="mt-1.5 font-mono text-[11px] text-[#7986cb]">
        {data.dist} · mag {data.mg}
      </div>
      <div className="mt-1.5 font-mono text-[10.5px] tracking-wider text-[#ffd54f]">
        {data.cta}
      </div>
    </div>
  );
}
