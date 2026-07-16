import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  disconnect: vi.fn(),
  forceContextLoss: vi.fn(),
  loaderLoad: vi.fn(),
  onLoad: undefined as
    | undefined
    | ((gltf: { scene: Record<string, unknown> }) => void),
  render: vi.fn(),
  renderListsDispose: vi.fn(),
  rendererDispose: vi.fn(),
  resizeObserve: vi.fn(),
  resizeCallback: undefined as undefined | ResizeObserverCallback,
  scaleSetScalar: vi.fn(),
  setPixelRatio: vi.fn(),
  setSize: vi.fn(),
}));

vi.mock("three", () => {
  class Object3D {
    add = vi.fn();
    position = { set: vi.fn() };
    remove = vi.fn();
    rotation = { x: 0 };
    scale = { setScalar: mocks.scaleSetScalar };
    traverse = vi.fn();
  }

  class PerspectiveCamera extends Object3D {
    aspect = 1;
    updateProjectionMatrix = vi.fn();
  }

  class Scene extends Object3D {
    clear = vi.fn();
  }

  class WebGLRenderer {
    domElement = document.createElement("canvas");
    forceContextLoss = mocks.forceContextLoss;
    render = mocks.render;
    renderLists = { dispose: mocks.renderListsDispose };
    dispose = mocks.rendererDispose;
    setPixelRatio = mocks.setPixelRatio;
    setSize = mocks.setSize;
  }

  return {
    DirectionalLight: class {
      position = { set: vi.fn() };
    },
    HemisphereLight: class {},
    Mesh: class extends Object3D {},
    Object3D,
    PerspectiveCamera,
    Scene,
    SRGBColorSpace: "srgb",
    Texture: class {},
    WebGLRenderer,
  };
});

vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    load = (
      url: string,
      onLoad: (gltf: { scene: Record<string, unknown> }) => void,
    ) => {
      mocks.loaderLoad(url);
      mocks.onLoad = onLoad;
    };
    setMeshoptDecoder = vi.fn();
  },
}));

vi.mock("three/addons/libs/meshopt_decoder.module.js", () => ({
  MeshoptDecoder: {},
}));

import {
  getResponsiveShipScale,
  ShipRenderer,
  shipTransform,
} from "@/components/islands/space/ShipRenderer";

describe("ShipRenderer lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onLoad = undefined;
    mocks.resizeCallback = undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          mocks.resizeCallback = callback;
        }

        observe = mocks.resizeObserve;
        disconnect = mocks.disconnect;
      },
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("renders the static ship without scheduling animation frames", () => {
    const requestAnimationFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    const renderer = new ShipRenderer();

    renderer.mount(document.createElement("div"));

    expect(mocks.render).toHaveBeenCalledOnce();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("releases the static renderer resources on disposal", () => {
    const container = document.createElement("div");
    const renderer = new ShipRenderer();
    renderer.mount(container);

    renderer.dispose();

    expect(mocks.disconnect).toHaveBeenCalledOnce();
    expect(mocks.renderListsDispose).toHaveBeenCalledOnce();
    expect(mocks.rendererDispose).toHaveBeenCalledOnce();
    expect(mocks.forceContextLoss).toHaveBeenCalledOnce();
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("applies portrait scale after loading and restores desktop scale on resize", () => {
    const container = document.createElement("div");
    let dimensions = { width: 390, height: 844 } as DOMRect;
    vi.spyOn(container, "getBoundingClientRect").mockImplementation(
      () => dimensions,
    );
    const renderer = new ShipRenderer();

    renderer.mount(container);

    expect(mocks.loaderLoad).toHaveBeenCalledOnce();
    expect(mocks.resizeCallback).toBeTypeOf("function");

    mocks.onLoad?.({
      scene: {
        position: { set: vi.fn() },
        rotation: { x: 0 },
        scale: { setScalar: mocks.scaleSetScalar },
      },
    });
    expect(mocks.scaleSetScalar).toHaveBeenLastCalledWith(
      getResponsiveShipScale(390 / 844),
    );

    dimensions = { width: 1440, height: 900 } as DOMRect;
    mocks.resizeCallback?.([], {} as ResizeObserver);

    expect(mocks.scaleSetScalar).toHaveBeenLastCalledWith(
      shipTransform.modelScale,
    );
  });
});
