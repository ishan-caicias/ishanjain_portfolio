import type { Experience } from "@/types";

export const experiences: Experience[] = [
  {
    role: "Software Engineer",
    company: "Fintech Risk Platform",
    period: "2022 – Present",
    location: "Sydney, AU",
    bullets: [
      "Engineer real-time fraud decisioning services processing transactions across payment and customer lifecycle events",
      "Build and maintain .NET microservices communicating via event-driven architecture (SQS/SNS) with PostgreSQL persistence",
      "Deliver full-traffic cutovers for risk monitoring with zero downtime, achieving 100% transaction coverage",
      "Integrate with external fraud platforms and third-party risk vendors for enriched decisioning signals",
      "Lead platform modernisation: .NET version upgrades, security remediation, feature flag rollouts, and defensive programming patterns",
      "Establish Playwright end-to-end test suites integrated into CI/CD pipelines across multiple microservices",
    ],
  },
];
