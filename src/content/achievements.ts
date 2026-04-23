import type { Achievement } from "@/types";

export const achievements: Achievement[] = [
  {
    title: "Zero-Disruption Traffic Cutover",
    description:
      "Executed full-traffic cutovers across mission-critical event pipelines, achieving 100% coverage with zero incidents.",
    icon: "shield",
  },
  {
    title: "Real-Time SMS Verification",
    description:
      "Designed and shipped an end-to-end two-way SMS verification flow for real-time fraud decisioning on live payment transactions - from design through production rollout.",
    icon: "sms",
  },
  {
    title: "Automated Case Management",
    description:
      "Built a Fraud Case Management platform with a 360° case view and automated routing to vendor decisioning, cutting manual triage load for operations.",
    icon: "cases",
  },
  {
    title: "Platform Modernisation",
    description:
      "Led framework upgrades and security remediation across multiple microservices, utilizing feature flags and defensive programming patterns for safe, incremental rollouts.",
    icon: "upgrade",
  },
  {
    title: "Performance & Reliability",
    description:
      "Improved system performance and reduced on-call noise through targeted database and api-level fixes, and matured load testing with k6 and JMeter ahead of major launches.",
    icon: "brain",
  },
  {
    title: "E2E Test Infrastructure",
    description:
      "Built and Implemented Playwright end-to-end test suites wired into CI/CD across microservices, raising deployment confidence across service boundaries.",
    icon: "test",
  },
];
