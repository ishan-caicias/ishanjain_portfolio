import type { Achievement } from "@/types";

export const achievements: Achievement[] = [
  {
    title: "Real-Time SMS Verification",
    description:
      "Designed and delivered end-to-end two-way SMS verification flow for high-risk transaction activity, from API integration to production rollout.",
    icon: "sms",
  },
  {
    title: "Full-Traffic Risk Monitoring",
    description:
      "Executed full-traffic cutovers across payment and customer lifecycle monitoring, achieving 100% transaction coverage with zero incidents.",
    icon: "shield",
  },
  {
    title: "Automated Case Management",
    description:
      "Built automated case management system providing operations teams a 360-degree view of flagged activity, integrating signals from multiple risk sources.",
    icon: "cases",
  },
  {
    title: "Platform Modernisation",
    description:
      "Led .NET framework upgrades and security remediation across microservices, implementing feature flags and defensive programming for safe rollout.",
    icon: "upgrade",
  },
  {
    title: "Auto-Decisioning Discovery",
    description:
      "Drove discovery and design for auto-decisioning improvements via bank-statement classification, taking design ownership from problem framing to solution proposal.",
    icon: "brain",
  },
  {
    title: "E2E Test Infrastructure",
    description:
      "Established Playwright test suites integrated into CI/CD pipelines, improving deployment confidence across microservice boundaries.",
    icon: "test",
  },
];
