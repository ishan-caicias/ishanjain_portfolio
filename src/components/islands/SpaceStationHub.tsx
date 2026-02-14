import { useState, useRef, type KeyboardEvent } from "react";
import type { PanelId, HubControl } from "@/types";

interface SpaceStationHubProps {
  onPanelOpen: (panelId: PanelId) => void;
  onDeploy: () => void;
  isVisible: boolean;
}

const HUB_CONTROLS: HubControl[] = [
  {
    id: "about",
    label: "About",
    ariaLabel: "Open About panel",
    description: "Learn about my background and achievements",
  },
  {
    id: "skills",
    label: "Skills",
    ariaLabel: "Open Skills panel",
    description: "Technologies and tools I work with",
  },
  {
    id: "projects",
    label: "Projects",
    ariaLabel: "Open Projects panel",
    description: "Things I've built and maintained",
  },
  {
    id: "experience",
    label: "Experience",
    ariaLabel: "Open Experience panel",
    description: "My professional journey",
  },
  {
    id: "writing",
    label: "Writing",
    ariaLabel: "Open Writing panel",
    description: "Thoughts on engineering and technology",
  },
  {
    id: "contact",
    label: "Connect",
    ariaLabel: "Open Contact panel",
    description: "Let's build something together",
  },
  {
    id: "deploy",
    label: "DEPLOY",
    ariaLabel: "Deploy rover to Earth",
    description: "Send rover on a special mission",
  },
];

// SVG icon components for each control
const AboutIcon = () => (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const SkillsIcon = () => (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ProjectsIcon = () => (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const ExperienceIcon = () => (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const WritingIcon = () => (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const ContactIcon = () => (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const DeployIcon = () => (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const CONTROL_ICONS: Record<string, () => JSX.Element> = {
  about: AboutIcon,
  skills: SkillsIcon,
  projects: ProjectsIcon,
  experience: ExperienceIcon,
  writing: WritingIcon,
  contact: ContactIcon,
  deploy: DeployIcon,
};

export default function SpaceStationHub({
  onPanelOpen,
  onDeploy,
  isVisible,
}: SpaceStationHubProps) {
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const controlRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleControlClick = (control: HubControl) => {
    if (control.id === "deploy") {
      onDeploy();
    } else {
      onPanelOpen(control.id as PanelId);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let newIndex = index;

    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        newIndex = (index + 1) % HUB_CONTROLS.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        newIndex = (index - 1 + HUB_CONTROLS.length) % HUB_CONTROLS.length;
        break;
      case "Home":
        e.preventDefault();
        newIndex = 0;
        break;
      case "End":
        e.preventDefault();
        newIndex = HUB_CONTROLS.length - 1;
        break;
      default:
        return;
    }

    setFocusedIndex(newIndex);
    controlRefs.current[newIndex]?.focus();
  };

  return (
    <div
      data-testid="mission-control-cluster"
      className={`hub-container mx-auto flex max-w-[720px] flex-col items-center transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <h1
        id="mission-control-heading"
        className="font-heading text-4xl font-bold text-text-primary"
      >
        Mission Control
      </h1>
      <p className="mt-2 text-sm uppercase tracking-wider text-text-dim">
        Select Module to Dock
      </p>
      <p className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-gold-400/80">
        <span aria-hidden="true">💡</span>
        <span>
          Tip: Click the golden stars or press{" "}
          <kbd className="rounded bg-gold-400/20 px-1.5 py-0.5 font-mono text-[10px] text-gold-300">
            G
          </kbd>{" "}
          to discover cosmic imagery
        </span>
      </p>

      <nav
        role="navigation"
        aria-label="Mission control navigation hub"
        className="hub-controls mt-8 grid grid-cols-3 gap-4 sm:gap-6"
        style={{ maxWidth: "600px" }}
      >
        {HUB_CONTROLS.map((control, index) => {
          const IconComponent = CONTROL_ICONS[control.id];
          const isDeploy = control.id === "deploy";

          return (
            <button
              key={control.id}
              ref={(el) => (controlRefs.current[index] = el)}
              onClick={() => handleControlClick(control)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onFocus={() => setFocusedIndex(index)}
              aria-label={control.ariaLabel}
              title={control.description}
              className={`
                hub-control group relative flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2
                transition-all duration-200
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0e27]
                ${
                  isDeploy
                    ? "border-gold-400 bg-gradient-to-br from-gold-600 to-gold-400 text-surface hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] focus-visible:ring-gold-400"
                    : "border-royal-600 bg-surface-elevated text-text-muted hover:border-royal-500 hover:bg-royal-800/30 hover:text-royal-400 hover:shadow-[0_0_15px_rgba(92,107,192,0.3)] focus-visible:ring-royal-400"
                }
                ${index === 6 ? "col-start-2" : ""}
              `}
            >
              <IconComponent />
              <span
                className={`text-sm font-semibold uppercase tracking-wide ${
                  isDeploy ? "text-surface" : "text-inherit"
                }`}
              >
                {control.label}
              </span>

              <div
                className={`pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity group-hover:opacity-100 ${
                  isDeploy
                    ? "bg-gradient-to-br from-gold-300/20 to-transparent"
                    : "bg-gradient-to-br from-royal-500/20 to-transparent"
                }`}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </nav>
      <p className="mt-6 text-center text-xs text-text-dim">
        Use arrow keys to navigate • Enter or Space to activate
      </p>
    </div>
  );
}
