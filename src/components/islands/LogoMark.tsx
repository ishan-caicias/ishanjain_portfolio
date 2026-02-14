import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

// Layout constants (adjust here for visual tuning)
const HAT_Y = -4;
const HAT_X = 6;
const BRACKET_X = 10;
const LETTER_GAP = 6;

const springTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 28,
};

export default function LogoMark() {
  const [isActive, setIsActive] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleFocus = () => {
    const visible =
      linkRef.current?.matches(":focus-visible") ?? false;
    setIsActive(visible);
  };

  const handleBlur = () => setIsActive(false);

  const hatIVariants = {
    rest: {
      opacity: 1,
      scale: 1,
      translateX: 0,
      transition: springTransition,
    },
    active: prefersReducedMotion
      ? { opacity: 1, scale: 1, translateX: 0, transition: { duration: 0 } }
      : {
          opacity: 0,
          scale: 0.5,
          translateX: -HAT_X,
          transition: springTransition,
        },
  };

  const hatJVariants = {
    rest: {
      opacity: 1,
      scale: 1,
      translateX: 0,
      transition: springTransition,
    },
    active: prefersReducedMotion
      ? { opacity: 1, scale: 1, translateX: 0, transition: { duration: 0 } }
      : {
          opacity: 0,
          scale: 0.5,
          translateX: HAT_X,
          transition: springTransition,
        },
  };

  const bracketOpenVariants = {
    rest: {
      opacity: 0,
      translateX: -BRACKET_X,
      transition: springTransition,
    },
    active: {
      opacity: 1,
      translateX: 0,
      transition: springTransition,
    },
  };

  const bracketCloseVariants = {
    rest: {
      opacity: 0,
      translateX: BRACKET_X,
      transition: springTransition,
    },
    active: {
      opacity: 1,
      translateX: 0,
      transition: springTransition,
    },
  };

  return (
    <div
      className="logo-mark-wrapper inline-flex min-h-[44px] min-w-[44px] items-center justify-center"
      data-state={isActive ? "active" : "rest"}
      style={{ minWidth: 44, minHeight: 44 }}
    >
      <a
        ref={linkRef}
        href="/"
        aria-label="Home"
        className="font-heading text-2xl font-bold text-gold-400 outline-none transition-colors hover:text-gold-300 focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        style={{ fontSize: "1.35rem" }}
        onMouseEnter={() => setIsActive(true)}
        onMouseLeave={() => setIsActive(false)}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <span className="relative inline-flex items-baseline">
          {/* Opening bracket */}
          <motion.span
            className="pointer-events-none select-none text-royal-300"
            aria-hidden
            variants={bracketOpenVariants}
            initial="rest"
            animate={isActive ? "active" : "rest"}
          >
            &lt;
          </motion.span>

          {/* Letters with hats */}
          <span
            className="inline-flex items-baseline"
            style={{
              gap: isActive ? LETTER_GAP : 0,
              transition: prefersReducedMotion ? "none" : "gap 0.25s ease-out",
            }}
          >
            <span className="relative inline-block">
              <motion.span
                data-testid="hat-i"
                className="absolute left-1/2 block -translate-x-1/2 text-gold-400"
                style={{
                  top: HAT_Y,
                  left: "50%",
                  lineHeight: 0,
                  fontSize: "1em",
                }}
                variants={hatIVariants}
                initial="rest"
                animate={isActive ? "active" : "rest"}
              >
                ̂
              </motion.span>
              <span aria-hidden>i</span>
            </span>
            <span className="relative inline-block">
              <motion.span
                data-testid="hat-j"
                className="absolute left-1/2 block -translate-x-1/2 text-gold-400"
                style={{
                  top: HAT_Y,
                  left: "50%",
                  lineHeight: 0,
                  fontSize: "1em",
                }}
                variants={hatJVariants}
                initial="rest"
                animate={isActive ? "active" : "rest"}
              >
                ̂
              </motion.span>
              <span aria-hidden>j</span>
            </span>
          </span>

          {/* Closing bracket */}
          <motion.span
            className="pointer-events-none select-none text-royal-300"
            aria-hidden
            variants={bracketCloseVariants}
            initial="rest"
            animate={isActive ? "active" : "rest"}
          >
            &gt;
          </motion.span>
        </span>
      </a>
    </div>
  );
}
