import { useCallback, useEffect, useRef, useState } from "react";
import type { CelestialEntry } from "@/data/celestial/celestial.d.ts";
import type { SpaceEngineElement } from "@/lib/space-engine.d.ts";
import { entryForFieldStar, fmtDist, rarityColor } from "@/lib/spaceHelpers";
import { SHORT_BIO } from "@/content/links";
import { INITIAL_SCENE_STATE, SECTOR_BODIES, STATIONS } from "./space/types";
import type {
  CardStyleMode,
  SceneState,
  SectionDisplayMode,
} from "./space/types";
import HUD from "./space/HUD";
import HoverTooltip from "./space/HoverTooltip";
import type { HoverTooltipData } from "./space/HoverTooltip";
import MissionControlBar from "./space/MissionControlBar";
import type { CommandSuggestion } from "./space/MissionControlBar";
import WarpOverlay from "./space/WarpOverlay";
import ArrivalVista from "./space/ArrivalVista";
import CollectorCard from "./space/CollectorCard";
import SectionOverlay from "./space/SectionOverlay";
import StationSprites from "./space/StationSprites";
import type { SpriteRefMap } from "./space/StationSprites";
import type { SpaceEngineBody } from "@/lib/space-engine.d.ts";

interface SpaceSceneProps {
  density?: number;
  constellations?: boolean;
  ship?: boolean;
}

function engineEl(): SpaceEngineElement | null {
  return document.querySelector("space-engine") as SpaceEngineElement | null;
}

function catalog(): CelestialEntry[] {
  return window.CELESTIAL || [];
}

function entryFor(id: string | null): CelestialEntry | null {
  if (!id) return null;
  const found = catalog().find((x) => x.id === id);
  if (found) return found;
  if (!id.startsWith("fs-")) return null;
  const en = engineEl();
  if (!en) return null;
  const idx = parseInt(id.slice(3), 10);
  const fi = en.fieldInfo(idx);
  if (!fi) return null;
  return entryForFieldStar(id, idx, fi);
}

/**
 * PF-07 Phases 1-4: mounts the ported <space-engine> WebGL scene, its "always visible
 * during travel" chrome (HUD, mission control, hover tooltip, warp transit overlay,
 * arrival vista), the collector-card and section-overlay dossiers, station sprite markers,
 * and the travel-mode/scroll-mode toggle. Header nav links work via document-level click
 * delegation (see the event-wiring effect). The mobile responsive pass
 * (design_handoff_mobile_responsive) also relocated two HUD actions - the mode toggle and
 * Data & Licenses - into Header.astro's mobile dropdown menu; the same click delegate below
 * recognizes clicks on those via `[data-mobile-menu-action]`.
 */
