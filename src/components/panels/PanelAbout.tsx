import { achievements } from "@/content/achievements";

const credibilityItems = [
  {
    title: ".NET Microservices",
    description:
      "Event-driven services processing real-time financial decisions at scale.",
  },
  {
    title: "AWS Cloud Infrastructure",
    description:
      "Production workloads on ECS, SQS, S3, and CloudWatch with operational excellence.",
  },
  {
    title: "PostgreSQL & Data",
    description:
      "Complex query optimization, safe migrations, and data integrity guarantees.",
  },
  {
    title: "Production Ownership",
    description:
      "On-call responsibility, incident response, and deployment pipeline stewardship.",
  },
  {
    title: "Testing & Observability",
    description:
      "Comprehensive test suites, structured logging, metrics, and alerting.",
  },
  {
    title: "CI/CD Pipelines",
    description:
      "Automated build, test, and deploy workflows across microservices.",
  },
];

const iconMap: Record<string, string> = {
  sms: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  shield:
    "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  cases:
    "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
  upgrade:
    "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  brain:
    "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  test: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
};

export default function PanelAbout() {
  return (
    <div className="space-y-12">
      {/* What I Do Section */}
      <div>
        <h3 className="mb-2 font-heading text-2xl font-bold text-text-primary">
          What I Do
        </h3>
        <p className="mb-6 text-sm text-text-muted">
          Core engineering competencies built through production experience
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          {credibilityItems.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-royal-700/40 bg-surface-card p-5 transition-colors hover:border-royal-600/60"
            >
              <h4 className="font-heading text-lg font-semibold text-gold-400">
                {item.title}
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Achievements Section */}
      <div>
        <h3 className="mb-2 font-heading text-2xl font-bold text-text-primary">
          Selected Achievements
        </h3>
        <p className="mb-6 text-sm text-text-muted">
          Outcomes delivered in production
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          {achievements.map((achievement) => (
            <div
              key={achievement.title}
              className="rounded-xl border border-royal-700/40 bg-surface-card p-5 transition-colors hover:border-royal-600/60"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-royal-700/50">
                <svg
                  className="h-5 w-5 text-gold-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={iconMap[achievement.icon] || iconMap.shield}
                  />
                </svg>
              </div>
              <h4 className="font-heading text-lg font-semibold text-text-primary">
                {achievement.title}
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">
                {achievement.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
