import type { SkillCategory } from "@/types";

export const skillCategories: SkillCategory[] = [
  {
    name: "Backend",
    skills: [
      "C# / .NET",
      "ASP.NET Core",
      "REST APIs",
      "Microservices",
      "Event-Driven Architecture",
      "Entity Framework",
    ],
  },
  {
    name: "Cloud & Platform",
    skills: [
      "AWS (RDS, S3, SQS, SNS)",
      "API Gateway",
      "Git",
      "Docker",
      "CICD",
    ],
  },
  {
    name: "Data & Messaging",
    skills: [
      "SQL",
      "PostgreSQL",
      "SQL Server",
      "Redis Caching",
      "SQS / SNS",
      "Kafka"
    ],
  },
  {
    name: "Testing & Reliability",
    skills: [
      "xUnit",
      "Integration Testing",
      "Playwright",
      "k6 / JMeter",
      "Observability (New Relic/Dynatrace)",
      "Incident Response",
    ],
  },
  {
    name: "CI/CD & Delivery",
    skills: [
      "GitHub Actions",
      "Feature Flags",
      "Safe Rollouts",
    ],
  },
  {
    name: "Architecture & Practices",
    skills: [
      "Clean Architecture",
      "SOLID",
      "DDD",
      "TDD",
      "CQRS",
      "Defensive Programming",
      "Stakeholder Collaboration",
      "Leadership and mentoring"
    ],
  },
  {
    name: "Frontend (Working Knowledge)",
    skills: [
      "React",
      "TypeScript",
      "HTML / CSS",
      "Astro"
    ],
  },
  {
    name: "AI and emerging technologies (Learning)",
    skills: [
      "AI-assisted development",
      "Prompt engineering",
      "LLM/RAG Concepts",
      "LLM APIs",
      "LLM Evaluation"
    ],
  },
];
