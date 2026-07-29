import { useCallback, useEffect, useRef, useState } from "react";
import type { CelestialEntry } from "@/data/celestial/celestial.d.ts";
import type { SpaceEngineElement } from "@/lib/space-engine.d.ts";
import {
  entryForFieldStar,
  fmtDist,
  rarityColor,
  FIELD_TYPES,
} from "@/lib/spaceHelpers";
import { SHORT_BIO } from "@/content/links";
import { EXTRAGALACTIC_LY } from "@/lib/ship-dynamics";
import {
  buildIndex,
  withClassEntries,
  searchWithTotal,
  totalMatches as totalIndexMatches,
  featuredEntries,
  type SearchEntry,
  type SearchIndex,
} from "@/lib/destination-search";
import { INITIAL_SCENE_STATE, SECTOR_BODIES, STATIONS } from "./space/types";
import type {
  CardStyleMode,
  SceneState,
  SectionDisplayMode,
} from "./space/types";
import HUD from "./space/HUD";
import HoverTooltip from "./space/HoverTooltip";
import type { HoverTooltipData } from "./space/HoverTooltip";
import {
  parseStoredQuality,
  readTierSignals,
  resolveCraftAttribute,
  CRAFT_QUALITY_STORAGE_KEY,
} from "@/lib/craft-tier";
import {
  resolveEngine,
  parseEngineValue,
  ENGINE_STORAGE_KEY,
  type EngineKind,
} from "@/lib/engine-select";
import {
  PerfMonitor,
  classifyDeviceTier,
  deviceSignature,
  readDeviceContext,
  type PerfSnapshot,
} from "@/lib/perf-telemetry";
import MissionControlBar from "./space/MissionControlBar";
import type { CommandSuggestion } from "./space/MissionControlBar";
import WarpOverlay from "./space/WarpOverlay";
import ArrivalVista from "./space/ArrivalVista";
import CollectorCard from "./space/CollectorCard";
import SectionOverlay from "./space/SectionOverlay";
import RenderConsole from "./space/RenderConsole";
import StationSprites from "./space/StationSprites";
import type { SpriteRefMap } from "./space/StationSprites";
import type { SpaceEngineBody } from "@/lib/space-engine.d.ts";
import PreFlight from "./space/PreFlight";
import AscentSkip from "./space/AscentSkip";
import type { LoadStage, StageProgress } from "@/lib/load-progress";
import FunnelOverlay from "./space/FunnelOverlay";
import {
  FunnelRecorder,
  resolveFunnelOverlay,
  FUNNEL_OVERLAY_STORAGE_KEY,
  type FunnelSession,
} from "@/lib/funnel";
import { useEscapeStack } from "@/lib/focus-utils";

interface SpaceSceneProps {
  density?: number;
  constellations?: boolean;
  ship?: boolean;
}

function engineEl(): SpaceEngineElement | null {
  // PF-09 B2 step 3: only one of the two custom elements is ever mounted at a
  // time (the ternary below picks by engineKind), so a combined selector is
  // safe. Before this fix, every host-driven call (travelTo, goHome, HUD sync,
  // station sprites) queried "space-engine" unconditionally and silently
  // no-op'd on the Babylon path — nothing added to <babylon-scene> was
  // reachable from the real UI, only from its own self-running preview.
  return document.querySelector(
    "space-engine, babylon-scene",
  ) as SpaceEngineElement | null;
}

function catalog(): CelestialEntry[] {
  return window.CELESTIAL || [];
}

/** PF-11 D2.2 — is the parked body extragalactic (drives the HUD's
 * `MILKY WAY ASTERN` line)? One-entry cache because SpaceScene re-renders
 * ~7.5×/s while idle (the GAP-14 aim readout), and an O(4,829) `find` per
 * render for a value that changes once per arrival is waste. A module-level
 * closure, NOT a useMemo — a hook here would sit below the component's
 * `if (!engineReady) return null` early exit, the exact Rules-of-Hooks
 * crash (#310) D1.4 already hit (TR-086).
 *
 * PF-11 D4.2 follow-up (TR-100): must go through `entryFor`, not a raw
 * `catalog()` lookup — field objects (`fs-N`) are synthesized from the
 * engine's live `fieldInfo()` and never written into `window.CELESTIAL`, so
 * a catalog-only lookup silently reports every field arrival as near
 * regardless of true distance. This was unreachable before D4.2 (nothing
 * could ever arrive at an `fs-` id); it is reachable now, and SDSS field
 * galaxies routinely sit at 32.6M-28.86B ly. */
let farFieldCache: { id: string; far: boolean } | undefined;
function isFarField(id: string | null): boolean {
  if (!id) return false;
  if (farFieldCache?.id !== id) {
    farFieldCache = {
      id,
      far: (entryFor(id)?.ly ?? 0) >= EXTRAGALACTIC_LY,
    };
  }
  return farFieldCache.far;
}

/** PF-11 D3.3 — how long the transient abort/retarget-queued acknowledgement stays on screen.
 * Deliberately shorter than the arrival vista's 5.5s: this is a "received" acknowledgement,
 * not content to read, and the ongoing warp-transit overlay keeps communicating the journey
 * (destination, phase, home-bound framing) long after this banner clears itself. */
const NAV_NOTICE_MS = 2200;

/** PF-11 D4.1 (D4-AC2): how long, after any vista dismissal (click/Space/Escape), SpaceScene
 * swallows the NEXT pointerdown aimed at the engine canvas before it reaches the engine's own
 * pick/click handling. A double-click or rapid-click burst that dismisses the vista would
 * otherwise land its second click on the canvas the instant the vista unmounts and launch an
 * unintended warp — the exact "babylon doesn't show the card" symptom R7 reported, which
 * traced back to the vista having no real dismiss surface at all (TR-086). */
const VISTA_CLICK_SWALLOW_MS = 300;

/** PF-11 D5.2 — badge color for station rows in the search list; bodies keep their existing
 * rarity-derived colors (`rarityColor`), so a station needs a color of its own that isn't one
 * of those rarities. Matches the amber accent already used for the RANDOM JUMP/RETURN HOME
 * buttons' hover state, reused here rather than inventing a new token. */
