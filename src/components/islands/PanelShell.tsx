import {
  useEffect,
  useRef,
  useLayoutEffect,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import type { PanelId } from "@/types";

interface PanelShellProps {
  isOpen: boolean;
  panelId: PanelId;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

export default function PanelShell({
  isOpen,
  panelId,
  title,
  subtitle,
  onClose,
  children,
}: PanelShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Store previously focused element for focus restoration
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
    }
  }, [isOpen]);

  // Focus close button when panel opens
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  // Restore focus when panel closes
  useEffect(() => {
    if (!isOpen && previousActiveElement.current) {
      previousActiveElement.current.focus();
    }
  }, [isOpen]);

  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [isOpen]);

  // Dispatch astronaut docking event with panel header coordinates
  useLayoutEffect(() => {
    if (!isOpen || !panelRef.current) return;

    const header = panelRef.current.querySelector(
      ".panel-header",
    ) as HTMLElement;
    if (!header) return;

    const rect = header.getBoundingClientRect();
    window.dispatchEvent(
      new CustomEvent("astronaut:dock", {
        detail: {
          x: rect.right - 80, // 80px from right edge
          y: rect.top + rect.height / 2, // Centered vertically
        },
      }),
    );

    // Dispatch return event on cleanup
    return () => {
      window.dispatchEvent(new CustomEvent("astronaut:return"));
    };
  }, [isOpen]);

  // Focus trap implementation
  const handleTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!panelRef.current) return;

    const focusableElements = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (e.key === "Tab") {
      if (e.shiftKey) {
        // Shift + Tab (backward)
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        // Tab (forward)
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    }
  };

  // Backdrop click handler
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Animation variants
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const panelVariants = {
    hidden: {
      x: "100%",
      opacity: 0,
    },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 200,
      },
    },
    exit: {
      x: "100%",
      opacity: 0,
      transition: {
        duration: 0.2,
      },
    },
  };

  // Reduced motion fallback
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const reducedMotionPanelVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.15 } },
    exit: { opacity: 0, transition: { duration: 0.15 } },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="panel-backdrop fixed inset-0 z-[90] bg-[rgba(10,14,39,0.8)] backdrop-blur-sm"
            onClick={handleBackdropClick}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="panel-title"
            aria-describedby={subtitle ? "panel-subtitle" : undefined}
            className="panel-shell fixed right-0 top-0 bottom-0 z-[100] w-full max-w-3xl overflow-y-auto"
            variants={
              prefersReducedMotion ? reducedMotionPanelVariants : panelVariants
            }
            initial="hidden"
            animate="visible"
            exit="exit"
            onKeyDown={handleTabKey}
          >
            {/* Header */}
            <div className="panel-header sticky top-0 z-10 flex items-center justify-between border-b border-royal-700 bg-surface-elevated px-6 py-4">
              <div>
                <h2
                  id="panel-title"
                  className="font-heading text-2xl font-bold text-text-primary"
                >
                  {title}
                </h2>
                {subtitle && (
                  <p id="panel-subtitle" className="mt-1 text-sm text-text-muted">
                    {subtitle}
                  </p>
                )}
              </div>

              {/* Close button */}
              <button
                ref={closeButtonRef}
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-royal-700/50 bg-royal-800/30 text-text-muted transition-colors hover:border-gold-400 hover:bg-royal-700/50 hover:text-gold-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated"
                aria-label="Close panel"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="panel-content px-6 py-8">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
