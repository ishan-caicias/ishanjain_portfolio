import { credibilityItems } from "@/content/credibility";
import { experiences } from "@/content/experience";
import { achievements } from "@/content/achievements";
import { projects } from "@/content/projects";
import { skillCategories } from "@/content/skills";
import { iconPaths } from "@/content/icons";
import { LINKEDIN_URL, GITHUB_URL } from "@/content/links";
import { STATIONS, SECTION_TITLES } from "./types";
import type { SectionDisplayMode } from "./types";
import { useState } from "react";
import {
  parseStoredQuality,
  readTierSignals,
  resolveCraftTier,
  CRAFT_QUALITY_STORAGE_KEY,
  type CraftQuality,
} from "@/lib/craft-tier";

/**
 * ship-v2 P4 (TR-019): accessible craft-quality override. Persists to
 * localStorage and applies to the live <space-engine> immediately — the
 * engine's attributeChangedCallback swaps tiers (or restores the wireframe)
 * without a reload. Renders client-side only (inside the credits dialog), so
 * localStorage access in the initializer is safe.
 */
function CraftQualityControl({ cardClass }: { cardClass: string }) {
  const [quality, setQuality] = useState<CraftQuality>(
    () =>
      parseStoredQuality(localStorage.getItem(CRAFT_QUALITY_STORAGE_KEY)) ??
      "auto",
  );

  const apply = (next: CraftQuality) => {
    setQuality(next);
    localStorage.setItem(CRAFT_QUALITY_STORAGE_KEY, next);
    const en = document.querySelector("space-engine");
    if (!en) return;
    const tier =
      next === "auto" ? resolveCraftTier(readTierSignals(window)) : next;
    if (tier === "off") en.removeAttribute("craft");
    else en.setAttribute("craft", tier);
  };

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label
          htmlFor="ij-craft-quality"
          className="font-heading text-[14.5px] font-semibold text-gold-400"
        >
          Ship model quality
        </label>
        <select
          id="ij-craft-quality"
          value={quality}
          onChange={(e) => apply(e.target.value as CraftQuality)}
          className="rounded border border-[#3f51b5] bg-[#0d1126] px-2 py-1 font-mono text-[11px] tracking-wider text-[#c5cae9]"
        >
          <option value="auto">Auto — pick for my device</option>
          <option value="2k">High — 2K textures</option>
          <option value="1k">Lite — smaller download</option>
          <option value="off">Off — classic wireframe</option>
        </select>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-[#9fa8da]">
        Applies immediately and is remembered on this device. Auto uses your
        connection, memory, and screen size to choose.
      </p>
    </div>
  );
}

