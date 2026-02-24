import type { Project } from "@/types";

export const projects: Project[] = [
  {
    title: "Project Kubera",
    status: "In Progress",
    description:
      "Personal finance platform built with Clean Architecture and DDD patterns. React frontend with .NET backend and PostgreSQL. Full CI/CD pipeline with automated testing. Exploring an AI-assisted insights layer with RAG experiments connecting to LLM APIs — focused on architecture patterns, full-stack ownership, and iterative delivery.",
    tech: [
      "C#/.NET",
      "React",
      "PostgreSQL",
      "Clean Architecture",
      "DDD",
      "RAG",
      "OpenAI API",
      "Docker",
      "GitHub Actions",
    ],
  },
  {
    title: "Trading Systems R&D",
    status: "Private",
    description:
      "Experimental quantitative trading platform exploring algorithmic strategies. High-level architecture exploration covering backtesting infrastructure and data pipeline design.",
    tech: ["Python", "C#", "Data Pipelines", "Backtesting"],
  },
  {
    title: "This Portfolio",
    status: "Open Source",
    description:
      "Astronomy-themed portfolio built with Astro and React islands. Features a canvas starfield, interactive Hubble image modal, and accessible design. Demonstrates frontend craft alongside backend focus.",
    tech: [
      "Astro",
      "React",
      "TypeScript",
      "TailwindCSS",
      "Canvas API",
      "Motion",
    ],
    link: "https://github.com/ishan-caicias/ishanjain_portfolio",
  },
  {
    title: "University Game Project",
    status: "Archived",
    description:
      "Game development project completed during undergraduate studies.",
    tech: ["Unity", "C#"],
  },
];
