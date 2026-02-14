import { skillCategories } from "@/content/skills";

export default function PanelSkills() {
  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {skillCategories.map((category) => (
        <div key={category.name}>
          <h3 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-gold-400">
            {category.name}
          </h3>
          <ul className="space-y-1.5" role="list">
            {category.skills.map((skill) => (
              <li
                key={skill}
                className="flex items-center gap-2 text-sm text-text-muted"
              >
                <span
                  className="h-1 w-1 shrink-0 rounded-full bg-royal-400"
                  aria-hidden="true"
                />
                {skill}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
