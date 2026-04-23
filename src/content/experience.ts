import type { Experience } from "@/types";

export const experiences: Experience[] = [
  {
    role: "Software Engineer",
    company: "Zip Co",
    period: "2021 – Present",
    location: "Sydney, AU",
    bullets: [
      "Design and operate C#/.NET microservices on AWS underpinning real-time fraud, risk, and payment decisioning for customer-facing products",
      "Delivered a full-traffic cutover for payment fraud checks with zero disruption, reaching 100% coverage across transaction channels",
      "Shipped an end-to-end two-way SMS verification flow for real-time fraud decisioning on live payment transactions, from API design to production rollout",
      "Built a Fraud Case Management platform with a 360° case view, automating triage traffic to vendor decisioning and reducing manual operations load",
      "Supported the launch of a new consumer payments product (Zip Plus) with fraud controls and safe rollout via feature flags and staged traffic",
      "Upgraded five production-critical services from .NET 6 to .NET 8 with strong test coverage and zero customer-visible regressions",
      "Drove performance and database fixes that cut API latency and reduced on-call noise across event-driven services",
      "Led observability migration to Dynatrace and standardised structured logging, tracing, and alerting across the platform",
      "Migrated feature flags from Optimizely to Amplitude, and moved public APIs onto an API Gateway + Cognito + OpenAPI foundation",
      "Integrated vendor risk and identity signals (BioCatch, OCR Labs, Intuition, Ethoca) behind clean service boundaries",
      "Built performance and load test coverage using k6 and JMeter to validate resilience ahead of major launches",
      "Own initiatives end-to-end - design, implementation, CI/CD, testing, on-call, and stakeholder enablement - and mentor a fellow engineer",
    ],
  },
];