const STATION_BADGE_COLOR = "#ffc107";

/** PF-11 D5.3 — badge color for the search console's synthesized "nearest instance" class
 * rows, distinct from both the station accent above and every rarity color a real catalog
 * body can have. */
const CLASS_BADGE_COLOR = "#ba68c8";

/** PF-11 D5.3 — one `kind:"class"` search row per deep-layer population (`FIELD_TYPES`),
 * naming the field-catalog member of that type nearest the ship right now (e.g.
 * "A WHITE DWARF · NEAREST INSTANCE") rather than exposing ~200k individual uncurated field
 * rows. Babylon-only (`nearestFieldOfType` is an optional engine method — the archived WebGL
 * engine has no field-catalog scan of this kind); returns [] until the field is loaded or on
 * the legacy engine. */
function classSearchEntries(): SearchEntry[] {
  const en = engineEl();
  if (!en?.nearestFieldOfType) return [];
  const out: SearchEntry[] = [];
  for (const key of Object.keys(FIELD_TYPES)) {
    const typeByte = Number(key);
    const idx = en.nearestFieldOfType(typeByte);
    if (idx < 0) continue;
    const fi = en.fieldInfo(idx);
    if (!fi) continue;
    const noun = FIELD_TYPES[typeByte].sp;
    const article = /^[aeiou]/i.test(noun) ? "AN" : "A";
    out.push({
      id: "fs-" + idx,
      name: `${article} ${noun.toUpperCase()}`,
      designation: "NEAREST INSTANCE",
      type: "CLASS",
      kind: "class",
      ly: fi.ly,
      rarity: "field",
    });
  }
  return out;
}

/** PF-11 D5.2 — the search index rebuilds only when the catalog actually grows (D0.1/D1.1's
 * progressive layer loading only ever appends to `window.CELESTIAL`, never mutates existing
 * entries), not on every render — this component re-renders ~7.5×/s while idle (the GAP-14 aim
 * readout), and rebuilding a ~4,829-entry index on 5-7 renders it can't possibly need to change
 * on is waste. `STATIONS` is a static module-level const, so it's folded in unconditionally.
 * Mirrors the `farFieldCache` pattern above for the same reason (module closure, not a hook —
 * this file's `if (!engineReady) return null` early exit rules out `useMemo`, see D1.4/#310). */
let searchCache:
  | {
      catalogLen: number;
      index: SearchIndex;
      byId: Map<string, CelestialEntry>;
      /** The empty-query "NOTABLE DESTINATIONS" rows, resolved once per index (2026-07-29 code
       * review, finding 4). `FEATURED_DESTINATION_IDS` is a fixed six-element list and
       * `featuredEntries` builds a lookup map over the whole index to resolve it, so computing
       * this per render — which is what shipped — cost a ~4,834-entry Map plus its intermediate
       * array 7.5×/s forever, whether or not the console was ever focused. It can only change
       * when the index does, which is exactly this cache's invalidation key. Caching also gives
       * MissionControlBar a STABLE array reference across renders. */
      featured: CommandSuggestion[];
    }
  | undefined;
function getSearchState() {
  const cat = catalog();
  if (!searchCache || searchCache.catalogLen !== cat.length) {
    const index = buildIndex(
      cat,
      STATIONS.map((st) => ({
        id: "st-" + st.sec,
        label: st.label,
        sub: st.sub,
      })),
    );
    const byId = new Map(cat.map((e) => [e.id, e]));
    searchCache = {
      catalogLen: cat.length,
      index,
      byId,
      featured: featuredEntries(index).map((e) => toSuggestion(e, byId)),
    };
  }
  return searchCache;
}

function toSuggestion(
  entry: SearchEntry,
  byId: Map<string, CelestialEntry>,
): CommandSuggestion {
  if (entry.kind === "station") {
    return {
      id: entry.id,
      name: entry.name,
      type: entry.type,
      // Stations' `sub` text already reads e.g. "BETELGEUSE · 548 LY" — reused as-is rather
      // than fabricating a second distance computation for a fixed, already-authored set.
      dist: entry.designation,
      color: STATION_BADGE_COLOR,
      kind: "station",
    };
  }
  if (entry.kind === "class") {
    return {
      id: entry.id,
      name: entry.name,
      type: entry.type,
      dist: entry.designation, // "NEAREST INSTANCE" — the point of this row, not a distance
      color: CLASS_BADGE_COLOR,
      kind: "class",
    };
  }
  const full = byId.get(entry.id);
  return {
    id: entry.id,
    name: entry.name,
    type: entry.type,
    dist: full
      ? fmtDist(full)
      : entry.ly != null
        ? entry.ly + " ly"
        : "distance —",
    color: rarityColor(entry.rarity),
    kind: entry.kind,
  };
}

/** Extracted so PF-11 D1.4 can compute an accurate result count for the value a keystroke is
 * ABOUT to produce, synchronously inside the `onCmdChange` callback — a `useEffect` reacting
 * to `state.cmd` would sit after this component's `if (!engineReady) return null` early exit
 * once state settles, which is a Rules-of-Hooks violation (React error #310), not a scope
 * choice. PF-11 D5.2 retargeted these onto `destination-search.ts`'s ranked index (was a raw
 * `.filter().slice(0,6)` over `window.CELESTIAL` alone — no stations, no ranking, no id match). */
const NO_SUGGESTIONS: { suggestions: CommandSuggestion[]; total: number } = {
  suggestions: [],
  total: 0,
};

/** Both halves of the suggestion state from ONE ranking pass and ONE class-row build
 * (2026-07-29 code review, finding 8 — the shipped version called `searchSuggestions` and
 * `searchTotalMatches` separately from the render body, so a live query cost two full rankings
 * and two ~4,841-entry `withClassEntries` spreads per render). The honest-truncation guarantee
 * is unchanged: `total` is still the UNCAPPED count, never derived from the capped list. */
