import { projects } from "@/content/projects";

const STATUS_COLORS = {
  "In Progress": {
    bg: "bg-pine-600/20",
    text: "text-pine-400",
    border: "border-pine-600/30",
  },
  Private: {
    bg: "bg-royal-600/20",
    text: "text-royal-400",
    border: "border-royal-600/30",
  },
  "Open Source": {
    bg: "bg-gold-600/20",
    text: "text-gold-400",
    border: "border-gold-600/30",
  },
  Archived: {
    bg: "bg-text-dim/20",
    text: "text-text-dim",
    border: "border-text-dim/30",
  },
};

export default function PanelProjects() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {projects.map((project) => {
        const statusColors = STATUS_COLORS[project.status];

        return (
          <div
            key={project.title}
            className="rounded-xl border border-royal-700/40 bg-surface-card p-6 transition-colors hover:border-royal-600/60"
          >
            {/* Header with title and status */}
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 className="font-heading text-lg font-semibold text-text-primary">
                {project.link ? (
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-gold-400 transition-colors inline-flex items-center gap-1.5"
                  >
                    {project.title}
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-label="Opens in new tab"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                ) : (
                  project.title
                )}
              </h3>
              <span
                className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}
              >
                {project.status}
              </span>
            </div>

            {/* Description */}
            <p className="text-sm leading-relaxed text-text-muted">
              {project.description}
            </p>

            {/* Tech tags */}
            <div className="mt-4 flex flex-wrap gap-2">
              {project.tech.map((tech) => (
                <span
                  key={tech}
                  className="rounded-md bg-royal-800/40 px-2 py-1 text-xs font-medium text-royal-300"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
