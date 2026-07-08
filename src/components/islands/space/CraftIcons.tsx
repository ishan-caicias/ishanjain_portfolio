import type { Station } from "./types";

/**
 * The 6 nav-station craft SVG icons (satellite/voyager/comet/station/debris/dish/moon).
 * Ported verbatim from Space Portfolio.dc.html lines 71-173.
 */
export default function CraftIcon({ craft }: { craft: Station["craft"] }) {
  switch (craft) {
    case "sat":
      return (
        <svg
          width="48"
          height="48"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <line
            x1="14"
            y1="32"
            x2="24"
            y2="32"
            stroke="#c5cae9"
            strokeWidth="1.4"
          />
          <line
            x1="40"
            y1="32"
            x2="50"
            y2="32"
            stroke="#c5cae9"
            strokeWidth="1.4"
          />
          <rect
            x="2"
            y="25"
            width="12"
            height="14"
            rx="1.5"
            fill="rgba(48,63,159,0.45)"
            stroke="#c5cae9"
            strokeWidth="1.4"
          />
          <rect
            x="50"
            y="25"
            width="12"
            height="14"
            rx="1.5"
            fill="rgba(48,63,159,0.45)"
            stroke="#c5cae9"
            strokeWidth="1.4"
          />
          <line
            x1="8"
            y1="25"
            x2="8"
            y2="39"
            stroke="#9fa8da"
            strokeWidth="0.8"
            opacity="0.7"
          />
          <line
            x1="56"
            y1="25"
            x2="56"
            y2="39"
            stroke="#9fa8da"
            strokeWidth="0.8"
            opacity="0.7"
          />
          <rect
            x="24"
            y="24"
            width="16"
            height="16"
            rx="3"
            fill="#182052"
            stroke="#c5cae9"
            strokeWidth="1.4"
          />
          <circle
            cx="32"
            cy="32"
            r="3.5"
            fill="none"
            stroke="#ffd54f"
            strokeWidth="1.2"
          />
          <circle cx="32" cy="32" r="1.2" fill="#ffd54f" />
          <path
            d="M26 24 Q32 16 38 24"
            stroke="#80deea"
            strokeWidth="1.2"
            fill="none"
            opacity="0.9"
          />
          <line
            x1="32"
            y1="40"
            x2="32"
            y2="47"
            stroke="#c5cae9"
            strokeWidth="1.2"
          />
          <circle cx="32" cy="48.5" r="1.5" fill="#80deea" />
        </svg>
      );
    case "voyager":
      return (
        <svg
          width="48"
          height="48"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <ellipse
            cx="32"
            cy="24"
            rx="15"
            ry="9.5"
            fill="rgba(27,33,80,0.65)"
            stroke="#c5cae9"
            strokeWidth="1.4"
          />
          <ellipse
            cx="32"
            cy="24"
            rx="6"
            ry="3.6"
            fill="#182052"
            stroke="#9fa8da"
            strokeWidth="0.8"
          />
          <line
            x1="32"
            y1="24"
            x2="32"
            y2="14"
            stroke="#c5cae9"
            strokeWidth="1.2"
          />
          <circle cx="32" cy="13" r="1.8" fill="#ffd54f" />
          <rect
            x="26"
            y="33"
            width="12"
            height="9"
            rx="2"
            fill="#182052"
            stroke="#c5cae9"
            strokeWidth="1.4"
          />
          <circle cx="32" cy="37.5" r="1.2" fill="#80deea" />
          <line
            x1="38"
            y1="39"
            x2="56"
            y2="46"
            stroke="#c5cae9"
            strokeWidth="1.2"
          />
          <rect
            x="54"
            y="44"
            width="6"
            height="5"
            rx="1"
            fill="rgba(48,63,159,0.45)"
            stroke="#c5cae9"
            strokeWidth="1.2"
          />
          <line
            x1="26"
            y1="39"
            x2="9"
            y2="44"
            stroke="#c5cae9"
            strokeWidth="1.2"
          />
          <line
            x1="12"
            y1="41"
            x2="12"
            y2="47"
            stroke="#9fa8da"
            strokeWidth="1"
          />
          <line
            x1="16"
            y1="40.5"
            x2="16"
            y2="46.5"
            stroke="#9fa8da"
            strokeWidth="1"
          />
        </svg>
      );
    case "comet":
      return (
        <svg
          width="48"
          height="48"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="ij-ctail" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor="#80deea" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#80deea" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M42 32 L4 24 L28 32 L6 39 Z" fill="url(#ij-ctail)" />
          <circle
            cx="43"
            cy="32"
            r="6.5"
            fill="#e8f7fa"
            stroke="#c5cae9"
            strokeWidth="1.4"
          />
          <circle
            cx="43"
            cy="32"
            r="10"
            fill="none"
            stroke="#80deea"
            strokeWidth="1"
            opacity="0.55"
          />
          <circle cx="20" cy="27" r="1.2" fill="#80deea" opacity="0.8" />
          <circle cx="14" cy="35" r="1" fill="#80deea" opacity="0.6" />
        </svg>
      );
    case "station":
      return (
        <svg
          width="48"
          height="48"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <line
            x1="6"
            y1="32"
            x2="58"
            y2="32"
            stroke="#c5cae9"
            strokeWidth="1.4"
          />
          <rect
            x="4"
            y="22"
            width="10"
            height="20"
            rx="1.5"
            fill="rgba(48,63,159,0.45)"
            stroke="#c5cae9"
            strokeWidth="1.4"
          />
          <rect
            x="50"
            y="22"
            width="10"
            height="20"
            rx="1.5"
            fill="rgba(48,63,159,0.45)"
            stroke="#c5cae9"
            strokeWidth="1.4"
          />
          <line
            x1="9"
            y1="22"
            x2="9"
            y2="42"
            stroke="#9fa8da"
            strokeWidth="0.8"
            opacity="0.7"
          />
          <line
            x1="55"
            y1="22"
            x2="55"
            y2="42"
            stroke="#9fa8da"
            strokeWidth="0.8"
            opacity="0.7"
          />
          <rect
            x="25"
            y="20"
            width="14"
            height="24"
            rx="4"
            fill="#182052"
            stroke="#c5cae9"
            strokeWidth="1.4"
          />
          <circle cx="32" cy="28" r="2" fill="#ffd54f" opacity="0.9" />
          <rect
            x="28.5"
            y="35"
            width="7"
            height="4"
            rx="1"
            fill="rgba(128,222,234,0.35)"
            stroke="#80deea"
            strokeWidth="0.8"
          />
          <line
            x1="32"
            y1="20"
            x2="32"
            y2="12"
            stroke="#c5cae9"
            strokeWidth="1.2"
          />
          <circle cx="32" cy="10.5" r="1.5" fill="#80deea" />
        </svg>
      );
    case "debris":
      return (
        <svg
          width="48"
          height="48"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g transform="rotate(-14 32 34)">
            <rect
              x="18"
              y="27"
              width="24"
              height="15"
              rx="2.5"
              fill="#182052"
              stroke="#c5cae9"
              strokeWidth="1.4"
            />
            <path
              d="M18 31 L42 31"
              stroke="#9fa8da"
              strokeWidth="0.8"
              opacity="0.7"
            />
            <path
              d="M16 27 L44 27 L41 21 L19 21 Z"
              fill="rgba(48,63,159,0.45)"
              stroke="#c5cae9"
              strokeWidth="1.2"
            />
            <circle cx="30" cy="36" r="1.2" fill="#ffd54f" />
          </g>
          <circle
            cx="49"
            cy="19"
            r="4.5"
            fill="none"
            stroke="#c5cae9"
            strokeWidth="1.4"
          />
          <circle
            cx="49"
            cy="19"
            r="1.4"
            fill="#182052"
            stroke="#c5cae9"
            strokeWidth="1"
          />
          <path
            d="M49 13.4 L49 15.2 M49 22.8 L49 24.6 M43.4 19 L45.2 19 M52.8 19 L54.6 19"
            stroke="#c5cae9"
            strokeWidth="1.4"
          />
          <line
            x1="10"
            y1="18"
            x2="17"
            y2="12"
            stroke="#c5cae9"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M8 20 A3.2 3.2 0 1 1 12 16"
            stroke="#c5cae9"
            strokeWidth="1.4"
            fill="none"
          />
          <circle cx="14" cy="48" r="1.2" fill="#9fa8da" opacity="0.8" />
          <circle cx="52" cy="44" r="1" fill="#c5cae9" opacity="0.6" />
        </svg>
      );
    case "dish":
      return (
        <svg
          width="48"
          height="48"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M14 24 Q32 6 50 24 Q32 34 14 24 Z"
            fill="rgba(27,33,80,0.65)"
            stroke="#c5cae9"
            strokeWidth="1.4"
          />
          <line
            x1="32"
            y1="21"
            x2="32"
            y2="12"
            stroke="#ffd54f"
            strokeWidth="1.2"
          />
          <circle cx="32" cy="10.5" r="1.8" fill="#ffd54f" />
          <path
            d="M38 8 Q41 10.5 38 13"
            stroke="#ffd54f"
            strokeWidth="1"
            fill="none"
            opacity="0.8"
          />
          <path
            d="M41 5.5 Q45.5 10.5 41 15.5"
            stroke="#ffd54f"
            strokeWidth="1"
            fill="none"
            opacity="0.5"
          />
          <line
            x1="32"
            y1="28"
            x2="32"
            y2="42"
            stroke="#c5cae9"
            strokeWidth="1.4"
          />
          <line
            x1="32"
            y1="42"
            x2="22"
            y2="52"
            stroke="#c5cae9"
            strokeWidth="1.4"
          />
          <line
            x1="32"
            y1="42"
            x2="42"
            y2="52"
            stroke="#c5cae9"
            strokeWidth="1.4"
          />
          <line
            x1="26"
            y1="49"
            x2="38"
            y2="49"
            stroke="#9fa8da"
            strokeWidth="1"
            opacity="0.7"
          />
        </svg>
      );
    case "moon":
      return (
        <svg
          width="48"
          height="48"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="32"
            cy="34"
            r="15"
            fill="#252a44"
            stroke="#c5cae9"
            strokeWidth="1.4"
          />
          <circle
            cx="26"
            cy="29"
            r="3.4"
            fill="#1a1e33"
            stroke="#9fa8da"
            strokeWidth="0.6"
            opacity="0.9"
          />
          <circle
            cx="37"
            cy="39"
            r="2.6"
            fill="#1a1e33"
            stroke="#9fa8da"
            strokeWidth="0.6"
            opacity="0.8"
          />
          <circle cx="37" cy="27" r="1.7" fill="#1a1e33" opacity="0.8" />
          <path
            d="M24 45 Q28 41 34 43 L34 46 Q28 47 24 45 Z"
            fill="#182052"
            stroke="#80deea"
            strokeWidth="0.9"
          />
          <circle cx="29" cy="44" r="0.9" fill="#ffd54f" />
          <line
            x1="40"
            y1="24"
            x2="40"
            y2="16"
            stroke="#c5cae9"
            strokeWidth="1.1"
          />
          <path d="M40 16 L46 17.5 L40 20 Z" fill="#ffd54f" />
          <circle
            cx="32"
            cy="34"
            r="18.5"
            fill="none"
            stroke="#ffd54f"
            strokeWidth="0.7"
            opacity="0.35"
          />
        </svg>
      );
    default:
      return null;
  }
}