function searchSuggestions(cmd: string): {
  suggestions: CommandSuggestion[];
  total: number;
} {
  // PF-11 D5.3: class rows cost an engine call per FIELD_TYPES entry (cheap once the
  // per-camera-epoch cache is warm, but still real work) plus a fresh ~4,800-entry array
  // spread (`withClassEntries`) — skip both on every idle re-render (~7.5/s) and only pay for
  // them while a query is actually live, matching `destination-search.ts`'s own empty-query
  // short-circuit one level up.
  if (!cmd.trim()) return NO_SUGGESTIONS;
  const { index, byId } = getSearchState();
  const withClasses = withClassEntries(index, classSearchEntries());
  const { results, total } = searchWithTotal(withClasses, cmd, 10);
  return { suggestions: results.map((e) => toSuggestion(e, byId)), total };
}

/** Count only — used by the D1.4 funnel record, which needs the count for the value a keystroke
 * is ABOUT to produce and never renders a list for it. */
function searchTotalMatches(cmd: string): number {
  if (!cmd.trim()) return 0;
  const { index } = getSearchState();
  return totalIndexMatches(withClassEntries(index, classSearchEntries()), cmd);
}

function getFeaturedSuggestions(): CommandSuggestion[] {
  return getSearchState().featured;
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

/** Catalog body or station id -> its display name, for anywhere the HUD names a
 * destination outside a live `state.warp` (PF-11 D3.3's queued-retarget notice; the
 * warp-transit overlay below reuses the same two-step lookup). Falls back to the raw id
 * rather than an empty string — a notice that names nothing reads as broken, and every
 * real caller's id already resolves through one of the two lookups. */
function bodyDisplayName(id: string): string {
  const e = entryFor(id);
  if (e) return e.n;
  const stW = id.startsWith("st-")
    ? STATIONS.find((x) => "st-" + x.sec === id)
    : null;
  return stW ? stW.label : id;
}

/**
 * PF-07 Phases 1-4: mounts the ported <space-engine> WebGL scene, its "always visible
 * during travel" chrome (HUD, mission control, hover tooltip, warp transit overlay,
 * arrival vista), the collector card and the section-overlay dossiers, station sprite markers,
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

  // PF-09 B0: dual-engine seam. First render is always the current engine
  // (matches the client:load SSR HTML — resolving synchronously would risk a
  // hydration mismatch); a post-hydration effect swaps to Babylon only when
  // ?engine=babylon is set. The default (webgl) path never swaps, so it stays
  // behaviourally identical.
  const [engineKind, setEngineKind] = useState<EngineKind>("webgl");
  const [engineResolved, setEngineResolved] = useState(false);
  const [perfHud, setPerfHud] = useState<PerfSnapshot | null>(null);
  /** Render backend reported by <babylon-scene> ("webgpu" | "webgl2"); null on
   * the WebGL engine or before Babylon's async init resolves. */
  const [backend, setBackend] = useState<string | null>(null);

  // PF-11 D1.2: the PreFlight dossier's own inputs. Kept OUT of the shared `state`/`patch()`
  // object deliberately — `stages` updates up to 4 Hz per stage across up to nine stages
  // (D1.1's throttle), and folding that into the same state object every other component
  // subscribes to via `patch()` would re-render the whole scene tree on every byte tick.
  // `preflightBackend` is a second, always-live copy of the render backend (`backend` above
  // only updates behind `?perf=1`'s interval) so the dossier's "engine line" is real without
  // depending on the debug overlay being on.
  const [stages, setStages] = useState<
    Partial<Record<LoadStage, StageProgress>>
  >({});
  const [preflightBackend, setPreflightBackend] = useState<string | null>(null);

  // PF-11 D1.4: first-party funnel instrumentation (`?funnel=1`, UX research plan §3). The
  // recorder itself always runs (same convention as `window.__ijPerf` below) — only the
  // VISIBLE overlay is gated, so a visitor who adds the param mid-session still sees the
  // whole session rather than just the tail.
  const funnelRef = useRef<FunnelRecorder | null>(null);
  const [funnelOverlayOn, setFunnelOverlayOn] = useState(false);
  const [funnelSession, setFunnelSession] = useState<FunnelSession | null>(
    null,
  );

  // PF-11 D1.3: the launch cinematic. `launched` dismisses the PreFlight dossier; `revealReady`
  // clears `body.ij-loading` (revealing the hero copy + console). They are SEPARATE now: on a real
  // LAUNCH the console reveal WAITS for the ascent to finish (`cosmos:ascent-done`), so the
  // cinematic plays unobstructed. On a skip/bypass, or an engine with no ascent, they coincide.
  const [revealReady, setRevealReady] = useState(false);
  const [ascentActive, setAscentActive] = useState(false);

  /** PF-11 D4.1: text for the sr-only `role="status"` region announcing a vista dismissal
   * (the vista itself unmounts the instant it's dismissed, so the announcing node has to live
   * outside it to still be there for assistive tech to read). Same convention as PreFlight's
   * own sparse `role="status"` announcer. */
  const [vistaAnnouncement, setVistaAnnouncement] = useState("");

  const onLaunch = useCallback((ascent: boolean) => {
    funnelRef.current?.record("launch-pressed");
    const en = engineEl();
    if (ascent && en && typeof en.beginAscent === "function") {
      setAscentActive(true);
      en.beginAscent(); // reveal deferred to cosmos:ascent-done (fired even under reduced motion)
    } else {
      setRevealReady(true); // skip / bypass / no-ascent engine → reveal now
    }
  }, []);

  const skipAscent = useCallback(() => {
    engineEl()?.skipAscent?.();
    // Defensive: if the engine lacks skipAscent (archived engine), still reveal.
    setAscentActive(false);
    setRevealReady(true);
  }, []);

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

  /** A nav-click journey in flight: which station id it is heading for, and the
   * section to open when it lands. PF-11 D3.3 made the id load-bearing — before
   * the mid-journey policy this ref was a bare section name consumed by the NEXT
   * arrival whatever it was, so a nav click during a warp opened the section over
   * the wrong body (the interrupted journey's). Now that such a click QUEUES, the
   * section must wait for ITS station to arrive, which is exactly what matching
   * the id gives. */
  const sectionTravelRef = useRef<{ id: string; sec: string } | null>(null);
  const desiredBodyRef = useRef<string | null>(null);
  const spriteElsRef = useRef<SpriteRefMap>({});
  const bodyCacheRef = useRef<Record<string, SpaceEngineBody | undefined>>({});
  /** PF-11 D4.1: epoch-ms deadline until which the engine's own click-to-travel pick is
   * suppressed (see `VISTA_CLICK_SWALLOW_MS`). A plain ref, not state — it's read inside a
   * native capture-phase listener, not rendered. */
  const clickSwallowUntilRef = useRef<number>(0);
  /** PF-11 D3.3: auto-clears the transient abort/retarget-queued notice banner. */
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const patch = useCallback((p: Partial<SceneState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  /** PF-11 D4.1: the ONE path that closes the arrival vista — click-anywhere, Space, and the
   * Escape stack all funnel through this. `arrivedId`/camera are deliberately untouched (the
   * owner spec: dismiss closes the vista, the ship stays parked exactly where it landed). */
  const dismissVista = useCallback(
    (via: "click" | "space" | "escape") => {
      const vistaId = stateRef.current.vista?.id ?? null;
      const name = vistaId ? entryFor(vistaId)?.n : null;
      clickSwallowUntilRef.current = Date.now() + VISTA_CLICK_SWALLOW_MS;
      funnelRef.current?.record("vista-dismissed", { via });
      patch({ vista: null });
      setVistaAnnouncement(
        name ? `Resumed flight at ${name}.` : "Resumed flight.",
      );
    },
    [patch],
  );

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

  // PF-11 D9.2: same "close everything else that competes for focus" discipline openCredits
  // already follows.
  const openRenderConsole = useCallback(() => {
    patch({ renderConsoleOpen: true, vista: null, cardId: null });
  }, [patch]);

  // --- Phase 4: body.ij-travel class toggles CSS that hides scrollable sections/footer ---
  useEffect(() => {
    document.body.classList.toggle("ij-travel", isTravel);
    if (isTravel) window.scrollTo(0, 0);
  }, [isTravel]);

  // ship-v2 P3 (TR-018): during warp the hero copy steps back (global.css dims
  // #ij-hero-copy under body.ij-warping) so the flight reads as the primary
  // event; content returns on arrival.
  useEffect(() => {
    document.body.classList.toggle("ij-warping", !!state.warp);
  }, [state.warp]);

  // PF-08 F0 (TR-022) / PF-11 D1.2: landing loading choreography. body.ij-loading (set
  // server-side) hides the hero copy + WHERE-TO bar; now cleared by a real visitor action
  // (LAUNCH, SKIP INTRO, or the returning-visitor bypass — all funnel through `onLaunch`
  // above) rather than an automatic ready&&craftDone check with grace/hard timers. The old
  // 2.5s craft-grace and 8s hard timer are gone: craft is a background stage that no longer
  // blocks the reveal (PreFlight arms on `state.ready` alone), and PreFlight's own S1e stall
  // detector + mandatory skip affordances are the honest replacement for "give up after Nms"
  // — instant outside travel mode is unchanged (mobile scroll default must never wait). The
  // 9s CSS failsafe in global.css is untouched and still the absolute last resort.
  useEffect(() => {
    if (!isTravel || revealReady) document.body.classList.remove("ij-loading");
  }, [isTravel, revealReady]);

  // PF-08 F0: the WHERE-TO bar docks between the ship and the title while at
  // the home vista (global.css repositions #ij-mission-bar under ij-at-home).
  useEffect(() => {
    document.body.classList.toggle(
      "ij-at-home",
      isTravel &&
        !state.warp &&
        !state.arrivedId &&
        !state.sectionOpen &&
        !state.cardId &&
        !state.vista,
    );
  }, [
    isTravel,
    state.warp,
    state.arrivedId,
    state.sectionOpen,
    state.cardId,
    state.vista,
  ]);

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

  // PF-09 B0: resolve the engine once, post-hydration (client-only).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEngineKind(
      resolveEngine(
        params.get("engine"),
        parseEngineValue(localStorage.getItem(ENGINE_STORAGE_KEY)),
      ),
    );
    setEngineResolved(true);
  }, []);

  // PF-09 B0: engine-agnostic perf telemetry (the B1-gate measurement
  // instrument). Times mount → cosmos:ready for startup, samples rAF for fps;
  // works for either engine with no change to their internals. Reports on
  // demand via window.__ijPerf() and the cosmos:perf event; a visible readout
  // is opt-in via ?perf=1 so default visuals are untouched.
  useEffect(() => {
    if (!engineResolved) return;
    const monitor = new PerfMonitor(
      engineKind,
      classifyDeviceTier(readTierSignals(window)),
      readDeviceContext(window),
    );
    monitor.start(performance.now());
    const onReady = () => monitor.markReady(performance.now());
    window.addEventListener("cosmos:ready", onReady);
    // Read the ENGINE's own frame counter so a reading can prove the scene is
    // really drawing — the host rAF loop keeps ticking even if it isn't.
    // space-engine increments _frame per tick; babylon-scene exposes renderFrames.
    type FrameCounterEl = Element & {
      _frame?: number;
      renderFrames?: number;
      /** babylon-scene only: "webgpu" | "webgl2", null until init resolves. */
      backend?: string | null;
    };
    const selector =
      engineKind === "babylon" ? "babylon-scene" : "space-engine";
    // cache the element — this runs every animation frame, so re-querying the
    // DOM here would add avoidable per-frame cost to the very thing we measure
    let engineEl: FrameCounterEl | null = null;
    // Resolving the element must NOT depend on the rAF loop having run: rAF is
    // throttled to zero in background tabs and heavily under battery saver, and
    // the HUD interval still fires there. Both callers resolve through this.
    const resolveEngineEl = (): FrameCounterEl | null => {
      if (!engineEl || !engineEl.isConnected)
        engineEl = document.querySelector(selector) as FrameCounterEl | null;
      return engineEl;
    };
    const readEngineFrames = (): number | null => {
      const el = resolveEngineEl();
      if (!el) return null;
      const n = engineKind === "babylon" ? el.renderFrames : el._frame;
      return typeof n === "number" ? n : null;
    };
    let raf = requestAnimationFrame(function loop() {
      monitor.frame(performance.now());
      monitor.setRenderFrames(readEngineFrames(), performance.now());
      raf = requestAnimationFrame(loop);
    });
    const perfWin = window as unknown as { __ijPerf?: () => PerfSnapshot };
    perfWin.__ijPerf = () => monitor.snapshot();
    const onReq = () =>
      window.dispatchEvent(
        new CustomEvent("cosmos:perf", { detail: monitor.snapshot() }),
      );
    window.addEventListener("cosmos:perf:req", onReq);
    const showPerf =
      new URLSearchParams(window.location.search).get("perf") === "1";
    const hudTimer = showPerf
      ? window.setInterval(() => {
          setPerfHud(monitor.snapshot());
          // Gate condition 2 (ADR-0003) is "did the WGSL/WebGPU path actually
          // run?". That was only ever readable from the engine's own badge in
          // the opposite screen corner, which is easy to miss on a phone — so
          // surface it on the overlay the gate procedure tells you to read.
          setBackend(resolveEngineEl()?.backend ?? null);
        }, 500)
      : 0;
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("cosmos:ready", onReady);
      window.removeEventListener("cosmos:perf:req", onReq);
      if (hudTimer) window.clearInterval(hudTimer);
      delete perfWin.__ijPerf;
    };
  }, [engineResolved, engineKind]);

  // PF-11 D1.4: create the session recorder + resolve the debug-overlay flag. Two separate
  // effects (recorder lifecycle vs. URL/stored resolution) so re-resolving the overlay flag
  // never tears down and recreates the recorder itself.
  useEffect(() => {
    if (!engineResolved) return;
    const recorder = new FunnelRecorder(
      deviceSignature(readDeviceContext(window)),
    );
    funnelRef.current = recorder;
    const funnelWin = window as unknown as { __ijFunnel?: () => FunnelSession };
    funnelWin.__ijFunnel = () => recorder.snapshot();
    const onUnload = () => recorder.persist();
    window.addEventListener("pagehide", onUnload);
    return () => {
      delete funnelWin.__ijFunnel;
      window.removeEventListener("pagehide", onUnload);
      recorder.persist();
      funnelRef.current = null;
    };
  }, [engineResolved]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlVal = params.get("funnel");
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(FUNNEL_OVERLAY_STORAGE_KEY);
    } catch {
      stored = null; // storage blocked (private mode/quota) — URL param still governs
    }
    setFunnelOverlayOn(resolveFunnelOverlay(urlVal, stored));
    if (urlVal === "1" || urlVal === "0") {
      try {
        localStorage.setItem(FUNNEL_OVERLAY_STORAGE_KEY, urlVal);
      } catch {
        /* storage blocked — the URL param still governs this load */
      }
    }
  }, []);

  // Live refresh for the visible overlay only — recording itself never depends on this.
  useEffect(() => {
    if (!funnelOverlayOn) return;
    const id = window.setInterval(() => {
      const snap = funnelRef.current?.snapshot();
      if (snap) setFunnelSession(snap);
    }, 500);
    return () => window.clearInterval(id);
  }, [funnelOverlayOn]);

  // --- Phase 1: load the browser-only engine + data modules client-side only.
  // Gated on the resolved engine (B0): imports the current WebGL engine by
  // default, or the Babylon module when ?engine=babylon. ---
  useEffect(() => {
    if (!engineResolved) return;
    let cancelled = false;
    const engineImport =
      engineKind === "babylon"
        ? import("@/lib/babylon-engine")
        : import("@/lib/space-engine.js");
    Promise.all([
      engineImport,
      import("@/data/celestial/celestial-catalog.js"),
      import("@/data/celestial/celestial-extra.js"),
      import("@/data/celestial/celestial-imgmap.js"),
      import("@/data/celestial/celestial-extra2.js"),
      import("@/data/celestial/celestial-gaia.js"),
      import("@/data/celestial/celestial-clusters.js"),
      import("@/data/celestial/celestial-minorplanets.js"),
      import("@/data/celestial/celestial-nbg.js"),
      import("@/data/celestial/celestial-gd1.js"),
      import("@/data/celestial/celestial-ngc2000.js"),
      import("@/data/celestial/celestial-saturn-moons.js"),
      import("@/data/celestial/celestial-missing-moons.js"),
    ])
      .then(
        // PF-11 D4.4: sequenced as its own .then, NOT inside the Promise.all above.
        // Promise.all does not order its array's own top-level module side effects relative
        // to each other — the overlay's whole job is overriding ids the base catalog modules
        // add, so it must run strictly after every one of them has already run, not "probably
        // usually does in practice." Batch 1 (25 clusters, owner-approved 2026-07-25).
        () => import("@/data/celestial/celestial-content-overlay.js"),
      )
      .then(
        // Batch 2 (41 NGC2000 nebulae, owner-approved 2026-07-25, TR-100) — same reasoning,
        // its own .then chained after batch 1 rather than folded into one import for the
        // same non-ordering-guarantee reason above.
        () => import("@/data/celestial/celestial-content-overlay-ngc2000.js"),
      )
      .then(() => {
        if (!cancelled) setEngineReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [engineResolved, engineKind]);

  useEffect(() => {
    // Bug found via GAP-17..20 E2E work (TR-060): this used engineRef.current,
    // which only ever attaches to <space-engine> (see the "no ref" comment on
    // <babylon-scene>'s JSX below) — on the Babylon path `el` was always null
    // and this whole effect silently no-op'd, so density/constellations/ship/
    // craft never reached babylon-engine.ts's attributeChangedCallback (GAP-12)
    // at all. engineEl() is the established combined-selector accessor every
    // other imperative call site in this file already uses for exactly this
    // reason (works for whichever of the two custom elements is mounted).
    const el = engineEl();
    if (!el || !engineReady) return;
    el.setAttribute("density", String(density));
    el.setAttribute("constellations", constellations ? "on" : "off");
    el.setAttribute("ship", ship ? "on" : "off");
    // ship-v2 craft tier resolution (default-on since P5, TR-020): URL param
    // (dev/rollback) → stored user override (Data & Licenses selector) → auto
    // device policy. ?craft=off / the selector's Off restore the wireframe.
    const tier = resolveCraftAttribute(
      new URLSearchParams(window.location.search).get("craft"),
      parseStoredQuality(localStorage.getItem(CRAFT_QUALITY_STORAGE_KEY)),
      readTierSignals(window),
    );
    if (tier) el.setAttribute("craft", tier);
    else el.removeAttribute("craft");
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
      sectionTravelRef.current = { id, sec };
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
    on("cosmos:ready", (() => {
      patch({ ready: true });
      // PF-11 D1.4: state.ready is exactly the `armed` flag PreFlight renders from — no
      // separate "armed" signal exists to record, so this IS the moment the gate arms.
      funnelRef.current?.record("launch-armed");
    }) as EventListener);
    // PF-11 D1.1/D1.2: the PreFlight dossier's real byte-progress feed. `setStages` merges
    // by stage id so a slower-updating stage's last-known reading is never clobbered by a
    // different stage's event (each cosmos:stage event describes exactly one stage).
    on("cosmos:stage", ((e: CustomEvent<StageProgress>) => {
      const p = e.detail;
      // PF-11 D1.4: the first cosmos:stage event is the earliest observable proxy for "the
      // PRE-FLIGHT dossier is now showing real progress" — cheaper and no less accurate than
      // threading a second mount-signal out of PreFlight.tsx for a debug-only recorder.
      funnelRef.current?.record("dossier-visible");
      setStages((prev) => ({ ...prev, [p.stage]: p }));
      // `engine-init`'s completion is the earliest point `<babylon-scene>.backend` is set
      // (babylon-engine.ts sets it synchronously right after createEngine resolves, well
      // before first-frame) — read it here rather than waiting on the ?perf=1 interval,
      // so the dossier's engine line is real on every load, not just debug ones.
      if (p.stage === "engine-init" && p.done) {
        const el = engineEl() as unknown as { backend?: string | null } | null;
        setPreflightBackend(el?.backend ?? null);
      }
    }) as EventListener);
    on("cosmos:craft", ((e: CustomEvent) => {
      const st = e.detail?.state;
      if (st === "ready" || st === "error") patch({ craftDone: true });
    }) as EventListener);
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
      // PF-11 D3.3: this IS the queued retarget launching if its id matches — the engine
      // already cleared its own `queuedTargetId` before emitting this, so the badge has to
      // clear here too rather than wait for an arrival that (for THIS journey) hasn't
      // started yet.
      const queuedTargetId =
        stateRef.current.queuedTargetId === detail.id
          ? null
          : stateRef.current.queuedTargetId;
      if (detail.quiet) {
        patch({ hover: null, vista: null, queuedTargetId });
        return;
      }
      // PF-11 D1.4: cosmos:select — not cosmos:warp — is the one-shot "a journey started"
      // signal. cosmos:warp fires once per rendered frame for the whole journey (TR-081),
      // and by its first tick `state.warp` is already the "aim"-phase object this handler
      // is about to set, so a null-check there can never observe the transition.
      funnelRef.current?.record("travel", { id: detail.id });
      patch({
        warp: { id: detail.id, t: 0, ly: null, phase: "aim" },
        hover: null,
        cardId: null,
        vista: null,
        queuedTargetId,
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
      // PF-11 D3.3: the engine's same-id no-op case — a retarget was queued back to the
      // body a journey was ALREADY flying to, so the queue drains with no `cosmos:select`
      // ever firing for it. This is the only place that arrival is observable from the DOM
      // event stream, so it is the only place this particular clear can happen.
      const queuedTargetId =
        stateRef.current.queuedTargetId === id
          ? null
          : stateRef.current.queuedTargetId;
      // Only THIS station's arrival opens the section (D3.3): an unrelated
      // arrival in between — the journey a nav click interrupted, or one queued
      // ahead of it — must leave the intent standing rather than consume it.
      const pendingSection = sectionTravelRef.current;
      // `id` is `any` off the CustomEvent detail, so `?.` alone does not narrow.
      if (pendingSection && pendingSection.id === id) {
        const sec = pendingSection.sec;
        sectionTravelRef.current = null;
        funnelRef.current?.record("arrival", { id });
        patch({
          warp: null,
          arrivedId: id,
          vista: null,
          sector: sec,
          sectionOpen: sec,
          queuedTargetId,
        });
        return;
      }
      if (detail.quiet) {
        patch({ warp: null, arrivedId: id, vista: null, queuedTargetId });
        setTimeout(() => dispatchRoute(), 80);
        return;
      }
      const s = stateRef.current;
      if (!s.warp && s.arrivedId === id) {
        // PF-11 D4.3: clear hover explicitly (not just via the HoverTooltip render gate below)
        // — the card's focus trap is about to pull keyboard focus onto itself, and a tooltip
        // still anchored to a now-stale cursor position has no business surviving that.
        patch({
          vista: null,
          cardId: id,
          hover: null,
          tilt: { rx: 0, ry: 0, mx: 50, my: 50 },
          queuedTargetId,
        });
        return;
      }
      funnelRef.current?.record("arrival", { id });
      // PF-11 D4.1: no auto-timeout — the vista now stays until the visitor dismisses it
      // (click-anywhere, Space, or Escape; see `dismissVista`).
      patch({
        warp: null,
        arrivedId: id,
        vista: { id },
        hover: null,
        queuedTargetId,
      });
    }) as EventListener);
    on("cosmos:home", (() => {
      // D3.3: going home — including as an ABORT — discards a pending nav-click
      // section intent, so it can't reopen on some unrelated later arrival.
      sectionTravelRef.current = null;
      // The engine has already discarded any queue by the time a journey lands home (on
      // the abort path, at the press itself; on the plain path, it was never set) — mirrored
      // here defensively so a stale badge can never survive into an idle scene.
      patch({ warp: null, arrivedId: null, vista: null, queuedTargetId: null });
      setTimeout(() => dispatchRoute(), 80);
    }) as EventListener);
    // PF-11 D3.3 (ADR-0010): HOME mid-journey is an ABORT, never a silent no-op. This fires
    // the instant the press lands — well before the new home-bound warp completes — so the
    // acknowledgement is immediate rather than deferred to arrival. `state.warp` is set here
    // (not left to the next `cosmos:warp` tick) for the same reason `cosmos:select` sets it:
    // the very next rendered frame already carries the new journey's data, so a null check
    // there could never observe the transition either.
    on("cosmos:abort", ((e: CustomEvent) => {
      const detail = e.detail;
      sectionTravelRef.current = null;
      if (detail.quiet) {
        patch({ hover: null, cardId: null, vista: null, queuedTargetId: null });
        return;
      }
      clearTimeout(noticeTimeoutRef.current);
      patch({
        warp: { id: "__home", t: 0, ly: null, phase: "aim", home: true },
        hover: null,
        cardId: null,
        vista: null,
        queuedTargetId: null,
        notice: { kind: "abort", text: "ABORTING · RETURNING HOME" },
      });
      noticeTimeoutRef.current = setTimeout(
        () => patch({ notice: null }),
        NAV_NOTICE_MS,
      );
    }) as EventListener);
    // PF-11 D3.3 (ADR-0010): a destination picked mid-journey queues rather than no-ops.
    // `queuedTargetId` is the PERSISTENT half (drives the console badge below and lives
    // until the queue drains or is discarded); `notice` is the one-shot acknowledgement that
    // the pick registered at all.
    on("cosmos:retarget-queued", ((e: CustomEvent) => {
      const detail = e.detail;
      if (detail.quiet) {
        patch({ queuedTargetId: detail.id });
        return;
      }
      clearTimeout(noticeTimeoutRef.current);
      patch({
        queuedTargetId: detail.id,
        notice: {
          kind: "retarget-queued",
          text: `RETARGET QUEUED · ${bodyDisplayName(detail.id)}`,
        },
      });
      noticeTimeoutRef.current = setTimeout(
        () => patch({ notice: null }),
        NAV_NOTICE_MS,
      );
    }) as EventListener);
    // PF-11 D1.3: the ascent hands off here — reveal the console into its dock, end the skip
    // overlay, record the funnel milestone. Fires ~8s after LAUNCH, or synchronously under
    // reduced motion / on SKIP. Guarded by `ascentActive`-independent state so a stray event
    // can't un-reveal a already-shown scene.
    on("cosmos:ascent-done", (() => {
      funnelRef.current?.record("cinematic-done");
      setAscentActive(false);
      setRevealReady(true);
    }) as EventListener);

    // PF-11 D4.1 (D4-AC2): swallow the pointerdown that would otherwise start the engine's
    // own drag/click gesture for `VISTA_CLICK_SWALLOW_MS` after a vista dismissal. Capture
    // phase on `document` so this runs BEFORE the engine's own `canvas.addEventListener`
    // listener (bound directly on the canvas, in the babylon-engine.ts/space-engine.js
    // "SpaceScene's click gate, not the engine" split the implementation plan calls for) —
    // scoped to clicks that actually target the engine element so it never touches mission
    // bar / card / any other chrome's own clicks.
    const swallowEngineClick = (ev: PointerEvent) => {
      if (Date.now() >= clickSwallowUntilRef.current) return;
      const target = ev.target as Element | null;
      if (target?.closest?.("space-engine, babylon-scene")) {
        ev.stopPropagation();
      }
    };
    document.addEventListener("pointerdown", swallowEngineClick, true);

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
      document.removeEventListener("pointerdown", swallowEngineClick, true);
      document.removeEventListener("click", clickDelegate);
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
      // TR-102 (owner-reported classic-view scroll jank): `dodge` only matters when a
      // sprite could actually show, and `show` below already requires `travel` — so
      // computing it while `!travel` (classic view) was pure waste, and the worst kind:
      // three `getBoundingClientRect()` calls forcing a synchronous layout flush on
      // EVERY rAF tick while the visitor is mid-scroll, the exact "not smooth" symptom
      // reported. Gating on `atHome && travel` removes that cost in classic view with no
      // behavior change in travel mode (dodge was already unreachable there when !travel).
      const heroCopy =
        atHome && travel ? document.getElementById("ij-hero-copy") : null;
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

  // PF-11 D4.1: the global Escape dispatcher — exactly one of these closes per press, in this
  // priority order (replaces the old blanket `patch({cardId:null, mcOpen:false,
  // sectionOpen:null})` that closed everything at once regardless of what was actually open).
  // `mcOpen` rides along wherever it's already inert (see types.ts — nothing currently reads
  // it as true) so it's never left stuck if a future consumer starts setting it.
  useEscapeStack([
    {
      active: !!state.cardId,
      onEscape: () => patch({ cardId: null, mcOpen: false }),
    },
    {
      active: state.renderConsoleOpen,
      onEscape: () => patch({ renderConsoleOpen: false }),
    },
    { active: !!state.vista, onEscape: () => dismissVista("escape") },
    { active: !!state.cmd, onEscape: () => patch({ cmd: "" }) },
    {
      active: !!state.sectionOpen,
      onEscape: () => patch({ sectionOpen: null, mcOpen: false }),
    },
  ]);

  if (!engineReady) return null;

  // --- derived render values (mirrors renderVals() for the Phase 2/3 subset) ---
  // PF-11 D4.3: gated on !cardId && !vista as a render-time backstop — belt-and-suspenders
  // alongside the explicit `hover: null` clears at both card-open sites above, so a future
  // path that opens the card without remembering that clear still can't leave a stale
  // tooltip showing (or fighting the card's focus trap) underneath it.
  const hoverTooltip: HoverTooltipData | null = (() => {
    if (!state.hover || state.cardId || state.vista) return null;
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
      // PF-11 D4.3 naming pass: "dossier" is reserved for SectionOverlay's own display mode
      // (the delivery plan's R8 audit) — the collector card is never called that anywhere else.
      cta:
        !state.warp && state.arrivedId === e.id
          ? "ON STATION · OPEN COLLECTOR CARD ▸"
          : "CLICK TO TRAVEL ▸",
      x: state.hover.x,
      y: state.hover.y,
    };
  })();

  const warpDestName = (() => {
    if (!state.warp) return "";
    if (state.warp.home) return "Sol · Home";
    return bodyDisplayName(state.warp.id);
  })();

  const vistaEntry = state.vista ? entryFor(state.vista.id) : null;
  const cardEntry = state.cardId ? entryFor(state.cardId) : null;

  const { suggestions, total: suggestionTotal } = searchSuggestions(state.cmd);
  const featuredSuggestions: CommandSuggestion[] = getFeaturedSuggestions();

  const engineStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  } as const;

  return (
    <>
      {engineKind === "babylon" ? (
        // PF-09 B2 step 3: no ref (SpaceEngineElement typing targets the
        // custom-element contract, not a React ref) — the host drives it via
        // engineEl()'s combined querySelector above, same as space-engine.
        <babylon-scene style={engineStyle} />
      ) : (
        <space-engine ref={engineRef} style={engineStyle} />
      )}

      {perfHud && (
        <div
          style={{
            position: "fixed",
            top: 8,
            left: 8,
            zIndex: 80,
            font: "11px/1.5 monospace",
            letterSpacing: "0.08em",
            color: "#9fa8da",
            background: "rgba(5,8,26,0.72)",
            border: "1px solid #1a237e",
            borderRadius: 6,
            padding: "6px 9px",
            pointerEvents: "none",
            whiteSpace: "pre",
          }}
        >
          {`ENGINE ${perfHud.engine}${
            perfHud.engine === "babylon"
              ? ` · ${backend ? backend.toUpperCase() : "BACKEND ?"}`
              : ""
          } · TIER ${perfHud.tier}\n` +
            `STARTUP ${perfHud.startupMs == null ? "—" : Math.round(perfHud.startupMs) + "ms"}\n` +
            `▶ RENDER FPS ${perfHud.renderFps ?? "—"}   ← RECORD THIS\n` +
            `   host rAF ${perfHud.fps} / ${perfHud.displayHz || "?"}Hz${perfHud.fps > perfHud.displayHz + 2 ? " ⚠IMPOSSIBLE" : ""}\n` +
            `   rendered ${perfHud.renderFrames == null ? "— (no counter)" : perfHud.renderFrames}${perfHud.renderFrames === 0 ? " ⚠NOT DRAWING" : ""}\n` +
            `   ${deviceSignature(perfHud.device)}`}
        </div>
      )}

      {funnelOverlayOn && funnelSession && (
        <FunnelOverlay session={funnelSession} />
      )}

      <HUD
        progress={state.progress}
        ready={state.ready}
        catalogCount={catalog().length}
        aim={state.aim}
        warp={state.warp}
        arrivedId={state.arrivedId}
        sector={state.sector}
        onOpenCredits={openCredits}
        onOpenRenderConsole={
          engineKind === "babylon" ? openRenderConsole : undefined
        }
        isTravel={isTravel}
        onToggleNavMode={toggleNavMode}
        farField={!state.warp && isFarField(state.arrivedId)}
      />

      <PreFlight
        isTravel={isTravel}
        engineKind={engineKind}
        engineBackend={preflightBackend}
        stages={stages}
        armed={state.ready}
        onLaunch={onLaunch}
      />

      {ascentActive && <AscentSkip onSkip={skipAscent} />}

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
          totalMatches={suggestionTotal}
          featured={featuredSuggestions}
          onCmdChange={(value) => {
            patch({ cmd: value });
            // PF-11 D1.4: computed synchronously against THIS keystroke's value, not the
            // stale `suggestions` from the render that's about to be superseded — the
            // zero-result-query flag (research plan §3) needs the query paired with the
            // count it actually produced.
            const trimmed = value.trim().toLowerCase();
            if (trimmed) {
              funnelRef.current?.record("search-keystroke", {
                query: trimmed,
                resultCount: searchTotalMatches(value),
              });
            }
          }}
          onCmdKeyDown={(e) => {
            // PF-11 D5.2 — Enter/ArrowUp/ArrowDown are now owned by MissionControlBar's own
            // combobox (activates the highlighted option directly via onSuggestionSelect);
            // Escape is the one key it still delegates back up, since clearing `cmd` is host
            // state MissionControlBar doesn't own.
            if (e.key === "Escape") patch({ cmd: "" });
          }}
          onSuggestionSelect={(s) => {
            funnelRef.current?.record("search-travel", { id: s.id });
            patch({ cmd: "", hover: null });
            engineEl()?.travelTo(s.id);
          }}
          onRandom={() => engineEl()?.randomBody()}
          onHome={() => engineEl()?.goHome()}
          queuedName={
            state.queuedTargetId ? bodyDisplayName(state.queuedTargetId) : null
          }
        />
      )}

      <HoverTooltip data={hoverTooltip} />

      {/* PF-11 D4.1 (D4-AC6): persists across the vista's own mount/unmount so a dismissal
          announcement is still there for assistive tech to read after the vista is gone. */}
      <div role="status" className="sr-only">
        {vistaAnnouncement}
      </div>

      <WarpOverlay
        warp={state.warp}
        destName={warpDestName}
        notice={state.notice}
        queuedName={
          state.queuedTargetId ? bodyDisplayName(state.queuedTargetId) : null
        }
      />

      {vistaEntry && (
        <ArrivalVista
          entry={vistaEntry}
          onDismiss={dismissVista}
          onOpenCard={() => {
            funnelRef.current?.record("vista-dismissed", { via: "open-card" });
            // PF-11 D4.3: hover is already null here in practice (the vista blocks all
            // pointer events, so nothing could have re-hovered since arrival) — cleared
            // explicitly anyway so this path doesn't silently depend on that staying true.
            patch({
              vista: null,
              cardId: vistaEntry.id,
              hover: null,
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

      {state.renderConsoleOpen && engineKind === "babylon" && (
        <RenderConsole onClose={() => patch({ renderConsoleOpen: false })} />
      )}
    </>
  );
}
