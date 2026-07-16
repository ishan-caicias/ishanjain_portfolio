import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import {
  shipAssets,
  type ShipAsset,
} from "@/components/islands/space/shipQuality";
import {
  nextShipMotion,
  plumeIntensityForPhase,
  type ShipMotionState,
} from "@/components/islands/space/shipMotion";
import type { WarpPhase } from "@/components/islands/space/sceneEvents";

const MAX_PIXEL_RATIO = 1.5;
const CAMERA_FOV = 45;
const HORIZONTAL_FRAME_USAGE = 0.85;
const SHIP_HALF_WIDTH = 1.40462;
const SHIP_NEAREST_Z = 2.00247;

export const shipTransform = {
  forwardOffset: 3.2,
  upwardOffset: -0.7,
  basePitch: -0.08,
  modelScale: 0.6,
} as const;

export function getResponsiveShipScale(aspect: number): number {
  const safeAspect = Math.max(aspect, 0.1);
  const horizontalFrameFactor =
    HORIZONTAL_FRAME_USAGE *
    Math.tan((CAMERA_FOV * Math.PI) / 360) *
    safeAspect;
  const scaleToFit =
    (horizontalFrameFactor * shipTransform.forwardOffset) /
    (SHIP_HALF_WIDTH + horizontalFrameFactor * SHIP_NEAREST_Z);

  return Math.min(shipTransform.modelScale, scaleToFit);
}

type ShipRendererFailureHandler = (error: Error) => void;
type ShipRendererReadyHandler = (asset: ShipAsset) => void;

export interface ShipMotionUpdate {
  readonly phase: WarpPhase;
  readonly targetBank: number;
}

export interface ShipRendererOptions {
  readonly reducedMotion?: boolean;
}

function toError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error("Unable to render ship");
}

function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) {
      value.dispose();
    }
  }

  material.dispose();
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.geometry.dispose();
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    materials.forEach(disposeMaterial);
  });
}

export class ShipRenderer {
  private readonly camera = new THREE.PerspectiveCamera(
    CAMERA_FOV,
    1,
    0.1,
    100,
  );
  private currentAsset: ShipAsset;
  private readonly onFailure?: ShipRendererFailureHandler;
  private readonly onReady?: ShipRendererReadyHandler;
  private readonly scene = new THREE.Scene();
  private canvas?: HTMLCanvasElement;
  private disposed = false;
  private renderer?: THREE.WebGLRenderer;
  private resizeObserver?: ResizeObserver;
  private retriedLowAsset = false;
  private ship?: THREE.Object3D;
  private readonly reducedMotion: boolean;
  private motionPhase: WarpPhase = "idle";
  private targetBank = 0;
  private motionState: ShipMotionState = { bank: 0, bankVelocity: 0 };
  private animationFrame?: number;
  private previousFrameTime?: number;
  private readonly baseEmissiveIntensity = new WeakMap<
    THREE.Material,
    number
  >();

  constructor(
    asset: ShipAsset,
    onFailure?: ShipRendererFailureHandler,
    onReady?: ShipRendererReadyHandler,
    options: ShipRendererOptions = {},
  ) {
    this.currentAsset = asset;
    this.onFailure = onFailure;
    this.onReady = onReady;
    this.reducedMotion = options.reducedMotion ?? false;
  }

  /** Synchronises the renderer with the scene's travel phase. Bank is in radians. */
  setMotion(update: ShipMotionUpdate): void {
    if (this.disposed) {
      return;
    }

    this.motionPhase = update.phase;
    this.targetBank = Number.isFinite(update.targetBank)
      ? Math.max(-1, Math.min(1, update.targetBank))
      : 0;

    if (this.reducedMotion) {
      this.motionPhase = "idle";
      this.targetBank = 0;
      this.motionState = { bank: 0, bankVelocity: 0 };
      this.cancelAnimation();
    }

    this.updateVisualState();
    if (
      !this.reducedMotion &&
      this.ship &&
      (this.motionPhase !== "idle" ||
        Math.abs(this.motionState.bank) > 0.001 ||
        Math.abs(this.motionState.bankVelocity) > 0.001)
    ) {
      this.scheduleAnimation();
    }
  }

  mount(container: HTMLElement): void {
    if (this.disposed || this.renderer) {
      return;
    }

    try {
      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO),
      );

      const canvas = renderer.domElement;
      canvas.className = "pointer-events-none absolute inset-0 h-full w-full";
      canvas.setAttribute("aria-hidden", "true");
      container.appendChild(canvas);

      this.renderer = renderer;
      this.canvas = canvas;
      this.scene.add(this.camera);
      this.addLights();
      this.resize(container);
      this.resizeObserver = new ResizeObserver(() => this.resize(container));
      this.resizeObserver.observe(container);

