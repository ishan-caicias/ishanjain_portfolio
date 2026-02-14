import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { HubbleEntry } from "@/types";
import type { StarClickEvent, NasaSearchResult } from "@/types/nasa";
import { searchNasaImages } from "@/utils/nasa";
import { getTargetById } from "@/content/nasaTargets";

export default function StarModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [entry, setEntry] = useState<HubbleEntry | null>(null);
  const [hubbleData, setHubbleData] = useState<HubbleEntry[]>([]);
  const [imageError, setImageError] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // NASA-specific state
  const [isNasaMode, setIsNasaMode] = useState(false);
  const [nasaResults, setNasaResults] = useState<NasaSearchResult[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [targetLabel, setTargetLabel] = useState("");
  const [targetCaption, setTargetCaption] = useState("");

  // Load Hubble data on mount
  useEffect(() => {
    fetch("/hubble/data.json")
      .then((res) => res.json())
      .then((data: HubbleEntry[]) => setHubbleData(data))
      .catch(() => {
        setHubbleData([
          {
            id: "fallback",
            title: "A Distant Nebula",
            date: "2024-01-01",
            description:
              "Somewhere in the cosmos, a cloud of gas and dust glows with the light of newborn stars.",
            imagePath: "",
            credit: "The Universe",
            sourceUrl: "",
          },
        ]);
      });
  }, []);

  // Listen for star click events
  useEffect(() => {
    const handleStarClick = async (e: Event) => {
      const customEvent = e as CustomEvent<StarClickEvent>;
      const { targetId, isLegacy, hubbleIndex } = customEvent.detail;

      previousFocusRef.current = document.activeElement as HTMLElement;

      // Legacy Hubble mode
      if (isLegacy && hubbleIndex !== undefined && hubbleData[hubbleIndex]) {
        setIsNasaMode(false);
        setEntry(hubbleData[hubbleIndex]);
        setImageError(false);
        setIsOpen(true);
        return;
      }

      // NASA mode
      if (!isLegacy && targetId) {
        const target = getTargetById(targetId);
        if (!target) {
          console.error(`[StarModal] Target not found: ${targetId}`);
          return;
        }

        setIsNasaMode(true);
        setTargetLabel(target.label);
        setTargetCaption(target.caption);
        setIsLoading(true);
        setIsOpen(true);
        setSelectedImageIndex(0);

        try {
          const results = await searchNasaImages(
            targetId,
            target.searchTerms,
            3,
          );

          if (results.length > 0) {
            setNasaResults(results);
            setImageError(false);
          } else {
            // Fallback to Hubble keyword match
            const keyword = targetId.split("-")[0];
            const hubbleMatch = hubbleData.find((h) =>
              h.title.toLowerCase().includes(keyword),
            );

            if (hubbleMatch) {
              console.log(
                `[StarModal] NASA API returned no results, falling back to Hubble match: ${hubbleMatch.title}`,
              );
              setIsNasaMode(false);
              setEntry(hubbleMatch);
              setImageError(false);
            } else {
              // No fallback available, show error
              console.warn(
                `[StarModal] No results from NASA API or Hubble fallback for ${targetId}`,
              );
              setNasaResults([]);
              setImageError(true);
            }
          }
        } catch (error) {
          console.error(`[StarModal] Error fetching NASA images:`, error);
          setImageError(true);
        } finally {
          setIsLoading(false);
        }
      }
    };

    window.addEventListener("starclick", handleStarClick);
    return () => window.removeEventListener("starclick", handleStarClick);
  }, [hubbleData]);

  // Focus trap and escape key
  useEffect(() => {
    if (!isOpen) return;

    // Focus close button when modal opens
    setTimeout(() => closeButtonRef.current?.focus(), 100);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
      }
      // Simple focus trap: Tab cycles within modal
      if (e.key === "Tab") {
        const modal = document.getElementById("star-modal");
        if (!modal) return;
        const focusable = modal.querySelectorAll<HTMLElement>(
          'button, a[href], [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    // Prevent body scroll
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    // Restore focus to the previously focused element
    setTimeout(() => previousFocusRef.current?.focus(), 100);
  }, []);

  // Determine modal content based on mode
  const hasContent = isNasaMode ? nasaResults.length > 0 || isLoading : entry !== null;
  const currentImage = isNasaMode && nasaResults.length > 0
    ? nasaResults[selectedImageIndex]
    : null;
  const displayTitle = isNasaMode ? targetLabel : entry?.title || "";
  const displayCaption = isNasaMode ? targetCaption : entry?.date || "";
  const displayDescription = isNasaMode
    ? currentImage?.description || ""
    : entry?.description || "";

  return (
    <AnimatePresence>
      {isOpen && hasContent && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-surface/80 backdrop-blur-sm"
            onClick={closeModal}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            id="star-modal"
            role="dialog"
            aria-modal="true"
            aria-label={isNasaMode ? `NASA image: ${displayTitle}` : `Hubble image: ${displayTitle}`}
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-royal-700/50 bg-surface-elevated shadow-2xl"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {/* Close button */}
            <button
              ref={closeButtonRef}
              onClick={closeModal}
              className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-surface/80 text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
              aria-label="Close modal"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* Loading spinner */}
            {isLoading ? (
              <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-b from-royal-900 to-surface">
                <div className="text-center">
                  <div
                    className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-royal-700 border-t-gold-400"
                    role="status"
                    aria-label="Loading image"
                  />
                  <p className="mt-4 text-sm text-text-dim">
                    Loading NASA imagery...
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Image */}
                {((isNasaMode && currentImage && !imageError) ||
                  (!isNasaMode && entry?.imagePath && !imageError)) ? (
                  <div className="relative h-80 w-full overflow-hidden bg-surface">
                    <img
                      src={isNasaMode ? currentImage?.thumbUrl : entry?.imagePath}
                      alt={isNasaMode
                        ? `NASA image: ${currentImage?.title}`
                        : `Hubble telescope image: ${entry?.title}`}
                      className="h-full w-full object-contain"
                      onError={() => setImageError(true)}
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="flex h-80 w-full items-center justify-center bg-gradient-to-b from-royal-900 to-surface">
                    <div className="text-center">
                      <div className="text-4xl" aria-hidden="true">
                        ✨
                      </div>
                      <p className="mt-2 text-sm text-text-dim">
                        {isNasaMode
                          ? `Unable to load image for ${targetLabel}`
                          : "Image unavailable"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Thumbnail selector (NASA mode only) */}
                {isNasaMode && nasaResults.length > 1 && !imageError && (
                  <div className="border-t border-royal-700/30 bg-surface/50 p-3">
                    <div className="flex gap-2 overflow-x-auto">
                      {nasaResults.map((result, idx) => (
                        <button
                          key={result.nasaId}
                          onClick={() => setSelectedImageIndex(idx)}
                          className={`group relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                            idx === selectedImageIndex
                              ? "border-gold-400 ring-2 ring-gold-400/30"
                              : "border-royal-700/50 hover:border-royal-600"
                          }`}
                          aria-label={`View image ${idx + 1} of ${nasaResults.length}: ${result.title}`}
                          aria-pressed={idx === selectedImageIndex}
                        >
                          <img
                            src={result.thumbUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          {idx === selectedImageIndex && (
                            <div className="absolute inset-0 bg-gold-400/20" />
                          )}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-center text-xs text-text-dim">
                      {nasaResults.length} images available
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Content */}
            <div className="p-6">
              {/* NASA mode badge */}
              {isNasaMode && (
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-gold-400/10 px-3 py-1 text-xs font-semibold text-gold-400 ring-1 ring-gold-400/20">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span>Today's Discovery</span>
                </div>
              )}
              <h3 className="font-heading text-xl font-bold text-text-primary">
                {displayTitle}
              </h3>
              <p className="mt-1 text-xs text-text-dim">{displayCaption}</p>

              {isNasaMode && currentImage ? (
                <>
                  {/* NASA mode content */}
                  <p className="mt-1 text-sm font-medium text-royal-300">
                    {currentImage.title}
                  </p>
                  {currentImage.description && (
                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-text-muted">
                      {currentImage.description}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-text-dim">
                    Source: NASA Image & Video Library
                  </p>
                  <a
                    href={currentImage.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-gold-400 transition-colors hover:text-gold-300"
                  >
                    View on NASA Images →
                  </a>
                </>
              ) : (
                <>
                  {/* Hubble mode content */}
                  <p className="mt-3 text-sm leading-relaxed text-text-muted">
                    {displayDescription}
                  </p>
                  {entry?.credit && (
                    <p className="mt-3 text-xs text-text-dim">
                      Credit: {entry.credit}
                    </p>
                  )}
                  {entry?.sourceUrl && (
                    <a
                      href={entry.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs text-gold-400 transition-colors hover:text-gold-300"
                    >
                      View source →
                    </a>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
