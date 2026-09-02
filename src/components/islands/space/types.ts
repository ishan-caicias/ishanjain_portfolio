// Shared state/value types for the SpaceScene port (PF-07 Phases 2-3).
// Mirrors the `state` shape and `renderVals()` output groups from the prototype's DCLogic
// class - see docs/delivery-plan/PF-07-space-portfolio-webgl.md.

export interface WarpState {
  id: string;
  t: number;
  ly: number | null;
  phase: "aim" | "warp";
  wphase?: "flip" | "decel" | "accel";
  vC?: number;
  home?: boolean;
}

export interface HoverState {
  id: string;
  x: number;
  y: number;
}

/** PF-11 D3.3 — a transient HUD acknowledgement for a mid-journey input that would
 * otherwise be silent (ADR-0010): an aborted journey, or a destination queued to launch
 * on arrival. Auto-clears itself (SpaceScene owns the timeout); `queuedTargetId` below is
 * the separate PERSISTENT half — it lives for as long as the queue itself does, not just
 * for the few seconds the acknowledgement banner shows. */
export interface NavNotice {
  kind: "abort" | "retarget-queued";
  text: string;
}

export type NavMode = "travel" | "scroll";
export type SectionDisplayMode = "dossier" | "console" | "holo";
export type CardStyleMode = "holo" | "dossier" | "plate";

export interface SceneState {
  hover: HoverState | null;
  cardId: string | null;
  warp: WarpState | null;
  arrivedId: string | null;
  /** PF-11 D3.3 — mirrors the engine's public `queuedTargetId` (space-engine.d.ts):
   * non-null for exactly as long as a mid-journey retarget is pending. Cleared when that
   * journey actually launches (`cosmos:select` for this id), when it turns out to already
   * be the arrival just reached (the engine's same-id no-op case), or when an abort
   * discards it. */
  queuedTargetId: string | null;
  notice: NavNotice | null;
  vista: { id: string } | null;
  sector: string;
  sectionOpen: string | null;
  navOverride: NavMode | null;
  dispOverride: SectionDisplayMode | null;
  progress: { loaded: number; total: number };
  ready: boolean;
  /** PF-08 F0: craft load resolved (ready or error→wireframe) — landing gate. */
  craftDone: boolean;
  aim: { ra: number; dec: number };
  cmd: string;
  mcOpen: boolean;
  copied: boolean;
  styleOverride: CardStyleMode | null;
  tilt: { rx: number; ry: number; mx: number; my: number };
  /** PF-11 D9.2 — the Render Console dialog's open state. Its own field rather than folding
   * into `sectionOpen` (a content-driven dossier switch) because this is a control surface
   * with live-updating checkboxes/sliders, not a content section. */
  renderConsoleOpen: boolean;
}

export const INITIAL_SCENE_STATE: SceneState = {
  hover: null,
  cardId: null,
  warp: null,
  arrivedId: null,
  queuedTargetId: null,
  notice: null,
  vista: null,
  sector: "hero",
  sectionOpen: null,
  navOverride: null,
  dispOverride: null,
  progress: { loaded: 0, total: 168883 },
  ready: false,
  craftDone: false,
  aim: { ra: 45, dec: -8 },
  cmd: "",
  mcOpen: false,
  copied: false,
  styleOverride: null,
  tilt: { rx: 0, ry: 0, mx: 50, my: 50 },
  renderConsoleOpen: false,
};

export interface Station {
  sec: string;
  ra: number;
  dec: number;
  ly: number;
  label: string;
  sub: string;
  craft: "sat" | "voyager" | "comet" | "station" | "debris" | "dish" | "moon";
}

// Decoupled nav stations - an even fan across the sky above the hero copy.
export const STATIONS: Station[] = [
  {
    sec: "achievements",
    ra: 96,
    dec: 14.2,
    ly: 548,
    label: "ACHIEVEMENTS",
    sub: "BETELGEUSE · 548 LY",
    craft: "comet",
  },
  {
    sec: "projects",
    ra: 81.3,
    dec: 17.7,
    ly: 1344,
    label: "PROJECTS",
    sub: "ORION NEBULA · 1,344 LY",
    craft: "station",
  },
  {
    sec: "experience",
    ra: 66.7,
    dec: 19.2,
    ly: 65,
    label: "EXPERIENCE",
    sub: "ALDEBARAN · 65 LY",
    craft: "voyager",
  },
  {
    sec: "moonbase",
    ra: 52,
    dec: 19.5,
    ly: 0.0000158,
    label: "MOON BASE",
    sub: "CREDITS · MISSION CTRL",
    craft: "moon",
  },
  {
    sec: "about",
    ra: 37.3,
    dec: 19.2,
    ly: 444,
    label: "WHAT I DO",
    sub: "PLEIADES · 444 LY",
    craft: "sat",
  },
  {
    sec: "skills",
    ra: 22.7,
    dec: 17.7,
    ly: 860,
    label: "SKILLS & TOOLS",
    sub: "RIGEL · 860 LY",
    craft: "debris",
  },
  {
    sec: "contact",
    ra: 8,
    dec: 14.2,
    ly: 8.6,
    label: "LET'S CONNECT",
    sub: "SIRIUS · 8.6 LY",
    craft: "dish",
  },
];

export const SECTOR_LABELS: Record<string, string> = {
  hero: "SOL · HOME",
  about: "PLEIADES",
  experience: "ALDEBARAN",
  achievements: "BETELGEUSE",
  projects: "ORION NEBULA",
  skills: "RIGEL",
  contact: "SIRIUS",
  moonbase: "MOON BASE",
};

export const SECTION_TITLES: Record<string, string> = {
  about: "What I Do",
  experience: "Experience",
  achievements: "Selected Achievements",
  projects: "Projects",
  skills: "Skills & Tools",
  contact: "Let's Connect",
  moonbase: "Moon Base · Mission Control",
  credits: "Data Sources & Licenses",
};

// Sector -> body id the ship travels to when that section scrolls into view (scroll mode).
export const SECTOR_BODIES: Record<string, string> = {
  hero: "__home",
  about: "m45",
  experience: "aldebaran",
  achievements: "betelgeuse",
  projects: "m42",
  skills: "rigel",
  contact: "sirius",
};
