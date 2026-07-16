import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  disconnect: vi.fn(),
  forceContextLoss: vi.fn(),
  loaderLoad: vi.fn(),
  onLoad: undefined as
    undefined | ((gltf: { scene: Record<string, unknown> }) => void),
  onError: undefined as undefined | ((error: unknown) => void),
  render: vi.fn(),
  requestAnimationFrame: vi.fn(),
  cancelAnimationFrame: vi.fn(),
  rafCallback: undefined as undefined | ((timestamp: number) => void),
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
      _onProgress: unknown,
      onError: (error: unknown) => void,
    ) => {
      mocks.loaderLoad(url);
      mocks.onLoad = onLoad;
      mocks.onError = onError;
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
import { shipAssets } from "@/components/islands/space/shipQuality";

describe("ShipRenderer lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onLoad = undefined;
    mocks.onError = undefined;
    mocks.resizeCallback = undefined;
    mocks.rafCallback = undefined;
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
    vi.stubGlobal("requestAnimationFrame", mocks.requestAnimationFrame);
    const renderer = new ShipRenderer(shipAssets.low);

    renderer.mount(document.createElement("div"));

    expect(mocks.render).toHaveBeenCalledOnce();
    expect(mocks.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("animates a normal travel phase with bounded banking and stronger plume output", () => {
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      mocks.rafCallback = callback;
      return 1;
    });
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    vi.stubGlobal("cancelAnimationFrame", mocks.cancelAnimationFrame);
    const material = { emissiveIntensity: 2 };
    const ship = {
      position: { set: vi.fn() },
      rotation: { x: 0, z: 0 },
      scale: { setScalar: mocks.scaleSetScalar },
      traverse: (callback: (child: unknown) => void) => callback({ material }),
    };
    const renderer = new ShipRenderer(shipAssets.low);
    renderer.mount(document.createElement("div"));
    mocks.onLoad?.({ scene: ship });

    expect(material.emissiveIntensity).toBe(0.5);
    renderer.setMotion({ phase: "warp", targetBank: 0.8 });
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    mocks.rafCallback?.(1000);
    mocks.rafCallback?.(1016.67);

    expect(ship.rotation.z).toBeGreaterThan(0);
    expect(ship.rotation.z).toBeLessThanOrEqual(1);
    expect(material.emissiveIntensity).toBe(2);

    renderer.setMotion({ phase: "idle", targetBank: 0 });
    expect(material.emissiveIntensity).toBe(0.5);
  });

  it("keeps reduced-motion travel static at idle plume intensity", () => {
    vi.stubGlobal("requestAnimationFrame", mocks.requestAnimationFrame);
    vi.stubGlobal("cancelAnimationFrame", mocks.cancelAnimationFrame);
    const material = { emissiveIntensity: 2 };
    const ship = {
      position: { set: vi.fn() },
      rotation: { x: 0, z: 0 },
      scale: { setScalar: mocks.scaleSetScalar },
      traverse: (callback: (child: unknown) => void) => callback({ material }),
    };
    const renderer = new ShipRenderer(shipAssets.low, undefined, undefined, {
      reducedMotion: true,
    });
    renderer.mount(document.createElement("div"));
    mocks.onLoad?.({ scene: ship });
    renderer.setMotion({ phase: "warp", targetBank: 0.8 });

    expect(mocks.requestAnimationFrame).not.toHaveBeenCalled();
    expect(ship.rotation.z).toBe(0);
    expect(material.emissiveIntensity).toBe(0.5);
  });

  it("cancels an active animation loop on disposal", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      mocks.rafCallback = callback;
      return 9;
    });
    vi.stubGlobal("cancelAnimationFrame", mocks.cancelAnimationFrame);
    const renderer = new ShipRenderer(shipAssets.low);
    renderer.mount(document.createElement("div"));
    mocks.onLoad?.({
      scene: {
        position: { set: vi.fn() },
        rotation: { x: 0, z: 0 },
        scale: { setScalar: mocks.scaleSetScalar },
        traverse: vi.fn(),
      },
    });
    renderer.setMotion({ phase: "warp", targetBank: 0.4 });
    renderer.dispose();

    expect(mocks.cancelAnimationFrame).toHaveBeenCalledWith(9);
  });

  it("releases the static renderer resources on disposal", () => {
    const container = document.createElement("div");
    const renderer = new ShipRenderer(shipAssets.low);
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
    const renderer = new ShipRenderer(shipAssets.low);

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

  it("retries a failed high-quality load with the low asset exactly once", () => {
    const onFailure = vi.fn();
    const onReady = vi.fn();
    const renderer = new ShipRenderer(shipAssets.high, onFailure, onReady);

    renderer.mount(document.createElement("div"));
    mocks.onError?.(new Error("high asset failed"));
    mocks.onError?.(new Error("low asset failed"));

    expect(mocks.loaderLoad).toHaveBeenNthCalledWith(1, shipAssets.high.url);
    expect(mocks.loaderLoad).toHaveBeenNthCalledWith(2, shipAssets.low.url);
    expect(mocks.loaderLoad).toHaveBeenCalledTimes(2);
    expect(onFailure).toHaveBeenCalledOnce();
  });

  it("reports the active asset after it loads", () => {
    const onReady = vi.fn();
    const renderer = new ShipRenderer(shipAssets.low, undefined, onReady);

    renderer.mount(document.createElement("div"));
    mocks.onLoad?.({
      scene: {
        position: { set: vi.fn() },
        rotation: { x: 0 },
        scale: { setScalar: mocks.scaleSetScalar },
      },
    });

    expect(onReady).toHaveBeenCalledWith(shipAssets.low);
  });
});
