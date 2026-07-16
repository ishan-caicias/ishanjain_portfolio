type WebGLContextGetter = (
  contextId: "webgl" | "experimental-webgl",
  options: WebGLContextAttributes,
) => RenderingContext | null;

const contextOptions: WebGLContextAttributes = {
  failIfMajorPerformanceCaveat: true,
};

const defaultCanvasContext: WebGLContextGetter = (contextId, options) => {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  return canvas.getContext(contextId, options);
};

export function canCreateWebGL(
  getContext: WebGLContextGetter = defaultCanvasContext,
): boolean {
  let context: RenderingContext | null = null;

  try {
    context = getContext("webgl", contextOptions);
  } catch {
    return false;
  }

  if (!context) {
    try {
      context = getContext("experimental-webgl", contextOptions);
    } catch {
      return false;
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
}
