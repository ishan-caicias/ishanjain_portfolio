import { describe, expect, it, vi } from "vitest";

import { canCreateWebGL } from "@/components/islands/space/webglSupport";

describe("canCreateWebGL", () => {
  it("returns true when a WebGL context is created and releases it", () => {
    const loseContext = vi.fn();
    const getExtension = vi.fn(() => ({ loseContext }));
    const context = { getExtension } as unknown as WebGLRenderingContext;
    const getContext = vi.fn(() => context);

    expect(canCreateWebGL(getContext)).toBe(true);
    expect(getContext).toHaveBeenCalledWith("webgl", {
      failIfMajorPerformanceCaveat: true,
    });
    expect(getExtension).toHaveBeenCalledWith("WEBGL_lose_context");
    expect(loseContext).toHaveBeenCalledOnce();
  });

  it("returns false when no context can be created", () => {
    const getContext = vi.fn(() => null);

    expect(canCreateWebGL(getContext)).toBe(false);
    expect(getContext).toHaveBeenCalledTimes(2);
    expect(getContext).toHaveBeenLastCalledWith("experimental-webgl", {
      failIfMajorPerformanceCaveat: true,
    });
  });

  it("returns false when context creation throws", () => {
    const getContext = vi.fn(() => {
      throw new Error("unsupported");
    });

    expect(canCreateWebGL(getContext)).toBe(false);
  });
});
