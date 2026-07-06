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

export interface ApodEntry {
  id: string;
  title: string;
  date: string;
  description: string;
  imagePath: string;
  credit: string;
  sourceUrl: string;
}

export interface HeroDsoEntry {
  id: string;
  label: string;
  imagePath: string;
  credit: string;
  attributionRequired: boolean;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
}

export interface NavItem {
  label: string;
  href: string;
}
