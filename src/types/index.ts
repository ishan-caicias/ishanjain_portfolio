export interface Experience {
  role: string;
  company: string;
  period: string;
  location: string;
  bullets: string[];
}

export interface Achievement {
  title: string;
  description: string;
  icon: string;
}

export interface Project {
  title: string;
  status: "In Progress" | "Private" | "Open Source" | "Archived";
  description: string;
  tech: string[];
  link?: string;
}

export interface SkillCategory {
  name: string;
  skills: string[];
}

export interface HubbleEntry {
  id: string;
  title: string;
  date: string;
  description: string;
  imagePath: string;
  credit: string;
  sourceUrl: string;
}

export interface NavItem {
  label: string;
  href: string;
}

// Mission Control Hub Types
export type PanelId =
  | "about"
  | "skills"
  | "experience"
  | "projects"
  | "writing"
  | "contact";

export interface HubControl {
  id: PanelId | "deploy";
  label: string;
  ariaLabel: string;
  description: string;
}

export interface PanelConfig {
  id: PanelId;
  title: string;
  subtitle?: string;
}

// Astronaut Docking Types
export type DockingState = "hub" | "docking" | "docked" | "returning";

export interface AstronautDockEvent extends CustomEvent {
  detail: {
    x: number;
    y: number;
  };
}

// Rover Animation Types
export type RoverState = "idle" | "traveling" | "deployed" | "resetting";
