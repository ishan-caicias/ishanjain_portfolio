type WebGLContextGetter = {
  (
    contextId: "webgl" | "experimental-webgl",
    options: WebGLContextAttributes,
  ): RenderingContext | null;
  cleanup?: () => void;
};

const contextOptions: WebGLContextAttributes = {
  failIfMajorPerformanceCaveat: true,
};

let defaultCanvas: HTMLCanvasElement | undefined;

const defaultCanvasContext: WebGLContextGetter = (contextId, options) => {
  if (typeof document === "undefined") {
    return null;
  }

  defaultCanvas ??= document.createElement("canvas");
  return defaultCanvas.getContext(contextId, options);
};

defaultCanvasContext.cleanup = () => {
  defaultCanvas?.remove();
  defaultCanvas = undefined;
};

export function canCreateWebGL(
  getContext: WebGLContextGetter = defaultCanvasContext,
): boolean {
  let context: RenderingContext | null = null;

  try {
    try {
      context = getContext("webgl", contextOptions);
    } catch {
      context = null;
    }

    if (!context) {
      try {
        context = getContext("experimental-webgl", contextOptions);
      } catch {
        context = null;
      }
    }

    if (!context) {
      return false;
    }

    try {
      const loseContext = (context as WebGLRenderingContext).getExtension?.(
        "WEBGL_lose_context",
      ) as { loseContext?: () => void } | null | undefined;
      loseContext?.loseContext?.();
    } catch {
      // A failed cleanup should not make a supported context unusable.
    }

    return true;
  } finally {
    try {
      getContext.cleanup?.();
    } catch {
      // Probe cleanup is best effort and must not change the capability result.
    }
  }
}
