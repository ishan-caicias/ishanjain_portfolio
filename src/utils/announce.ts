/**
 * Announces a message to screen readers using an ARIA live region.
 * Creates a temporary element that is visually hidden but read by assistive technology.
 *
 * @param message - The message to announce
 * @param priority - The assertiveness level ('polite' | 'assertive')
 */
export function announce(
  message: string,
  priority: "polite" | "assertive" = "polite",
): void {
  const announcement = document.createElement("div");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", priority);
  announcement.setAttribute("aria-atomic", "true");
  announcement.className = "sr-only";
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement is read (1 second is sufficient for most screen readers)
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}
