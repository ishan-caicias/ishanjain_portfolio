import { useState, useEffect, type ReactNode } from "react";
import type { PanelId } from "@/types";
import { announce } from "@/utils/announce";
import { selectTargets, getDailySeed } from "@/content/nasaTargets";
import SpaceStationHub from "./SpaceStationHub";
import PanelShell from "./PanelShell";
import PanelAbout from "../panels/PanelAbout";
import PanelSkills from "../panels/PanelSkills";
import PanelExperience from "../panels/PanelExperience";
import PanelProjects from "../panels/PanelProjects";
import PanelWriting from "../panels/PanelWriting";
import PanelContact from "../panels/PanelContact";

const VALID_PANELS: PanelId[] = [
  "about",
  "skills",
  "experience",
  "projects",
  "writing",
  "contact",
];

const PANEL_COMPONENTS: Record<PanelId, () => ReactNode> = {
  about: PanelAbout,
  skills: PanelSkills,
  experience: PanelExperience,
  projects: PanelProjects,
  writing: PanelWriting,
  contact: PanelContact,
};

const PANEL_TITLES: Record<PanelId, { title: string; subtitle?: string }> = {
  about: {
    title: "About Me",
    subtitle: "Background, achievements & what I do",
  },
  skills: {
    title: "Skills & Tools",
    subtitle: "Technologies I work with regularly",
  },
  experience: {
    title: "Experience",
    subtitle: "Building fintech risk infrastructure in production",
  },
  projects: {
    title: "Projects",
    subtitle: "Things I've built and maintained",
  },
  writing: {
    title: "Writing",
    subtitle: "Thoughts on engineering and technology",
  },
  contact: {
    title: "Connect",
    subtitle: "Let's build something together",
  },
};

export default function PanelCoordinator() {
  const [activePanelId, setActivePanelId] = useState<PanelId | null>(null);

  // Handle URL hash changes (initial load + browser back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) as PanelId; // Remove #

      if (VALID_PANELS.includes(hash)) {
        setActivePanelId(hash);
      } else if (hash === "" || hash === "hub") {
        setActivePanelId(null);
      }
      // Invalid hashes are ignored
    };

    // Run on initial mount to handle deep links
    handleHashChange();

    // Listen for hash changes (browser back/forward, manual URL changes)
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  // Update body attribute for CSS hooks (starfield dimming, scroll lock)
  useEffect(() => {
    if (activePanelId) {
      document.body.setAttribute("data-panel-open", "true");
    } else {
      document.body.removeAttribute("data-panel-open");
    }
  }, [activePanelId]);

  // Keyboard shortcut for golden stars ('G' key)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if not in input/textarea and 'G' is pressed
      if (
        e.key.toLowerCase() === "g" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();

        // Get today's selected targets (same deterministic list as Starfield)
        const dailySeed = getDailySeed();
        const targets = selectTargets(dailySeed, 8);

        // Pick random target from today's 8 (use timestamp for randomness)
        const randomIdx = Math.floor(Math.random() * targets.length);
        const target = targets[randomIdx];

        // Dispatch starclick event (same event as canvas clicks)
        window.dispatchEvent(
          new CustomEvent("starclick", {
            detail: {
              targetId: target.id,
              isLegacy: false,
              hubbleIndex: randomIdx,
            },
          }),
        );

        console.log(`[Keyboard] Opened golden star: ${target.label}`);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  // Open panel handler
  const openPanel = (panelId: PanelId) => {
    // Update URL hash (this will trigger hashchange event)
    window.history.pushState(null, "", `#${panelId}`);
    setActivePanelId(panelId);

    // Announce to screen readers
    const panelTitle = PANEL_TITLES[panelId].title;
    announce(`${panelTitle} panel opened`);
  };

  // Close panel handler
  const closePanel = () => {
    // Update URL hash to clear it
    window.history.pushState(null, "", "#");
    setActivePanelId(null);

    // Announce to screen readers
    announce("Panel closed, returned to mission control hub");
  };

  // Handle rover deployment (DEPLOY button)
  const handleDeploy = () => {
    // Dispatch custom event for RoverAnimation to listen to
    window.dispatchEvent(new CustomEvent("rover:deploy"));
    announce("Rover deployed to Earth surface");
  };

  // Get active panel component
  const ActivePanelComponent = activePanelId
    ? PANEL_COMPONENTS[activePanelId]
    : null;

  return (
    <>
      {/* Space Station Hub (visible when no panel is open or dimmed behind panel) */}
      <SpaceStationHub
        onPanelOpen={openPanel}
        onDeploy={handleDeploy}
        isVisible={!activePanelId}
      />

      {/* Panel Shell with active panel content */}
      {activePanelId && ActivePanelComponent && (
        <PanelShell
          isOpen={true}
          panelId={activePanelId}
          title={PANEL_TITLES[activePanelId].title}
          subtitle={PANEL_TITLES[activePanelId].subtitle}
          onClose={closePanel}
        >
          <ActivePanelComponent />
        </PanelShell>
      )}
    </>
  );
}
