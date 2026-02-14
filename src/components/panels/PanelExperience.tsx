import { experiences } from "@/content/experience";

export default function PanelExperience() {
  return (
    <div>
      {experiences.map((exp, index) => (
        <div
          key={`${exp.company}-${exp.role}`}
          className={`relative pl-8 ${index < experiences.length - 1 ? "pb-12" : ""}`}
        >
          {/* Timeline line */}
          <div
            className="absolute top-2 left-0 h-full w-px bg-gradient-to-b from-royal-500 to-royal-800"
            aria-hidden="true"
          />

          {/* Timeline dot */}
          <div
            className="absolute top-2 -left-1.5 h-3 w-3 rounded-full border-2 border-gold-500 bg-surface"
            aria-hidden="true"
          />

          {/* Content */}
          <div>
            <h3 className="font-heading text-xl font-bold text-text-primary">
              {exp.role}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-muted">
              <span className="text-gold-400">{exp.company}</span>
              <span aria-hidden="true">&middot;</span>
              <span>{exp.period}</span>
              <span aria-hidden="true">&middot;</span>
              <span>{exp.location}</span>
            </div>
            <ul className="mt-4 space-y-2" role="list">
              {exp.bullets.map((bullet) => (
                <li
                  key={bullet.slice(0, 30)}
                  className="flex gap-3 text-sm leading-relaxed text-text-muted"
                >
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-royal-400"
                    aria-hidden="true"
                  />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