const CREDIT_ROWS: { name: string; meta: string; lic: string }[] = [
  {
    name: "Sci-Fi Aircraft | Spaceship Fighter",
    meta: "Ship model · valterjherson1 · CC-BY-4.0",
    lic: "This work is based on “Sci-Fi Aircraft | Spaceship Fighter” (sketchfab.com/3d-models/sci-fi-aircraft-spaceship-fighter-99c1d15965c74f3aa7b5999e2d4e42e1) by valterjherson1 (sketchfab.com/valterjherson1), licensed under CC-BY-4.0 (creativecommons.org/licenses/by/4.0). Converted and optimized: meshopt-compressed geometry, WebP textures in 1K/2K tiers.",
  },
  {
    name: "Hipparcos (new reduction)",
    meta: "117,955 stars · F. van Leeuwen 2007",
    lic: "Bright charted-star positions, magnitudes and curated names. Repackaged for Gaia Sky by Toni Sagristà, ZAH · Universität Heidelberg.",
  },
  {
    name: "Gaia DR3",
    meta: "ESA / Gaia / DPAC",
    lic: "Astrometric reference for the field-star layer. Gaia data: CC BY-SA 3.0 IGO, ESA/Gaia/DPAC.",
  },
  {
    name: "Milky Way diffuse layer",
    meta: "Procedural — integrated starlight + Great Rift dust",
    lic: "Computed in the J2000 galactic frame (NGP RA 192.86°, Dec +27.13°): Sagittarius bulge, Cygnus / Carina / Scutum star clouds, Coalsack. Relativistic aberration + Doppler applied in transit.",
  },
  {
    name: "Fifth Catalogue of Nearby Stars (CNS5)",
    meta: "5,931 stars · Golovin et al. 2022 · ARI Heidelberg",
    lic: "Volume-complete solar-neighbourhood sample; distances for nearby charted stars.",
  },
  {
    name: "NGC2000.0 nebulae",
    meta: "47 objects · R.W. Sinnott (ed.), via HEASARC",
    lic: "Nebula positions and classifications.",
  },
  {
    name: "NEARGALCAT — Updated Nearby Galaxy Catalog",
    meta: "869 galaxies · Karachentsev et al. 2013",
    lic: "Nearby-galaxy distances and types.",
  },
  {
    name: "Messier catalog (1774–1781)",
    meta: "110 objects · Charles Messier & Pierre Méchain",
    lic: "Historic deep-sky designations; public domain.",
  },
  {
    name: "Yale Bright Star Catalogue (BSC5)",
    meta: "9,096 stars · Hoffleit & Warren 1991",
    lic: "Named-star positions, magnitudes, spectra, parallaxes; public domain.",
  },
  {
    name: "OpenNGC",
    meta: "NGC/IC compilation · Mattia Verga",
    lic: "Deep-sky types, positions, magnitudes; CC-BY-SA-4.0.",
  },
  {
    name: "NASA Image and Video Library",
    meta: "images.nasa.gov · NASA / ESA / STScI",
    lic: "Deep-sky photography, public domain per NASA media guidelines; per-image credits on each card.",
  },
  {
    name: "Gaia Sky base data pack",
    meta: "Toni Sagristà · ZAH, Universität Heidelberg",
    lic: "Planet & moon surface maps, constellation figures, star texture, spaceship model. Gaia Sky is MPL 2.0; imagery: NASA Visible Earth, Solar System Scope, USGS.",
  },
  {
    name: "Deep-sky photography",
    meta: "NASA / ESA · Hubble & JWST archives",
    lic: "Collector-card imagery, used per NASA media guidelines (public domain).",
  },
  {
    name: "Field-star layer · 117,955 real stars",
    meta: "Hipparcos new reduction (van Leeuwen 2007) · full catalog",
    lic: "Every field star is a real Hipparcos source: parsed from the Gaia Sky binary pack (positions, magnitudes, true chromaticities) into a 15-byte packed chunk. Build scripts in data/build/.",
  },
  {
    name: "Deep layer · 50,928 typed objects",
    meta: "7 populations · one packed chunk (assets/deep.png)",
    lic: "Open clusters 8,076 (Hunt-Reffert DR3 + MWSC + OCDR2, deduped) · white dwarfs 9,000 (Gentile Fusillo eDR3, via VizieR TAP) · SDSS DR12 galaxies 23,417 of 327,835 · GD-1 stream 1,365 · exoplanet hosts 4,134 (NASA Exoplanet Archive) · DR3 asteroids 1,936 (NEA + Trojans, propagated to today) · Oort cloud 3,000.",
  },
  {
    name: "Spacecraft & systems",
    meta: "Voyager 1/2 · JWST · HST · ISS · Euclid · GPS · 7 DR3 systems · Gaia BH1-3 · Gargantua",
    lic: "Voyager positions interpolated from real trajectory files to today's date. Gaia DR3 astrometric planetary systems and black holes from the Gaia Sky system packs; Gargantua is the one admitted fiction.",
  },
  {
    name: "Planet textures & topography",
    meta: "Gaia Sky hi-res pack · LRO LOLA · MGS MOLA",
    lic: "Planet and moon surface maps upgraded from the hi-res texture pack; lunar and martian elevation globes composed from the virtual-texture tilesets.",
  },
  {
    name: "SDSS DR12",
    meta: "Sloan Digital Sky Survey · skyserver.sdss.org",
    lic: "Galaxy sample with comoving distances. Funding: Alfred P. Sloan Foundation & participating institutions.",
  },
  {
    name: "Field-star chunk (retired)",
    meta: "Procedural, seeded · galactic-structure model",
    lic: "Prototype layer, replaced by the real Hipparcos parse above. The old pipeline parsed the catalogs into the same 16-byte binary star format.",
  },
];