export default function SpaceScene({
  density = 1,
  constellations = true,
  ship = true,
}: SpaceSceneProps) {
  const engineRef = useRef<SpaceEngineElement | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [state, setState] = useState<SceneState>(INITIAL_SCENE_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Mobile responsive pass (design_handoff_mobile_responsive): auto-resolves nav mode to
  // scroll on mobile / travel on desktop unless the user has explicitly overridden it via
  // the toggle. `mobileRef` mirrors `mobile` for the same reason `stateRef` mirrors `state` -
  // so effects that don't re-subscribe on every render (click delegation, the rAF tick) can
  // read the latest value without going stale.
  const [mobile, setMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches,
  );
  const mobileRef = useRef(mobile);
  mobileRef.current = mobile;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const sectionTravelRef = useRef<string | null>(null);
  const desiredBodyRef = useRef<string | null>(null);
  const spriteElsRef = useRef<SpriteRefMap>({});
  const bodyCacheRef = useRef<Record<string, SpaceEngineBody | undefined>>({});
  const vistaTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const patch = useCallback((p: Partial<SceneState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  const isTravel =
    (state.navOverride ?? (mobile ? "scroll" : "travel")) === "travel";

  const toggleNavMode = useCallback(() => {
    patch({
      navOverride: isTravel ? "scroll" : "travel",
      sectionOpen: null,
      vista: null,
    });
  }, [isTravel, patch]);

  const openCredits = useCallback(() => {
    patch({ sectionOpen: "credits", vista: null, cardId: null });
  }, [patch]);

  // --- Phase 4: body.ij-travel class toggles CSS that hides scrollable sections/footer ---
  useEffect(() => {
    document.body.classList.toggle("ij-travel", isTravel);
    if (isTravel) window.scrollTo(0, 0);
  }, [isTravel]);

  const dispatchRoute = useCallback(() => {
    const en = engineEl();
    if (!en || !desiredBodyRef.current) return;
    if (en.warp && en.warp.mode !== "idle") return;
    if (desiredBodyRef.current === "__home") {
      if (Math.hypot(en.cam[0], en.cam[1], en.cam[2]) >= 1) en.goHome(true);
    } else if (en.arrivedId !== desiredBodyRef.current) {
      en.travelTo(desiredBodyRef.current, true);
    }
  }, []);

  // --- Phase 1: load the browser-only engine + data modules client-side only ---
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("@/lib/space-engine.js"),
      import("@/data/celestial/celestial-catalog.js"),
      import("@/data/celestial/celestial-extra.js"),
      import("@/data/celestial/celestial-imgmap.js"),
      import("@/data/celestial/celestial-extra2.js"),
      import("@/data/celestial/celestial-gaia.js"),
    ]).then(() => {
      if (!cancelled) setEngineReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = engineRef.current;
    if (!el || !engineReady) return;
    el.setAttribute("density", String(density));
    el.setAttribute("constellations", constellations ? "on" : "off");
    el.setAttribute("ship", ship ? "on" : "off");
    // ship-v2 (ADR-0002) rollout flag: ?craft=1k|2k enables the textured GLB
    // craft. Absent → the original wireframe path, untouched.
    const craft = new URLSearchParams(window.location.search).get("craft");
    if (craft === "1k" || craft === "2k") el.setAttribute("craft", craft);
  }, [engineReady, density, constellations, ship]);

  const goSection = useCallback(
    (sec: string) => {
      if (sec === "credits") {
        patch({ sectionOpen: "credits", vista: null, cardId: null });
        return;
      }
      const en = engineEl();
      if (!en) return;
      const id = "st-" + sec;
      if (en.arrivedId === id) {
        patch({ sectionOpen: sec, sector: sec, vista: null, cardId: null });
        return;
      }
      sectionTravelRef.current = sec;
      en.travelTo(id);
    },
    [patch],
  );

  // --- Phase 2/3: cosmos:* event wiring, Escape key, nav click delegation, station registration ---
  useEffect(() => {
    if (!engineReady) return;

    const listeners: [string, EventListener][] = [];
    const on = (name: string, fn: EventListener) => {
      window.addEventListener(name, fn);
      listeners.push([name, fn]);
    };

    on("cosmos:progress", ((e: CustomEvent) =>
      patch({ progress: e.detail })) as EventListener);
    on("cosmos:ready", (() => patch({ ready: true })) as EventListener);
    on("cosmos:aim", ((e: CustomEvent) =>
      patch({ aim: e.detail })) as EventListener);
    on("cosmos:hover", ((e: CustomEvent) => {
      const detail = e.detail;
      const h = stateRef.current.hover;
      if (
        !h ||
        h.id !== detail.id ||
        Math.abs(h.x - detail.x) > 2 ||
        Math.abs(h.y - detail.y) > 2
      ) {
        patch({ hover: detail });
      }
    }) as EventListener);
    on("cosmos:unhover", (() => {
      if (stateRef.current.hover) patch({ hover: null });
    }) as EventListener);
    on("cosmos:select", ((e: CustomEvent) => {
      const detail = e.detail;
      if (detail.quiet) {
        patch({ hover: null, vista: null });
        return;
      }
      patch({
        warp: { id: detail.id, t: 0, ly: null, phase: "aim" },
        hover: null,
        cardId: null,
        vista: null,
      });
    }) as EventListener);
    on("cosmos:warp", ((e: CustomEvent) => {
      const detail = e.detail;
      if (detail.quiet) return;
      patch({
        warp: {
          id: detail.id,
          t: detail.t,
          ly: detail.ly,
          home: detail.home,
          phase: "warp",
          wphase: detail.phase,
          vC: detail.vC,
        },
      });
    }) as EventListener);
    on("cosmos:arrive", ((e: CustomEvent) => {
      const detail = e.detail;
      const id = detail.id;
      if (sectionTravelRef.current) {
        const sec = sectionTravelRef.current;
        sectionTravelRef.current = null;
        patch({
          warp: null,
          arrivedId: id,
          vista: null,
          sector: sec,
          sectionOpen: sec,
        });
        return;
      }
      if (detail.quiet) {
        patch({ warp: null, arrivedId: id, vista: null });
        setTimeout(() => dispatchRoute(), 80);
        return;
      }
      const s = stateRef.current;
      if (!s.warp && s.arrivedId === id) {
        clearTimeout(vistaTimeoutRef.current);
        patch({
          vista: null,
          cardId: id,
          tilt: { rx: 0, ry: 0, mx: 50, my: 50 },
        });
        return;
      }
      patch({ warp: null, arrivedId: id, vista: { id }, hover: null });
      clearTimeout(vistaTimeoutRef.current);
      vistaTimeoutRef.current = setTimeout(() => patch({ vista: null }), 5500);
    }) as EventListener);
    on("cosmos:home", (() => {
      patch({ warp: null, arrivedId: null, vista: null });
      setTimeout(() => dispatchRoute(), 80);
    }) as EventListener);

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape")
        patch({ cardId: null, mcOpen: false, sectionOpen: null });
    };
    window.addEventListener("keydown", handleKeydown);

    const knownSections = [
      "hero",
      "about",
      "experience",
      "achievements",
      "projects",
      "skills",
      "contact",
    ];
    const clickDelegate = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement;

      // Mobile menu action items (mode toggle / Data & Licenses) live in Header.astro's
      // dropdown, not in this component's own JSX - see design_handoff_mobile_responsive.
      const actionEl = target.closest?.(
        "[data-mobile-menu-action]",
      ) as HTMLElement | null;
      if (actionEl) {
        const action = actionEl.dataset.mobileMenuAction;
        if (action === "toggle-mode") toggleNavMode();
        else if (action === "credits") openCredits();
        return;
      }

      const a = target.closest?.("a[href^='#']") as HTMLAnchorElement | null;
      if (!a) return;
      const sec = (a.getAttribute("href") || "").slice(1);
      if (!knownSections.includes(sec)) return;
      ev.preventDefault();
      const travelNow =
        (stateRef.current.navOverride ??
          (mobileRef.current ? "scroll" : "travel")) === "travel";
      if (sec === "hero") {
        if (travelNow) engineEl()?.goHome();
        else window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (travelNow) {
        goSection(sec);
        return;
      }
      const el = document.getElementById(sec);
      if (el) window.scrollTo({ top: el.offsetTop - 60, behavior: "smooth" });
    };
    document.addEventListener("click", clickDelegate);

    // Register nav-station positions once so mission-control travel to a section works,
    // even before Phase 4 renders the visual station sprite markers.
    const en = engineEl();
    if (en) {
      en.setStations(
        STATIONS.map((st) => ({
          id: "st-" + st.sec,
          ra: st.ra,
          dec: st.dec,
          ly: st.ly,
        })),
      );
    }

    return () => {
      listeners.forEach(([n, f]) => window.removeEventListener(n, f));
      window.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("click", clickDelegate);
      clearTimeout(vistaTimeoutRef.current);
    };
  }, [
    engineReady,
    patch,
    goSection,
    dispatchRoute,
    toggleNavMode,
    openCredits,
  ]);

  // --- Phase 4: scroll-mode section routing - ship follows the section scrolled into view ---
  useEffect(() => {
    if (!engineReady) return;
    const sections = document.querySelectorAll("section[id]");
    if (!sections.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const secId = entry.target.id;
          if (SECTOR_BODIES[secId] && stateRef.current.sector !== secId) {
            desiredBodyRef.current = SECTOR_BODIES[secId];
            patch({ sector: secId });
            dispatchRoute();
          }
        }
      },
      { threshold: 0.3 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [engineReady, patch, dispatchRoute]);

  // --- Phase 4: station sprite positioning - imperative per-frame DOM mutation, not React
  // state, matching the source's own rationale (re-rendering 7 elements every rAF tick
  // through React would be wasteful; see StationSprites.tsx) ---
  useEffect(() => {
    if (!engineReady) return;
    let raf: number;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const en = engineEl();
      if (!en || !en.stations) return;
      const s = stateRef.current;
      const travel =
        (s.navOverride ?? (mobileRef.current ? "scroll" : "travel")) ===
        "travel";
      const camHome = Math.hypot(en.cam[0], en.cam[1], en.cam[2]) < 1;
      const atHome =
        camHome && (window.scrollY || 0) < window.innerHeight * 0.3;

      let dodge: {
        left: number;
        right: number;
        top: number;
        bottom: number;
      } | null = null;
      const heroCopy = atHome ? document.getElementById("ij-hero-copy") : null;
      if (heroCopy) {
        const h1 = heroCopy.querySelector("h1");
        const badge = heroCopy.firstElementChild as HTMLElement | null;
        if (h1 && badge) {
          const h1r = h1.getBoundingClientRect();
          const br = badge.getBoundingClientRect();
          const hcr = heroCopy.getBoundingClientRect();
          dodge = {
            left: h1r.left - 40,
            right: h1r.right + 40,
            top: br.top - 24,
            bottom: hcr.bottom - 30,
          };
        }
      }

      for (const st of STATIONS) {
        const el = spriteElsRef.current[st.sec];
        if (!el) continue;
        const cached = bodyCacheRef.current[st.sec];
        const b =
          cached ??
          (bodyCacheRef.current[st.sec] = en.stations.find(
            (x) => x.e.id === "st-" + st.sec,
          ));
        if (!b) continue;
        const px = b.vis ? b.sx! : b.ex;
        const py = b.vis ? b.sy! : b.ey;
        let show =
          travel &&
          px != null &&
          !s.warp &&
          !s.sectionOpen &&
          !s.cardId &&
          !s.vista;
        if (
          show &&
          dodge &&
          px > dodge.left &&
          px < dodge.right &&
          py > dodge.top &&
          py < dodge.bottom
        ) {
          show = false;
        }
        el.style.opacity = show ? (b.vis ? "1" : "0.85") : "0";
        el.style.visibility = show ? "visible" : "hidden";
        if (show) el.style.transform = `translate(${px - 100}px,${py + 12}px)`;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engineReady]);

  if (!engineReady) return null;

  // --- derived render values (mirrors renderVals() for the Phase 2/3 subset) ---
  const hoverTooltip: HoverTooltipData | null = (() => {
    if (!state.hover) return null;
    const e = entryFor(state.hover.id);
    if (!e) return null;
    return {
      name: e.n,
      type: e.t.toUpperCase(),
      rarity: e.r.toUpperCase(),
      color: e.c || "#ffd54f",
      rarityColor: rarityColor(e.r),
      dist: fmtDist(e),
      mg: e.mg,
      cta:
        !state.warp && state.arrivedId === e.id
          ? "ON STATION · CLICK TO OPEN DOSSIER ▸"
          : "CLICK TO TRAVEL ▸",
      x: state.hover.x,
      y: state.hover.y,
    };
  })();

  const warpDestName = (() => {
    if (!state.warp) return "";
    if (state.warp.home) return "Sol · Home";
    const e = entryFor(state.warp.id);
    if (e) return e.n;
    const stW = state.warp.id.startsWith("st-")
      ? STATIONS.find((x) => "st-" + x.sec === state.warp!.id)
      : null;
    return stW ? stW.label : "";
  })();

  const vistaEntry = state.vista ? entryFor(state.vista.id) : null;
  const cardEntry = state.cardId ? entryFor(state.cardId) : null;

  const q = state.cmd.trim().toLowerCase();
  const suggestions: CommandSuggestion[] =
    q.length >= 1
      ? catalog()
          .filter(
            (e) =>
              e.n.toLowerCase().includes(q) ||
              e.d.toLowerCase().includes(q) ||
              e.t.toLowerCase().includes(q),
          )
          .slice(0, 6)
          .map((e) => ({
            id: e.id,
            name: e.n,
            type: e.t,
            dist: fmtDist(e),
            color: rarityColor(e.r),
          }))
      : [];

  return (
    <>
      <space-engine
        ref={engineRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
        }}
      />

      <HUD
        progress={state.progress}
        ready={state.ready}
        catalogCount={catalog().length}
        aim={state.aim}
        warp={state.warp}
        arrivedId={state.arrivedId}
        sector={state.sector}
        onOpenCredits={openCredits}
        isTravel={isTravel}
        onToggleNavMode={toggleNavMode}
      />

      <StationSprites
        onRefsReady={(refs) => {
          spriteElsRef.current = refs;
        }}
        onGo={goSection}
      />

      {/* Mobile responsive pass: a "fly to a destination" search bar makes no sense on the
          scrolling page - see design_handoff_mobile_responsive. */}
      {!(mobile && !isTravel) && (
        <MissionControlBar
          cmd={state.cmd}
          suggestions={suggestions}
          onCmdChange={(value) => patch({ cmd: value })}
          onCmdKeyDown={(e) => {
            if (e.key === "Enter" && suggestions.length) {
              const s = suggestions[0];
              patch({ cmd: "", hover: null });
              engineEl()?.travelTo(s.id);
            }
            if (e.key === "Escape") patch({ cmd: "" });
          }}
          onSuggestionSelect={(s) => {
            patch({ cmd: "", hover: null });
            engineEl()?.travelTo(s.id);
          }}
          onRandom={() => engineEl()?.randomBody()}
          onHome={() => engineEl()?.goHome()}
        />
      )}

      <HoverTooltip data={hoverTooltip} />

      <WarpOverlay warp={state.warp} destName={warpDestName} />

      {vistaEntry && (
        <ArrivalVista
          entry={vistaEntry}
          onOpenCard={() => {
            clearTimeout(vistaTimeoutRef.current);
            patch({
              vista: null,
              cardId: vistaEntry.id,
              tilt: { rx: 0, ry: 0, mx: 50, my: 50 },
            });
          }}
        />
      )}

      {cardEntry && (
        <CollectorCard
          entry={cardEntry}
          styleMode={state.styleOverride || "holo"}
          tilt={{ rx: state.tilt.rx, ry: state.tilt.ry }}
          onClose={() => patch({ cardId: null })}
          onReturnHome={() => {
            patch({ cardId: null });
            engineEl()?.goHome();
          }}
          onSetStyle={(mode: CardStyleMode) => patch({ styleOverride: mode })}
          onTilt={(rx, ry) => patch({ tilt: { rx, ry, mx: 50, my: 50 } })}
          onUntilt={() => patch({ tilt: { rx: 0, ry: 0, mx: 50, my: 50 } })}
        />
      )}

      {state.sectionOpen && (
        <SectionOverlay
          section={state.sectionOpen}
          dispMode={state.dispOverride || "dossier"}
          onClose={() => patch({ sectionOpen: null })}
          onReturnSol={() => {
            patch({ sectionOpen: null });
            engineEl()?.goHome();
          }}
          onSetDispMode={(mode: SectionDisplayMode) =>
            patch({ dispOverride: mode })
          }
          copyLabel={state.copied ? "Copied!" : "Copy Bio"}
          onCopyBio={async () => {
            try {
              await navigator.clipboard.writeText(SHORT_BIO);
            } catch {
              // clipboard permission denied - non-fatal, label just won't confirm
            }
            patch({ copied: true });
            setTimeout(() => patch({ copied: false }), 2000);
          }}
        />
      )}
    </>
  );
}
