import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount rendered components between tests. Without this, React Testing
// Library leaves each test's DOM tree mounted in document.body, so global
// queries (getByLabelText, baseElement.textContent) in a later test can
// match stale elements from an earlier one.
afterEach(() => {
  cleanup();
});
