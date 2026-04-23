import type { Project } from "@/types";

export const projects: Project[] = [
  {
    title: "Kubera - Personal Finance Platform",
    status: "In Progress",
    description:
      "Product-minded personal finance platform with a .NET backend (Clean Architecture, DDD, CQRS) and a React/TypeScript frontend. Models goals, accounts, and projections as a proper domain, with analytics-oriented thinking and an extensible surface. Includes an AI-assisted insights layer using RAG and LLM APIs, full CI/CD, and end-to-end testing - a showcase of backend depth, product judgement, and delivery discipline.",
    tech: [
      "C#/.NET",
      "Clean Architecture",
      "DDD",
      "CQRS",
      "PostgreSQL",
      "React",
      "TypeScript",
      "RAG",
      "Docker",
      "GitHub Actions",
    ],
  },
  {
    title: "Algorithmic Trader - Market Systems R&D",
    status: "In Progress",
    description:
      "Event-driven backend for market data ingestion, streaming, and broker integration, paired with research workflows for strategy analysis. Emphasises clean service boundaries, resilient integrations, and AI-assisted analysis - built as a serious exercise in distributed, latency-sensitive system design.",
    tech: [
      "C#/.NET",
      "Python",
      "Event-Driven",
      "Streaming",
      "Broker APIs",
      "AI-Assisted Analysis",
    ],
  },
  {
    title: "This Portfolio",
    status: "Open Source",
    description:
      "Astronomy-themed portfolio built with Astro and React islands. Accessible and responsive design - a small showcase of frontend craft alongside the core backend focus.",
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
    title: "University Game Project - 2018",
    status: "Archived",
    description:
      "A 2D OOP puzzle game (“Dungeon Master”) applying design patterns, version control, agile practices, and TDD; collaborated via pair programming.",
    tech: ["Java", "JavaFX"],
  },
];