interface SectionOverlayProps {
  section: string;
  dispMode: SectionDisplayMode;
  onClose: () => void;
  onReturnSol: () => void;
  onSetDispMode: (mode: SectionDisplayMode) => void;
  copyLabel: string;
  onCopyBio: () => void;
}

const VARIANT_CLASSES: Record<
  SectionDisplayMode,
  { wrap: string; scrim: string; panel: string; grid: string; card: string }
> = {
  console: {
    wrap: "pointer-events-none fixed inset-0 z-[85]",
    scrim:
      "pointer-events-auto absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#020310]/50",
    panel:
      "pointer-events-auto absolute bottom-0 right-0 top-16 w-[min(620px,94vw)] animate-[ij-slidein_0.38s_ease-out_both] overflow-y-auto overscroll-contain border-l border-[#2e7d32]/45 bg-[#05070f]/93 px-7 pb-11 pt-6.5 backdrop-blur-md",
    grid: "mt-4.5 grid grid-cols-1 gap-3",
    card: "rounded-lg border border-[#283593]/45 bg-[#10142c]/72 px-4.5 py-4",
  },
  holo: {
    wrap: "pointer-events-none fixed inset-0 z-[85] flex items-center justify-center px-6 pb-8 pt-20",
    scrim:
      "pointer-events-auto absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(2,3,10,0.55)_0%,rgba(2,3,10,0.78)_100%)]",
    panel:
      "pointer-events-auto relative w-[min(1060px,96vw)] max-h-[calc(100vh-120px)] animate-[ij-fadein_0.5s_ease-out_both] overflow-y-auto overscroll-contain p-2",
    grid: "mt-4.5 grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4",
    card: "animate-[ij-holo_5.5s_ease-in-out_infinite_alternate] rounded-xl border border-[#7986cb]/45 bg-[#12173a]/50 px-4.5 py-4 shadow-[0_0_24px_rgba(63,81,181,0.25),inset_0_0_20px_rgba(63,81,181,0.08)] backdrop-blur-md",
  },
  dossier: {
    wrap: "pointer-events-none fixed inset-0 z-[85] flex items-center justify-center px-5 pb-7 pt-20",
    scrim:
      "pointer-events-auto absolute inset-0 bg-[#04050f]/72 backdrop-blur-sm",
    panel:
      "pointer-events-auto relative w-[min(900px,95vw)] max-h-[calc(100vh-116px)] animate-[ij-cardin_0.32s_ease-out_both] overflow-y-auto overscroll-contain rounded-lg border border-[#3f51b5]/60 px-7 pb-8 pt-6 shadow-[0_40px_80px_rgba(0,0,0,0.6)] [background:linear-gradient(rgba(10,13,26,0.97),rgba(10,13,26,0.97)),repeating-linear-gradient(0deg,rgba(92,107,192,0.12)_0px,rgba(92,107,192,0.12)_1px,transparent_1px,transparent_3px)]",
    grid: "mt-4.5 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5",
    card: "rounded-md border border-[#283593]/50 bg-[#10142c]/60 px-4 py-3.5",
  },
};

/**
 * The docked-station content panel (About/Experience/Achievements/Projects/Skills/Contact/
 * Moon Base/Credits), in one of three visual variants the user can switch between. Ported
 * from lines 184-329 (template) + the `sec*`/`disp*` computed groups in renderVals().
 */
