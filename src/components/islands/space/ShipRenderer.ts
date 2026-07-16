import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const SHIP_URL = "/space/ships/sci-fi-aircraft-spaceship-fighter.glb";
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
type ShipRendererReadyHandler = () => void;

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
  private readonly onFailure?: ShipRendererFailureHandler;
  private readonly onReady?: ShipRendererReadyHandler;
  private readonly scene = new THREE.Scene();
  private canvas?: HTMLCanvasElement;
  private disposed = false;
  private renderer?: THREE.WebGLRenderer;
  private resizeObserver?: ResizeObserver;
  private ship?: THREE.Object3D;

  constructor(
    onFailure?: ShipRendererFailureHandler,
    onReady?: ShipRendererReadyHandler,
  ) {
    this.onFailure = onFailure;
    this.onReady = onReady;
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

      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      loader.load(
        SHIP_URL,
        (gltf) => this.addShip(gltf.scene),
        undefined,
        (error) => this.fail(error),
      );
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
    ship.scale.setScalar(getResponsiveShipScale(this.camera.aspect));
    this.camera.add(ship);
    this.ship = ship;
    this.render();
    this.onReady?.();
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
