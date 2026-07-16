import { afterEach, describe, expect, it, vi } from "vitest";

import { canCreateWebGL } from "@/components/islands/space/webglSupport";

describe("canCreateWebGL", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("falls back to experimental WebGL when the primary getter throws", () => {
    const context = {
      getExtension: vi.fn(() => null),
    } as unknown as WebGLRenderingContext;
    const getContext = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("webgl unavailable");
      })
      .mockReturnValueOnce(context);

    expect(canCreateWebGL(getContext)).toBe(true);
    expect(getContext).toHaveBeenNthCalledWith(2, "experimental-webgl", {
      failIfMajorPerformanceCaveat: true,
    });
  });

  it("returns true when context cleanup extension is absent or throws", () => {
    const absentExtension = {
      getExtension: vi.fn(() => null),
    } as unknown as WebGLRenderingContext;
    expect(canCreateWebGL(vi.fn(() => absentExtension))).toBe(true);

    const throwingExtension = {
      getExtension: vi.fn(() => {
        throw new Error("extension unavailable");
      }),
    } as unknown as WebGLRenderingContext;
    expect(canCreateWebGL(vi.fn(() => throwingExtension))).toBe(true);
  });

  it("removes the detached probe canvas after a default probe", () => {
    const canvas = document.createElement("canvas");
    const context = {
      getExtension: vi.fn(() => null),
    } as unknown as WebGLRenderingContext;
    vi.spyOn(document, "createElement").mockReturnValue(canvas);
    vi.spyOn(canvas, "getContext").mockReturnValue(context);
    const remove = vi.spyOn(canvas, "remove");

    expect(canCreateWebGL()).toBe(true);
    expect(remove).toHaveBeenCalledOnce();
  });

  it("returns a boolean even when probe cleanup throws", () => {
    const context = {
      getExtension: vi.fn(() => null),
    } as unknown as WebGLRenderingContext;
    const getContext = Object.assign(
      vi.fn(() => context),
      {
        cleanup: vi.fn(() => {
          throw new Error("cleanup failed");
        }),
      },
    );

    expect(canCreateWebGL(getContext)).toBe(true);
  });
});
