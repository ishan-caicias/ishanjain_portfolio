import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { RoverState } from "@/types";

// Configuration constants - adjust these to tweak animation timing
const TRAVEL_DURATION = 3000; // ms to travel to center
const DEPLOY_ANIMATION = 500; // ms for flag deployment
const HOLD_DURATION = 8000; // ms to display before reset
const RESET_DURATION = 500; // ms fade out duration
const ROVER_START_X = -50; // starting position (offscreen left)
const ROVER_END_X = 720; // ending position (center of 1440 viewBox)

interface RoverAnimationProps {
  onDeployComplete?: () => void;
}

export default function RoverAnimation({
  onDeployComplete,
}: RoverAnimationProps) {
  const [roverState, setRoverState] = useState<RoverState>("idle");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  // Detect reduced motion preference
  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(motionQuery.matches);

    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    motionQuery.addEventListener("change", handler);

    return () => motionQuery.removeEventListener("change", handler);
  }, []);

  // Listen for deploy event
  useEffect(() => {
    const handleDeploy = () => {
      if (roverState === "idle") {
        setRoverState("traveling");
      }
    };

    window.addEventListener("rover:deploy", handleDeploy);

    return () => {
      window.removeEventListener("rover:deploy", handleDeploy);
    };
  }, [roverState]);

  // State machine for animation sequence
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (roverState === "traveling") {
      // After travel, deploy flag
      timeoutRef.current = window.setTimeout(() => {
        setRoverState("deployed");
      }, TRAVEL_DURATION);
    } else if (roverState === "deployed") {
      // After hold duration, reset
      timeoutRef.current = window.setTimeout(() => {
        setRoverState("resetting");
      }, HOLD_DURATION);

      // Call optional callback
      if (onDeployComplete) {
        onDeployComplete();
      }
    } else if (roverState === "resetting") {
      // After reset, return to idle
      timeoutRef.current = window.setTimeout(() => {
        setRoverState("idle");
      }, RESET_DURATION);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [roverState, onDeployComplete]);

  // Click to reset
  const handleClick = () => {
    if (roverState !== "idle") {
      setRoverState("resetting");
    }
  };

  // Don't render if idle
  if (roverState === "idle") {
    return null;
  }

  // Animation variants
  const roverVariants = {
    traveling: {
      x: prefersReducedMotion ? ROVER_END_X : [ROVER_START_X, ROVER_END_X],
      opacity: 1,
      transition: {
        x: {
          duration: prefersReducedMotion ? 0 : TRAVEL_DURATION / 1000,
          ease: "easeInOut",
        },
        opacity: {
          duration: 0.3,
        },
      },
    },
    deployed: {
      x: ROVER_END_X,
      opacity: 1,
    },
    resetting: {
      opacity: 0,
      transition: {
        duration: RESET_DURATION / 1000,
      },
    },
  };

  const flagVariants = {
    hidden: {
      scaleY: 0,
      scaleX: 0,
      opacity: 0,
    },
    visible: {
      scaleY: 1,
      scaleX: 1,
      opacity: 1,
      transition: {
        scaleY: {
          duration: DEPLOY_ANIMATION / 1000,
          ease: "easeOut",
        },
        scaleX: {
          duration: DEPLOY_ANIMATION / 1000,
          delay: DEPLOY_ANIMATION / 2000,
          ease: "easeOut",
        },
        opacity: {
          duration: 0.2,
          delay: DEPLOY_ANIMATION / 1000,
        },
      },
    },
  };

  return (
    <AnimatePresence>
      <div
        className="pointer-events-auto absolute bottom-4 left-0 w-full"
        style={{ zIndex: 5 }}
      >
        <svg
          viewBox="0 0 1440 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
          style={{ overflow: "visible" }}
        >
          <motion.g
            variants={roverVariants}
            animate={roverState}
            onClick={handleClick}
            className="cursor-pointer"
            role="img"
            aria-label="Exploration rover"
          >
            {/* Rover body */}
            <rect
              x="-15"
              y="20"
              width="30"
              height="15"
              rx="3"
              fill="#5c6bc0"
              stroke="#3f51b5"
              strokeWidth="0.5"
            />

            {/* Wheels */}
            <circle cx="-8" cy="36" r="4" fill="#283593" stroke="#1a237e" strokeWidth="0.5" />
            <circle cx="8" cy="36" r="4" fill="#283593" stroke="#1a237e" strokeWidth="0.5" />

            {/* Wheel details (spokes) */}
            <line x1="-8" y1="34" x2="-8" y2="38" stroke="#1a237e" strokeWidth="0.5" />
            <line x1="8" y1="34" x2="8" y2="38" stroke="#1a237e" strokeWidth="0.5" />

            {/* Solar panels */}
            <rect
              x="-12"
              y="15"
              width="24"
              height="5"
              rx="1"
              fill="#ffd54f"
              opacity="0.9"
              stroke="#ffc107"
              strokeWidth="0.3"
            />

            {/* Camera/sensor */}
            <circle cx="12" cy="22" r="2" fill="#ffc107" opacity="0.9" />
            <circle cx="12" cy="22" r="1" fill="#1a237e" opacity="0.5" />

            {/* Antenna */}
            <line
              x1="0"
              y1="15"
              x2="0"
              y2="10"
              stroke="#5c6bc0"
              strokeWidth="0.8"
            />
            <circle cx="0" cy="9" r="1.5" fill="#ffd54f" opacity="0.8" />

            {/* Flag (only visible when deployed) */}
            {roverState === "deployed" && (
              <motion.g
                variants={flagVariants}
                initial="hidden"
                animate="visible"
                style={{ transformOrigin: "18px 36px" }}
              >
                {/* Flag pole */}
                <line
                  x1="18"
                  y1="36"
                  x2="18"
                  y2="8"
                  stroke="#ffd54f"
                  strokeWidth="1.2"
                />

                {/* Flag */}
                <rect
                  x="18"
                  y="8"
                  width="14"
                  height="9"
                  fill="#e8eaf6"
                  stroke="#ffd54f"
                  strokeWidth="0.5"
                  rx="0.5"
                />

                {/* Flag text "Thanks!" */}
                <text
                  x="25"
                  y="14"
                  fontSize="4"
                  fill="#1a237e"
                  fontWeight="600"
                  textAnchor="middle"
                  fontFamily="Arial, sans-serif"
                >
                  Thanks!
                </text>
              </motion.g>
            )}
          </motion.g>
        </svg>
      </div>
    </AnimatePresence>
  );
}
