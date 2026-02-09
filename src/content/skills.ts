import type { SkillCategory } from "@/types";

export const skillCategories: SkillCategory[] = [
  {
    name: "Backend",
    skills: [
      "C#/.NET",
      "ASP.NET Core",
      "Entity Framework",
      "Microservices",
      "Event-Driven Architecture",
      "REST APIs",
    ],
  },
  {
    name: "Cloud & Infrastructure",
    skills: ["AWS (ECS, SQS, SNS, S3, CloudWatch)", "Docker", "Terraform"],
  },
  {
    name: "Data",
    skills: ["PostgreSQL", "SQL Server", "Redis"],
  },
  {
    name: "Testing & Quality",
    skills: ["xUnit", "Playwright", "Vitest", "TDD", "Integration Testing"],
  },
  {
    name: "CI/CD & DevOps",
    skills: [
      "GitHub Actions",
      "Azure DevOps",
      "Feature Flags",
      "Infrastructure as Code",
    ],
  },
  {
    name: "Frontend",
    skills: ["React", "TypeScript", "HTML/CSS", "Astro"],
  },
  {
    name: "AI/ML (Exploring)",
    skills: [
      "RAG Patterns",
      "Embeddings",
      "Prompt Engineering",
      "LLM Evaluation",
    ],
  },
  {
    name: "Practices",
    skills: [
      "Clean Architecture",
      "DDD",
      "SOLID",
      "Observability",
      "Incident Response",
    ],
  },
];