      this.loadShip();
    } catch (error) {
      this.fail(error);
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.resizeObserver?.disconnect();
    this.cancelAnimation();

    if (this.ship) {
      this.camera.remove(this.ship);
      disposeObject(this.ship);
      this.ship = undefined;
    }

    this.renderer?.renderLists.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.canvas?.remove();
    this.scene.clear();
    this.renderer = undefined;
    this.canvas = undefined;
  }

  private addLights(): void {
    const ambientLight = new THREE.HemisphereLight(0x99b9ff, 0x111827, 2.5);
    const keyLight = new THREE.DirectionalLight(0xffffff, 3);
    keyLight.position.set(-1, 1, 1);

    this.camera.add(ambientLight, keyLight);
  }

  private loadShip(): void {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      this.currentAsset.url,
      (gltf) => this.addShip(gltf.scene),
      undefined,
      (error) => this.handleLoadError(error),
    );
  }

  private addShip(ship: THREE.Object3D): void {
    if (this.disposed) {
      disposeObject(ship);
      return;
    }

    ship.position.set(
      0,
      shipTransform.upwardOffset,
      -shipTransform.forwardOffset,
    );
    ship.rotation.x = shipTransform.basePitch;
    ship.rotation.z = this.motionState.bank;
    ship.scale.setScalar(getResponsiveShipScale(this.camera.aspect));
    this.camera.add(ship);
    this.ship = ship;
    this.updateVisualState();
    if (
      !this.reducedMotion &&
      (this.motionPhase !== "idle" ||
        Math.abs(this.motionState.bank) > 0.001 ||
        Math.abs(this.motionState.bankVelocity) > 0.001)
    ) {
      this.scheduleAnimation();
    }
    this.render();
    this.onReady?.(this.currentAsset);
  }

  private handleLoadError(reason: unknown): void {
    if (
      !this.disposed &&
      this.currentAsset.quality === "high" &&
      !this.retriedLowAsset
    ) {
      this.retriedLowAsset = true;
      this.currentAsset = shipAssets.low;
      this.loadShip();
      return;
    }

    this.fail(reason);
  }

  private fail(reason: unknown): void {
    if (this.disposed) {
      return;
    }

    const error = toError(reason);
    this.dispose();
    this.onFailure?.(error);
  }

  private render(): void {
    if (this.disposed || !this.renderer) {
      return;
    }

    this.renderer.render(this.scene, this.camera);
  }

  private updateVisualState(): void {
    if (!this.ship) {
      return;
    }

    this.ship.rotation.z = this.motionState.bank;
    const phase = this.reducedMotion ? "idle" : this.motionPhase;
    const plumeIntensity = plumeIntensityForPhase(phase);

    if (typeof this.ship.traverse !== "function") {
      this.render();
      return;
    }

    this.ship.traverse((child) => {
      const materialOwner = child as THREE.Object3D & {
        material?: THREE.Material | THREE.Material[];
      };
      if (!materialOwner.material) {
        return;
      }

      const materials = Array.isArray(materialOwner.material)
        ? materialOwner.material
        : [materialOwner.material];
      materials.forEach((material) => {
        const emissiveMaterial = material as THREE.Material & {
          emissiveIntensity?: unknown;
        };
        if (typeof emissiveMaterial.emissiveIntensity !== "number") {
          return;
        }

        const baseIntensity =
          this.baseEmissiveIntensity.get(material) ??
          emissiveMaterial.emissiveIntensity;
        this.baseEmissiveIntensity.set(material, baseIntensity);
        emissiveMaterial.emissiveIntensity = baseIntensity * plumeIntensity;
      });
    });
    this.render();
  }

  private scheduleAnimation(): void {
    if (
      this.disposed ||
      this.reducedMotion ||
      !this.ship ||
      this.animationFrame !== undefined
    ) {
      return;
    }

    this.animationFrame = requestAnimationFrame(this.animate);
  }

  private readonly animate = (timestamp: number): void => {
    this.animationFrame = undefined;
    if (this.disposed || this.reducedMotion || !this.ship) {
      return;
    }

    const dt =
      this.previousFrameTime === undefined
        ? 0
        : Math.min(Math.max(timestamp - this.previousFrameTime, 0) / 1000, 0.1);
    this.previousFrameTime = timestamp;
    this.motionState = nextShipMotion(
      this.motionState,
      this.targetBank,
      dt,
      this.motionPhase,
    );
    this.updateVisualState();

    const settled =
      this.motionPhase === "idle" &&
      Math.abs(this.motionState.bank) < 0.001 &&
      Math.abs(this.motionState.bankVelocity) < 0.001;
    if (settled) {
      this.previousFrameTime = undefined;
      return;
    }

    this.scheduleAnimation();
  };

  private cancelAnimation(): void {
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
    }
    this.previousFrameTime = undefined;
  }

  private resize(container: HTMLElement): void {
    if (!this.renderer) {
      return;
    }

    const { width, height } = container.getBoundingClientRect();
    const safeHeight = Math.max(height, 1);
    this.camera.aspect = Math.max(width, 1) / safeHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(Math.max(width, 1), safeHeight, false);
    this.ship?.scale.setScalar(getResponsiveShipScale(this.camera.aspect));
    this.render();
  }
}