export default function SectionOverlay({
  section,
  dispMode,
  onClose,
  onReturnSol,
  onSetDispMode,
  copyLabel,
  onCopyBio,
}: SectionOverlayProps) {
  const stMeta = STATIONS.find((x) => x.sec === section);
  const title = SECTION_TITLES[section] || "";
  const label =
    section === "credits"
      ? "MISSION DATA · ATTRIBUTION"
      : stMeta
        ? "DOCKED · " + stMeta.sub
        : "DOCKED";
  const v = VARIANT_CLASSES[dispMode];

  const chipClass = (name: SectionDisplayMode) =>
    `rounded px-2.5 py-1 font-mono text-[10px] tracking-wider ${
      dispMode === name
        ? "border border-[#ffc107]/60 bg-[#ffc107]/[0.08] text-[#ffd54f]"
        : "border border-[#3f51b5]/50 bg-transparent text-[#9fa8da]"
    }`;

  return (
    <div data-screen-label="Section overlay" className={v.wrap}>
      <div onClick={onClose} aria-hidden="true" className={v.scrim} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={v.panel}
      >
        <div className="flex items-start justify-between gap-3.5">
          <div>
            <div className="font-mono text-[10.5px] tracking-[0.28em] text-[#43a047]">
              {label}
            </div>
            <h2 className="mt-1.5 font-heading text-[clamp(24px,3.4vh,32px)] font-bold text-text-primary">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close section"
            className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full border border-[#3f51b5]/35 bg-[#0a0e27]/80 text-[#9fa8da] hover:bg-[#1a237e]/80 hover:text-text-primary"
          >
            <svg
              width="14"
              height="14"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {section === "about" && (
          <div className={v.grid}>
            {credibilityItems.map((item, i) => (
              <div key={i} className={v.card}>
                <h3 className="font-heading text-base font-semibold text-gold-400">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#9fa8da]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        )}

        {section === "experience" && experiences[0] && (
          <>
            <div className={v.card + " mt-4.5"}>
              <h3 className="font-heading text-lg font-bold text-text-primary">
                {experiences[0].role}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-[#9fa8da]">
                <span className="text-gold-400">{experiences[0].company}</span>
                <span aria-hidden="true">·</span>
                <span>{experiences[0].period}</span>
                <span aria-hidden="true">·</span>
                <span>{experiences[0].location}</span>
              </div>
            </div>
            <ul role="list" className="mt-3.5 flex flex-col gap-2">
              {experiences[0].bullets.map((text, i) => (
                <li
                  key={i}
                  className="flex gap-3 text-[13px] leading-relaxed text-[#9fa8da]"
                >
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#5c6bc0]"
                  />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {section === "achievements" && (
          <div className={v.grid}>
            {achievements.map((a, i) => (
              <div key={i} className={v.card}>
                <div className="mb-2.5 flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-[#283593]/50">
                  <svg
                    width="18"
                    height="18"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="#ffd54f"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={iconPaths[a.icon] || iconPaths.shield}
                    />
                  </svg>
                </div>
                <h3 className="font-heading text-[15px] font-semibold text-text-primary">
                  {a.title}
                </h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#9fa8da]">
                  {a.description}
                </p>
              </div>
            ))}
          </div>
        )}

        {section === "projects" && (
          <div className={v.grid}>
            {projects.map((p, i) => (
              <div key={i} className={v.card}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-heading text-base font-semibold text-text-primary">
                    {p.title}
                  </h3>
                  <span className="whitespace-nowrap rounded-full border border-[#283593]/50 bg-[#1a237e]/50 px-2.5 py-0.5 text-xs text-[#9fa8da]">
                    {p.status}
                  </span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-[#9fa8da]">
                  {p.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.tech.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-[#1a237e]/60 px-2 py-0.5 text-[11px] text-[#9fa8da]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                {p.link && (
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-sm text-gold-400 hover:text-gold-300"
                  >
                    View on GitHub ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {section === "skills" && (
          <div className={v.grid}>
            {skillCategories.map((cat, i) => (
              <div key={i} className={v.card}>
                <h3 className="mb-2.5 font-heading text-xs font-semibold uppercase tracking-wider text-gold-400">
                  {cat.name}
                </h3>
                <ul role="list" className="flex flex-col gap-1.5">
                  {cat.skills.map((sk) => (
                    <li
                      key={sk}
                      className="flex items-center gap-2 text-[13px] text-[#9fa8da]"
                    >
                      <span
                        aria-hidden="true"
                        className="h-1 w-1 flex-shrink-0 rounded-full bg-[#5c6bc0]"
                      />
                      {sk}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {section === "contact" && (
          <>
            <p className="mt-4.5 max-w-[40rem] text-[15px] leading-relaxed text-[#9fa8da]">
              Always open to interesting engineering challenges. Let's chat
              about distributed systems architecture, the nuances of maintaining
              clean code, or the historical value of a vintage Rado.
            </p>
            <div className="mt-5.5 flex flex-wrap items-center gap-3.5">
              <a
                href={LINKEDIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-royal-600 px-5.5 py-2.5 font-medium text-text-primary hover:bg-royal-500"
              >
                LinkedIn ↗
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-royal-600 px-5.5 py-2.5 font-medium text-[#9fa8da] hover:border-gold-500/50 hover:text-gold-400"
              >
                GitHub ↗
              </a>
              <button
                onClick={onCopyBio}
                className="inline-flex items-center gap-2 rounded-lg border border-[#2e7d32]/45 bg-[#1b5e20]/15 px-5.5 py-2.5 font-medium text-[#43a047] hover:bg-[#1b5e20]/30"
              >
                {copyLabel}
              </button>
            </div>
          </>
        )}

        {section === "moonbase" && (
          <>
            <p className="mt-4.5 max-w-[40rem] text-sm leading-relaxed text-[#9fa8da]">
              Welcome to base camp. Built with Astro, React, and a love for the
              cosmos — 117,955 real Hipparcos stars plus 50,928 deep-layer
              objects (clusters, white dwarfs, SDSS galaxies, the GD-1 stream,
              exoplanet hosts, DR3 asteroids) parsed from Gaia Sky data packs,
              imagery courtesy of NASA / ESA archives.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a
                href={LINKEDIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-royal-600 px-5 py-2.5 text-sm font-medium text-text-primary hover:bg-royal-500"
              >
                LinkedIn ↗
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-royal-600 px-5 py-2.5 text-sm font-medium text-[#9fa8da] hover:text-gold-400"
              >
                GitHub ↗
              </a>
              <button
                onClick={onCopyBio}
                className="inline-flex items-center gap-2 rounded-lg border border-[#2e7d32]/45 bg-[#1b5e20]/15 px-5 py-2.5 text-sm font-medium text-[#43a047] hover:bg-[#1b5e20]/30"
              >
                {copyLabel}
              </button>
            </div>
            <p className="mt-5.5 font-mono text-[10px] tracking-wider text-[#6b7394]">
              © 2026 ISHAN JAIN · ALL RIGHTS RESERVED
            </p>
          </>
        )}

        {section === "credits" && (
          <div className="mt-4.5 flex flex-col gap-2.5">
            {CREDIT_ROWS.map((cr, i) => (
              <div key={i} className={v.card}>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="font-heading text-[14.5px] font-semibold text-gold-400">
                    {cr.name}
                  </span>
                  <span className="font-mono text-[9.5px] tracking-wider text-[#5c6bc0]">
                    {cr.meta}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[#9fa8da]">
                  {cr.lic}
                </p>
              </div>
            ))}
            <p className="mt-1.5 font-mono text-[9.5px] tracking-wider text-[#5c6bc0]">
              FULL DATASET INDEX · gaiasky.space/resources/datasets · GAIA SKY
              BY TONI SAGRISTÀ, ZAH · UNIVERSITÄT HEIDELBERG
            </p>
            <CraftQualityControl cardClass={v.card} />
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onSetDispMode("dossier")}
              className={chipClass("dossier")}
            >
              DOSSIER
            </button>
            <button
              onClick={() => onSetDispMode("console")}
              className={chipClass("console")}
            >
              CONSOLE
            </button>
            <button
              onClick={() => onSetDispMode("holo")}
              className={chipClass("holo")}
            >
              HOLO
            </button>
          </div>
          <button
            onClick={onReturnSol}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2e7d32]/45 bg-[#1b5e20]/15 px-3.5 py-1.5 font-mono text-[11px] tracking-wider text-[#43a047] hover:bg-[#1b5e20]/30"
          >
            ◂ RETURN HOME
          </button>
        </div>
      </div>
    </div>
  );
}
