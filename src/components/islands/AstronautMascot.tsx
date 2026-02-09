import { useRef, useEffect, useState } from "react";

export default function AstronautMascot() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 80, y: 200 });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(motionQuery.matches);
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    motionQuery.addEventListener("change", handler);

    // Track which section is in view and drift toward it
    const sections = document.querySelectorAll("section[id]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const rect = entry.target.getBoundingClientRect();
            // Position astronaut near the top-right of the visible section
            const targetY = Math.max(100, rect.top + window.scrollY - 50);
            setPosition((prev) => ({
              x: prev.x,
              y: Math.min(targetY, window.innerHeight * 0.7),
            }));
          }
        }
      },
      { threshold: 0.3 },
    );

    sections.forEach((section) => observer.observe(section));

    return () => {
      observer.disconnect();
      motionQuery.removeEventListener("change", handler);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed right-8 z-40 lg:right-16"
      style={{
        top: `${position.y}px`,
        transition: prefersReducedMotion ? "none" : "top 2s ease-in-out",
      }}
      aria-hidden="true"
    >
      <div className={prefersReducedMotion ? "" : "animate-float"}>
        <svg
          width="64"
          height="80"
          viewBox="0 0 64 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-lg"
        >
          {/* Tether cable */}
          <path
            d="M32 75 C25 65, 15 50, 10 35"
            stroke="#5c6bc0"
            strokeWidth="1"
            strokeDasharray="3 2"
            opacity="0.4"
          />

          {/* Backpack / life support */}
          <rect
            x="22"
            y="25"
            width="20"
            height="24"
            rx="4"
            fill="#283593"
            stroke="#3f51b5"
            strokeWidth="1"
          />
          <rect x="25" y="28" width="14" height="4" rx="1" fill="#1a237e" />
          <circle cx="28" cy="35" r="1" fill="#ffd54f" opacity="0.6" />
          <circle cx="32" cy="35" r="1" fill="#2e7d32" opacity="0.6" />
          <circle cx="36" cy="35" r="1" fill="#ffd54f" opacity="0.6" />

          {/* Suit body */}
          <rect
            x="20"
            y="23"
            width="24"
            height="28"
            rx="6"
            fill="#c5cae9"
            stroke="#9fa8da"
            strokeWidth="0.5"
          />

          {/* Suit details - chest panel */}
          <rect x="26" y="30" width="12" height="8" rx="2" fill="#e8eaf6" opacity="0.5" />
          <line x1="32" y1="30" x2="32" y2="38" stroke="#9fa8da" strokeWidth="0.5" opacity="0.5" />

          {/* Helmet */}
          <ellipse
            cx="32"
            cy="16"
            rx="13"
            ry="14"
            fill="#e8eaf6"
            stroke="#9fa8da"
            strokeWidth="0.5"
          />

          {/* Visor */}
          <ellipse cx="32" cy="16" rx="10" ry="10" fill="#1a237e" />
          {/* Visor reflection */}
          <path
            d="M25 12 Q28 8, 35 10"
            stroke="#5c6bc0"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            opacity="0.6"
          />
          <path
            d="M27 15 Q30 12, 34 14"
            stroke="#7986cb"
            strokeWidth="0.8"
            fill="none"
            strokeLinecap="round"
            opacity="0.3"
          />

          {/* Visor star reflection */}
          <circle cx="36" cy="11" r="1" fill="#ffd54f" opacity="0.5" />

          {/* Arms */}
          <path
            d="M20 30 Q12 32, 10 38 Q9 42, 12 44"
            stroke="#c5cae9"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M44 30 Q52 32, 54 38 Q55 42, 52 44"
            stroke="#c5cae9"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />

          {/* Gloves */}
          <circle cx="12" cy="44" r="3" fill="#9fa8da" />
          <circle cx="52" cy="44" r="3" fill="#9fa8da" />

          {/* Legs */}
          <path
            d="M26 50 Q24 58, 22 66"
            stroke="#c5cae9"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M38 50 Q40 58, 42 66"
            stroke="#c5cae9"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />

          {/* Boots */}
          <rect x="18" y="64" width="8" height="5" rx="2" fill="#283593" />
          <rect x="38" y="64" width="8" height="5" rx="2" fill="#283593" />

          {/* Antenna */}
          <line
            x1="32"
            y1="2"
            x2="32"
            y2="6"
            stroke="#9fa8da"
            strokeWidth="1"
          />
          <circle cx="32" cy="2" r="1.5" fill="#ffd54f" opacity="0.8" />
        </svg>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          25% { transform: translateY(-8px) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(2deg); }
          75% { transform: translateY(-12px) rotate(0deg); }
        }
        .animate-float {
          animation: float 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
