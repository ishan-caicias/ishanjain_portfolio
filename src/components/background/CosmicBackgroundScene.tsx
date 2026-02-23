import {
  useRef,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CosmicObject, CosmicObjectSelectedDetail } from "./cosmicTypes";
import {
  COSMIC_OBJECT_SELECTED_EVENT,
  type CosmicObjectKind,
} from "./cosmicTypes";
import RealStarLayer from "./RealStarLayer";
import GaiaCombinedLayer from "./GaiaCombinedLayer";
import { OrbitControls } from "@react-three/drei";

/* ----- TUNING CONSTANTS ----- */

// Particle counts - dense starfield
const STAR_COUNT_FAR = 12000;   // Was 7000
const STAR_COUNT_MID = 4000;    // Was 2000
const STAR_COUNT_NEAR = 1000;   // Was 600

// Ship exclusion zone (prevents crowding around origin)
const EXCLUSION_RADIUS = 3.5;   // Distance from origin to push stars outward

// Size distribution (50/50 small vs sparkle)
const SIZE_SMALL_MIN = 0.4;
const SIZE_SMALL_MAX = 0.8;
const SIZE_SPARKLE_MIN = 0.9;
const SIZE_SPARKLE_MAX = 1.4;

// Brightness ranges (brighter overall)
const BRIGHTNESS_MIN = 0.5;     // Was 0.25
const BRIGHTNESS_MAX = 1.0;     // Was 0.6

// Base opacity per layer
const BASE_OPACITY_FAR = 0.45;  // Additive blend
const BASE_OPACITY_MID = 0.40;  // Additive blend
const BASE_OPACITY_NEAR = 0.25; // Normal blend

// Twinkle amplitude (per star type)
const TWINKLE_SMALL_MIN = 0.05;
const TWINKLE_SMALL_MAX = 0.10;
const TWINKLE_SPARKLE_MIN = 0.15;
const TWINKLE_SPARKLE_MAX = 0.25;

// Star color tinting (background stars only, not interactive)
const TINT_STRENGTH = 0.32;        // Overall tint intensity (capped)
const TINT_PROB_WHITE = 0.80;      // 80% near-white stars
const TINT_PROB_BLUE = 0.10;       // 10% cool blue tint
const TINT_PROB_AMBER = 0.07;      // 7% warm amber tint
const TINT_PROB_RED = 0.03;        // 3% soft red tint

// Star color palette (subtle saturation)
const TINT_WHITE = [1.0, 1.0, 1.0];           // Pure white
const TINT_BLUE = [0.7, 0.85, 1.0];           // Cool blue
const TINT_AMBER = [1.0, 0.9, 0.7];           // Warm amber
const TINT_RED = [1.0, 0.75, 0.7];            // Soft red/pink

// Other constants
const WRAP_RADIUS = 12;
const INTERACTIVE_COUNT = 18;
const INTERACTIVE_BRIGHTNESS_MULT = 1.2;
const INTERACTIVE_BASE_OPACITY = 0.4;
const NEBULA_OPACITY = 0.04;

/* ========================================
   BACKGROUND GALAXY LAYER CONSTANTS
   ======================================== */

// TUNING: Background galaxy appearance
const GALAXY_BG_COUNT = 30;                    // Number of background galaxies (20-40 range)
const GALAXY_BG_SIZE_MIN = 18;                 // Minimum size in pixels
const GALAXY_BG_SIZE_MAX = 60;                 // Maximum size in pixels
const GALAXY_BG_OPACITY_MIN = 0.3;             // Minimum alpha (subtle)
const GALAXY_BG_OPACITY_MAX = 0.5;             // Maximum alpha
const GALAXY_BG_ROTATION_MIN = 0;              // Minimum rotation (radians)
const GALAXY_BG_ROTATION_MAX = Math.PI * 2;    // Maximum rotation (full circle)
const GALAXY_BG_TIGHTNESS_MIN = 0.6;           // Spiral tightness min (looser than interactive)
const GALAXY_BG_TIGHTNESS_MAX = 1.2;           // Spiral tightness max
const GALAXY_BG_PROB_SPIRAL = 0.7;             // 70% spiral galaxies

// TUNING: Background galaxy colors (subtle blue/purple tints)
const GALAXY_BG_COLOR_BLUE = [0.75, 0.85, 1.0];      // Cool blue
const GALAXY_BG_COLOR_PURPLE = [0.85, 0.75, 1.0];    // Soft purple
const GALAXY_BG_COLOR_CYAN = [0.7, 0.9, 0.95];       // Cyan tint
const GALAXY_BG_PROB_BLUE = 0.6;                     // 60% blue
const GALAXY_BG_PROB_PURPLE = 0.3;                   // 30% purple
const GALAXY_BG_PROB_CYAN = 0.1;                     // 10% cyan

/* ========================================
   PANORAMIC DRIFT & PARALLAX CONSTANTS
   ======================================== */

// TUNING: Global drift direction (normalized)
const DRIFT_DIR_X = 0.35;
const DRIFT_DIR_Y = 0.08;
const DRIFT_DIR_Z = 1.0;
const DRIFT_SPEED_GLOBAL = 1.0;  // Base multiplier (speeds are now absolute)

// Compute normalized direction vector
const DRIFT_DIR_MAG = Math.sqrt(
  DRIFT_DIR_X ** 2 + DRIFT_DIR_Y ** 2 + DRIFT_DIR_Z ** 2
);
const DRIFT_DIR = new THREE.Vector3(
  DRIFT_DIR_X / DRIFT_DIR_MAG,
  DRIFT_DIR_Y / DRIFT_DIR_MAG,
  DRIFT_DIR_Z / DRIFT_DIR_MAG
);

// TUNING: Parallax factors (absolute speeds, not multipliers) - ENHANCED for cinematic depth
const PARALLAX_FAR = 0.02;       // Far stars move slowest (was 0.015, +33%)
const PARALLAX_MID = 0.05;       // Mid layer (was 0.03, +67%)
const PARALLAX_NEAR = 0.08;      // Near stars move fastest (was 0.06, +33%)
const PARALLAX_NEBULA = 0.005;   // NEW: Nebula atmospheric drift (very subtle)
const PARALLAX_INTERACTIVE = 0.045; // Interactive layer (unchanged)
const PARALLAX_BACKGROUND_GALAXY = 0.03;   // Background galaxies (between FAR and MID)

// TUNING: Per-star drift variance (reduces "zooming" effect)
const DRIFT_JITTER_MAX = 0.12;     // Max per-star speed variance (±12%)
const DRIFT_SPEED_MAX = 0.0016;    // Absolute speed cap for NEAR layer (subtle glide)

// TUNING: Turbulence (optional micro-variation)
const TURBULENCE_AMPLITUDE = 0.05; // 5% of drift magnitude
const TURBULENCE_ENABLED = true;   // Set false for pure linear drift

/* ========================================
   NEBULA BACKDROP CONSTANTS
   ======================================== */

// TUNING: Nebula appearance and behavior
const NEBULA_INTENSITY = 0.14;     // Overall opacity/brightness (0-1)
const NEBULA_SCALE = 1.4;          // Noise frequency scale (higher = tighter clouds)
const NEBULA_CENTER_FADE = 0.75;   // Radial fade strength (0 = no fade, 1 = complete fade at center)
const NEBULA_DRIFT_SPEED = 0.005;  // Extremely subtle time-based offset

// TUNING: Nebula color palette (low saturation)
const NEBULA_COLOR_CYAN = [0.4, 0.7, 0.9];      // Cyan/blue base
const NEBULA_COLOR_PURPLE = [0.6, 0.4, 0.8];    // Purple core pockets
const NEBULA_COLOR_AMBER = [0.9, 0.7, 0.4];     // Rare amber highlights

/* ========================================
   CAMERA OSCILLATION CONSTANTS
   ======================================== */

// TUNING: Panoramic camera sway (subtle observer drift) - ENHANCED for cinematic presence
const CAMERA_YAW_AMPLITUDE = 0.035;   // radians (~2 degrees, was 0.02, +75%)
const CAMERA_YAW_FREQUENCY = 0.015;   // Hz (was 0.02, slower for cinematic feel)
const CAMERA_PITCH_AMPLITUDE = 0.020; // radians (~1.1 degrees, was 0.01, +100%)
const CAMERA_PITCH_FREQUENCY = 0.012; // Hz (was 0.015, slower for cinematic feel)
const CAMERA_ROLL_AMPLITUDE = 0.0064; // radians (~0.37 degrees, was 0.008, -20% to reduce "fast" feeling)
const CAMERA_ROLL_FREQUENCY = 0.01;   // Hz (very slow)
const CAMERA_OSCILLATION_ENABLED = true;

/* ========================================
   METEOR SYSTEM CONSTANTS
   ======================================== */

// TUNING: Meteor appearance intervals (desktop vs mobile)
const METEOR_MIN_INTERVAL_DESKTOP = 8.0;   // seconds (was 4.0)
const METEOR_MAX_INTERVAL_DESKTOP = 20.0;  // seconds (was 5.5)
const METEOR_MIN_INTERVAL_MOBILE = 14.0;   // seconds (battery-friendly)
const METEOR_MAX_INTERVAL_MOBILE = 28.0;   // seconds (battery-friendly)

// TUNING: Meteor animation properties
const METEOR_MIN_DURATION = 0.6;           // seconds (was 0.64-1.12 range)
const METEOR_MAX_DURATION = 1.2;           // seconds
const METEOR_SPEED = 12.0;                 // units per second (unchanged)
const METEOR_TRAIL_LENGTH = 3.0;           // line length (unchanged)
const METEOR_BRIGHTNESS = 0.8;             // alpha (unchanged)

// TUNING: Meteor spawn positioning
const METEOR_EDGE_DISTANCE = WRAP_RADIUS * 0.9;  // Distance from camera (10.8 units)
const METEOR_EDGE_RANDOMNESS = 0.85;       // Position variation along edge (0-1)

// Edge enum for meteor spawn/end points
enum MeteorEdge {
  TOP = 0,
  BOTTOM = 1,
  LEFT = 2,
  RIGHT = 3,
}

/* ========================================
   MICRO-STREAKS CONSTANTS (NEAR LAYER)
   ======================================== */

// TUNING: Velocity emphasis via elongated star rendering
const STREAK_PROBABILITY = 0.05;   // NEW: 5% of NEAR stars have streaks
const STREAK_MIN_LENGTH = 1.0;     // NEW: Base elongation multiplier
const STREAK_MAX_LENGTH = 1.8;     // NEW: Max elongation multiplier
const STREAK_ENABLED = true;       // NEW: Toggle feature

/* ========================================
   PERFORMANCE CONSTANTS
   ======================================== */

// TUNING: Device pixel ratio limits for performance
const DPR_MOBILE_BREAKPOINT = 768; // NEW: px width threshold
const DPR_MAX_DESKTOP = 1.5;       // NEW: Desktop cap
const DPR_MAX_MOBILE = 1.0;        // NEW: Mobile cap (performance)

const starVertexShader = `
  attribute float size;
  attribute float twinklePhase;
  attribute float twinkleAmp;
  attribute float baseBrightness;
  attribute float starType;
  attribute float streakAmount;  // NEW: For micro-streaks
  attribute float driftMultiplier;  // NEW: Per-star drift variance (clamped)
  attribute vec3 starTint;  // NEW: RGB color tint per star

  uniform float uTime;
  uniform float uTwinkleScale;
  uniform float uReducedMotion;
  uniform vec3 uDriftDir;
  uniform float uParallax;
  uniform float uDriftSpeed;
  uniform float uDriftSpeedMax;  // NEW: Absolute speed cap
  uniform float uTurbulence;
  uniform float uWrapRadius;

  varying float vBrightness;
  varying float vStarType;
  varying float vStreakAmount;  // NEW: Pass streak amount to fragment shader
  varying vec3 vStarTint;  // NEW: Pass tint to fragment shader

  // Shared turbulence function (coherent across all stars)
  vec3 computeTurbulence(vec3 pos, float time) {
    float noiseX = sin(pos.x * 0.1 + time * 0.05) * cos(pos.z * 0.08);
    float noiseY = cos(pos.y * 0.12 + time * 0.04) * sin(pos.x * 0.09);
    float noiseZ = sin(pos.z * 0.11 + time * 0.06) * cos(pos.y * 0.07);
    return vec3(noiseX, noiseY, noiseZ);
  }

  // Spherical wrap-around
  vec3 wrapSphere(vec3 pos, float radius) {
    float dist = length(pos);
    if (dist > radius) {
      return -normalize(pos) * (radius * 0.8);
    }
    return pos;
  }

  void main() {
    vec3 pos = position;

    // COHERENT DRIFT: Linear motion in global direction with parallax
    if (uReducedMotion < 0.5) {
      // Calculate base drift speed with per-star multiplier
      float starDriftSpeed = uParallax * uDriftSpeed * driftMultiplier;

      // Clamp to absolute maximum speed (prevents "zooming" stars)
      starDriftSpeed = min(starDriftSpeed, uDriftSpeedMax);

      vec3 drift = uDriftDir * uTime * starDriftSpeed;
      pos += drift;

      // Optional micro-turbulence
      if (uTurbulence > 0.0) {
        vec3 turbulence = computeTurbulence(position, uTime) * uTurbulence;
        pos += turbulence;
      }

      // Wrap stars beyond boundary
      pos = wrapSphere(pos, uWrapRadius);
    }

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // TWINKLE: Unchanged
    float twinkle = uReducedMotion > 0.5
      ? 0.05
      : (sin(uTime * 1.2 + twinklePhase) * twinkleAmp + 1.0 - twinkleAmp);
    vBrightness = baseBrightness * twinkle * uTwinkleScale;
    vStarType = starType;

    // SIZE SCALING: Distance-based with clamps
    float distanceFactor = -mv.z;
    float computedSize = size * (200.0 / distanceFactor);
    gl_PointSize = starType > 0.5
      ? clamp(computedSize, 2.0, 4.0)  // Sparkle stars (larger for starburst)
      : clamp(computedSize, 1.2, 2.5); // Small stars (more visible minimum)

    // Pass streak amount to fragment shader (disabled in reduced motion)
    vStreakAmount = uReducedMotion > 0.5 ? 0.0 : streakAmount;

    // Pass star tint to fragment shader
    vStarTint = starTint;
  }
`;

const starFragmentShader = `
  varying float vBrightness;
  varying float vStarType;
  varying vec3 vStarTint;  // NEW: Per-star color tint
  uniform float uBaseOpacity;

  void main() {
    vec2 coord = gl_PointCoord - 0.5;
    float dist = length(coord);

    // Base radial falloff
    float coreAlpha = smoothstep(0.5, 0.0, dist);

    // STARBURST EFFECT: Add cross spikes for sparkle stars
    if (vStarType > 0.5) {
      // Create 4-point cross using abs(x)/abs(y) ratio
      float spikeX = abs(coord.x) / (abs(coord.y) + 0.01);
      float spikeY = abs(coord.y) / (abs(coord.x) + 0.01);

      // Combine spikes (peaks when one coordinate is much larger)
      float spike = max(
        smoothstep(2.0, 8.0, spikeX),
        smoothstep(2.0, 8.0, spikeY)
      );

      // Add spike to core, fade with distance
      float spikeAlpha = spike * (1.0 - dist * 2.0) * 0.6;
      coreAlpha = max(coreAlpha, spikeAlpha);
    }

    float finalAlpha = coreAlpha * vBrightness * uBaseOpacity;

    // Apply color tint with controlled strength (TINT_STRENGTH = 0.35)
    // Mix between white and tint color for subtle variety
    vec3 white = vec3(1.0);
    vec3 starColor = mix(white, vStarTint, ${TINT_STRENGTH});

    gl_FragColor = vec4(starColor, finalAlpha);
  }
`;

// NEW: Fragment shader for NEAR layer with micro-streaks
const starFragmentShaderNear = `
  varying float vBrightness;
  varying float vStarType;
  varying float vStreakAmount;  // NEW: Streak elongation factor
  varying vec3 vStarTint;  // NEW: Per-star color tint
  uniform float uBaseOpacity;

  void main() {
    vec2 coord = gl_PointCoord - 0.5;
    float dist = length(coord);

    // Apply color tint with controlled strength (TINT_STRENGTH = 0.35)
    vec3 white = vec3(1.0);
    vec3 starColor = mix(white, vStarTint, ${TINT_STRENGTH});

    // Check if this is a streaking star
    if (vStreakAmount > 0.01) {
      // Elongate along horizontal axis (drift direction)
      float elongation = 2.0 + vStreakAmount * 3.0;
      vec2 stretchedCoord = vec2(coord.x * elongation, coord.y);
      float stretchedDist = length(stretchedCoord);

      // Asymmetric falloff (bright head, fading tail)
      float headAlpha = smoothstep(0.6, 0.0, stretchedDist);
      float tailFade = 1.0 - smoothstep(0.0, 1.0, coord.x + 0.5);
      float coreAlpha = headAlpha * tailFade;

      float finalAlpha = coreAlpha * vBrightness * uBaseOpacity;

      gl_FragColor = vec4(starColor, finalAlpha);
      return;
    }

    // Standard circular rendering (existing code)
    float coreAlpha = smoothstep(0.5, 0.0, dist);

    // Starburst effect for sparkle stars
    if (vStarType > 0.5) {
      float angle = atan(coord.y, coord.x);
      float spike = abs(sin(angle * 4.0)) * 0.3;
      coreAlpha += spike * smoothstep(0.6, 0.3, dist);
    }

    float finalAlpha = coreAlpha * vBrightness * uBaseOpacity;

    gl_FragColor = vec4(starColor, finalAlpha);
  }
`;

// ============================================
// BACKGROUND GALAXY SHADERS
// ============================================

const backgroundGalaxyVertexShader = `
  attribute float size;
  attribute float opacity;
  attribute float rotation;
  attribute float tightness;
  attribute float galaxyType;
  attribute vec3 galaxyColor;
  attribute float driftMultiplier;

  uniform float uTime;
  uniform float uReducedMotion;
  uniform vec3 uDriftDir;
  uniform float uParallax;
  uniform float uDriftSpeed;
  uniform float uDriftSpeedMax;
  uniform float uTurbulence;
  uniform float uWrapRadius;

  varying float vOpacity;
  varying float vRotation;
  varying float vTightness;
  varying float vGalaxyType;
  varying vec3 vGalaxyColor;

  // Reuse turbulence function from star shader
  vec3 computeTurbulence(vec3 pos, float time) {
    float noiseX = sin(pos.x * 0.1 + time * 0.05) * cos(pos.z * 0.08);
    float noiseY = cos(pos.y * 0.12 + time * 0.04) * sin(pos.x * 0.09);
    float noiseZ = sin(pos.z * 0.11 + time * 0.06) * cos(pos.y * 0.07);
    return vec3(noiseX, noiseY, noiseZ);
  }

  // Reuse wrap function from star shader
  vec3 wrapSphere(vec3 pos, float radius) {
    float dist = length(pos);
    if (dist > radius) {
      return -normalize(pos) * (radius * 0.8);
    }
    return pos;
  }

  void main() {
    vec3 pos = position;

    // Apply drift and wrap (same as stars)
    if (uReducedMotion < 0.5) {
      float galaxyDriftSpeed = uParallax * uDriftSpeed * driftMultiplier;
      galaxyDriftSpeed = min(galaxyDriftSpeed, uDriftSpeedMax);

      vec3 drift = uDriftDir * uTime * galaxyDriftSpeed;
      pos += drift;

      if (uTurbulence > 0.0) {
        vec3 turbulence = computeTurbulence(position, uTime) * uTurbulence;
        pos += turbulence;
      }

      pos = wrapSphere(pos, uWrapRadius);
    }

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // Size scaling with depth (larger range for galaxies than stars)
    float distanceFactor = -mv.z;
    float computedSize = size * (250.0 / distanceFactor);
    gl_PointSize = clamp(computedSize, 12.0, 80.0);

    // Pass varyings to fragment shader
    vOpacity = opacity;
    vRotation = rotation;
    vTightness = tightness;
    vGalaxyType = galaxyType;
    vGalaxyColor = galaxyColor;
  }
`;

const backgroundGalaxyFragmentShader = `
  varying float vOpacity;
  varying float vRotation;
  varying float vTightness;
  varying float vGalaxyType;
  varying vec3 vGalaxyColor;

  // Simplified spiral function (2 arms instead of 3)
  float galaxySpiral(vec2 coord, float rotation, float tightness) {
    float angle = atan(coord.y, coord.x);
    float dist = length(coord);

    // Logarithmic spiral (simpler than interactive version)
    float spiral = sin(angle * 2.0 + rotation - dist * tightness * 12.0);

    // Fade with distance
    float fade = 1.0 - smoothstep(0.0, 0.5, dist);

    return max(0.0, spiral) * fade;
  }

  // Elliptical galaxy (simple radial gradient)
  float galaxyElliptical(vec2 coord) {
    // Slight ellipse distortion
    vec2 distorted = vec2(coord.x * 1.3, coord.y);
    float dist = length(distorted);

    // Smooth core with falloff
    float core = smoothstep(0.5, 0.0, dist * 1.8);
    float glow = smoothstep(0.6, 0.0, dist) * 0.4;

    return core + glow;
  }

  void main() {
    vec2 coord = gl_PointCoord - 0.5;
    float dist = length(coord);

    float galaxyAlpha;

    // Spiral galaxy (galaxyType ≈ 0.0)
    if (vGalaxyType < 0.5) {
      // Core glow
      float core = smoothstep(0.5, 0.0, dist * 2.0) * 0.8;

      // Two spiral arms (180° apart)
      float spiral1 = galaxySpiral(coord, vRotation, vTightness);
      float spiral2 = galaxySpiral(coord, vRotation + 3.14159, vTightness);
      float spirals = (spiral1 + spiral2) * 0.35;

      // Diffuse halo
      float halo = smoothstep(0.6, 0.0, dist) * 0.25;

      galaxyAlpha = core + spirals + halo;
    }
    // Elliptical galaxy (galaxyType ≈ 1.0)
    else {
      galaxyAlpha = galaxyElliptical(coord);
    }

    // Apply base opacity
    float finalAlpha = galaxyAlpha * vOpacity;

    // Soft edge falloff (prevent hard cutoff)
    finalAlpha *= smoothstep(0.5, 0.45, dist);

    gl_FragColor = vec4(vGalaxyColor, finalAlpha);
  }
`;

/**
 * Converts edge enum + random offset to 3D world coordinates
 * Uses NDC (Normalized Device Coordinates) unprojection for camera-aware positioning
 *
 * @param edge - Which screen edge (TOP/BOTTOM/LEFT/RIGHT)
 * @param randomOffset - Position along edge (-1 to 1, scaled by METEOR_EDGE_RANDOMNESS)
 * @param camera - Three.js camera for unprojection
 * @returns World position Vector3 at METEOR_EDGE_DISTANCE from camera
 */
function getEdgePosition(
  edge: MeteorEdge,
  randomOffset: number,
  camera: THREE.Camera
): THREE.Vector3 {
  // Create NDC coordinates (-1 to 1 range)
  let ndcX = 0;
  let ndcY = 0;

  switch (edge) {
    case MeteorEdge.TOP:
      ndcX = randomOffset * METEOR_EDGE_RANDOMNESS;
      ndcY = 1.0;  // Top of viewport
      break;
    case MeteorEdge.BOTTOM:
      ndcX = randomOffset * METEOR_EDGE_RANDOMNESS;
      ndcY = -1.0;  // Bottom of viewport
      break;
    case MeteorEdge.LEFT:
      ndcX = -1.0;  // Left of viewport
      ndcY = randomOffset * METEOR_EDGE_RANDOMNESS;
      break;
    case MeteorEdge.RIGHT:
      ndcX = 1.0;  // Right of viewport
      ndcY = randomOffset * METEOR_EDGE_RANDOMNESS;
      break;
  }

  // Unproject from NDC to world space at METEOR_EDGE_DISTANCE
  const ndcPos = new THREE.Vector3(ndcX, ndcY, 0.5); // z=0.5 in NDC space
  ndcPos.unproject(camera);

  // Scale to desired distance from camera
  const direction = ndcPos.sub(camera.position).normalize();
  const worldPos = camera.position.clone().add(direction.multiplyScalar(METEOR_EDGE_DISTANCE));

  // CRITICAL: Clamp Z to ensure position stays in front of camera
  // Camera is at [0, 0, 8], looking toward origin [0, 0, 0]
  // Ensure meteor spawns between z = -2 (behind origin) and z = 6 (slightly behind camera)
  worldPos.z = Math.max(-2, Math.min(worldPos.z, 6));

  return worldPos;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

function createStarLayerGeometry(
  count: number,
  radius: number,
  exclusionRadius: number,
  enableStreaks: boolean = false  // NEW: Enable velocity streaks for NEAR layer
): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const twinklePhase = new Float32Array(count);
  const twinkleAmp = new Float32Array(count);
  const baseBrightness = new Float32Array(count);
  const starType = new Float32Array(count);  // 0 = small, 1 = sparkle
  const streakAmount = new Float32Array(count);  // NEW: 0 = no streak, 1.0-1.8 = streak length
  const driftMultiplier = new Float32Array(count);  // NEW: Per-star drift speed variance (clamped)
  const starTint = new Float32Array(count * 3);  // NEW: RGB tint per star

  for (let i = 0; i < count; i++) {
    // Generate random position
    let theta = Math.random() * Math.PI * 2;
    let phi = Math.acos(2 * Math.random() - 1);
    let r = radius * Math.cbrt(Math.random());

    let x = r * Math.sin(phi) * Math.cos(theta);
    let y = r * Math.sin(phi) * Math.sin(theta);
    let z = r * Math.cos(phi);

    // EXCLUSION ZONE: Push stars away from origin (ship position)
    const dist = Math.sqrt(x * x + y * y + z * z);
    if (dist < exclusionRadius) {
      const pushFactor = exclusionRadius / dist;
      x *= pushFactor * (1.0 + Math.random() * 0.2);  // Add jitter
      y *= pushFactor * (1.0 + Math.random() * 0.2);
      z *= pushFactor * (1.0 + Math.random() * 0.2);
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // SIZE DISTRIBUTION: 50/50 small vs sparkle
    const isSparkle = Math.random() > 0.5;
    starType[i] = isSparkle ? 1.0 : 0.0;

    if (isSparkle) {
      size[i] = SIZE_SPARKLE_MIN + Math.random() * (SIZE_SPARKLE_MAX - SIZE_SPARKLE_MIN);
      twinkleAmp[i] = TWINKLE_SPARKLE_MIN + Math.random() * (TWINKLE_SPARKLE_MAX - TWINKLE_SPARKLE_MIN);
    } else {
      size[i] = SIZE_SMALL_MIN + Math.random() * (SIZE_SMALL_MAX - SIZE_SMALL_MIN);
      twinkleAmp[i] = TWINKLE_SMALL_MIN + Math.random() * (TWINKLE_SMALL_MAX - TWINKLE_SMALL_MIN);
    }

    twinklePhase[i] = Math.random() * Math.PI * 2;
    baseBrightness[i] = BRIGHTNESS_MIN + Math.random() * (BRIGHTNESS_MAX - BRIGHTNESS_MIN);

    // Generate per-star drift multiplier (clamped to reduce speed variance)
    // Range: [1 - DRIFT_JITTER_MAX, 1 + DRIFT_JITTER_MAX] = [0.88, 1.12]
    const jitterRange = DRIFT_JITTER_MAX * 2;
    const jitterOffset = (Math.random() * jitterRange) - DRIFT_JITTER_MAX;
    driftMultiplier[i] = 1.0 + jitterOffset;

    // Generate star tint (color variety for background stars)
    // Distribution: 80% white, 10% blue, 7% amber, 3% red
    const tintRand = Math.random();
    let tintColor: number[];

    if (tintRand < TINT_PROB_WHITE) {
      tintColor = TINT_WHITE;
    } else if (tintRand < TINT_PROB_WHITE + TINT_PROB_BLUE) {
      tintColor = TINT_BLUE;
    } else if (tintRand < TINT_PROB_WHITE + TINT_PROB_BLUE + TINT_PROB_AMBER) {
      tintColor = TINT_AMBER;
    } else {
      tintColor = TINT_RED;
    }

    starTint[i * 3] = tintColor[0];
    starTint[i * 3 + 1] = tintColor[1];
    starTint[i * 3 + 2] = tintColor[2];

    // Generate streak amount (NEAR layer only)
    if (enableStreaks && STREAK_ENABLED) {
      if (Math.random() < STREAK_PROBABILITY) {
        streakAmount[i] = STREAK_MIN_LENGTH +
                         Math.random() * (STREAK_MAX_LENGTH - STREAK_MIN_LENGTH);
      } else {
        streakAmount[i] = 0.0;
      }
    } else {
      streakAmount[i] = 0.0;
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setAttribute("size", new THREE.BufferAttribute(size, 1));
  g.setAttribute("twinklePhase", new THREE.BufferAttribute(twinklePhase, 1));
  g.setAttribute("twinkleAmp", new THREE.BufferAttribute(twinkleAmp, 1));
  g.setAttribute("baseBrightness", new THREE.BufferAttribute(baseBrightness, 1));
  g.setAttribute("starType", new THREE.BufferAttribute(starType, 1));
  g.setAttribute("streakAmount", new THREE.BufferAttribute(streakAmount, 1));  // NEW
  g.setAttribute("driftMultiplier", new THREE.BufferAttribute(driftMultiplier, 1));  // NEW
  g.setAttribute("starTint", new THREE.BufferAttribute(starTint, 3));  // NEW: RGB tint per star

  return g;
}

/**
 * Creates buffer geometry for background galaxy layer
 * Similar to createStarLayerGeometry but with galaxy-specific attributes
 */
function createBackgroundGalaxyGeometry(
  count: number,
  radius: number,
  exclusionRadius: number
): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const opacity = new Float32Array(count);
  const rotation = new Float32Array(count);
  const tightness = new Float32Array(count);
  const galaxyType = new Float32Array(count);     // 0 = spiral, 1 = elliptical
  const galaxyColor = new Float32Array(count * 3); // RGB per galaxy
  const driftMultiplier = new Float32Array(count); // Per-galaxy drift variance

  for (let i = 0; i < count; i++) {
    // Generate random spherical position (same algorithm as stars)
    let theta = Math.random() * Math.PI * 2;
    let phi = Math.acos(2 * Math.random() - 1);
    let r = radius * Math.cbrt(Math.random());

    let x = r * Math.sin(phi) * Math.cos(theta);
    let y = r * Math.sin(phi) * Math.sin(theta);
    let z = r * Math.cos(phi);

    // EXCLUSION ZONE: Push galaxies away from origin (ship position)
    const dist = Math.sqrt(x * x + y * y + z * z);
    if (dist < exclusionRadius) {
      const pushFactor = exclusionRadius / dist;
      x *= pushFactor * (1.0 + Math.random() * 0.2);  // Add jitter
      y *= pushFactor * (1.0 + Math.random() * 0.2);
      z *= pushFactor * (1.0 + Math.random() * 0.2);
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Size variation (18-60px range)
    size[i] = GALAXY_BG_SIZE_MIN + Math.random() * (GALAXY_BG_SIZE_MAX - GALAXY_BG_SIZE_MIN);

    // Opacity variation (0.3-0.5 range for subtlety)
    opacity[i] = GALAXY_BG_OPACITY_MIN + Math.random() * (GALAXY_BG_OPACITY_MAX - GALAXY_BG_OPACITY_MIN);

    // Random rotation (0 to 2π)
    rotation[i] = GALAXY_BG_ROTATION_MIN + Math.random() * (GALAXY_BG_ROTATION_MAX - GALAXY_BG_ROTATION_MIN);

    // Spiral tightness (looser than interactive galaxies)
    tightness[i] = GALAXY_BG_TIGHTNESS_MIN + Math.random() * (GALAXY_BG_TIGHTNESS_MAX - GALAXY_BG_TIGHTNESS_MIN);

    // Galaxy type: 70% spiral, 30% elliptical
    galaxyType[i] = Math.random() < GALAXY_BG_PROB_SPIRAL ? 0.0 : 1.0;

    // Color selection (60% blue, 30% purple, 10% cyan)
    const colorRand = Math.random();
    let color: number[];
    if (colorRand < GALAXY_BG_PROB_BLUE) {
      color = GALAXY_BG_COLOR_BLUE;
    } else if (colorRand < GALAXY_BG_PROB_BLUE + GALAXY_BG_PROB_PURPLE) {
      color = GALAXY_BG_COLOR_PURPLE;
    } else {
      color = GALAXY_BG_COLOR_CYAN;
    }

    galaxyColor[i * 3] = color[0];
    galaxyColor[i * 3 + 1] = color[1];
    galaxyColor[i * 3 + 2] = color[2];

    // Drift multiplier (same pattern as stars for cohesive motion)
    const jitterRange = DRIFT_JITTER_MAX * 2;
    const jitterOffset = (Math.random() * jitterRange) - DRIFT_JITTER_MAX;
    driftMultiplier[i] = 1.0 + jitterOffset;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setAttribute("size", new THREE.BufferAttribute(size, 1));
  g.setAttribute("opacity", new THREE.BufferAttribute(opacity, 1));
  g.setAttribute("rotation", new THREE.BufferAttribute(rotation, 1));
  g.setAttribute("tightness", new THREE.BufferAttribute(tightness, 1));
  g.setAttribute("galaxyType", new THREE.BufferAttribute(galaxyType, 1));
  g.setAttribute("galaxyColor", new THREE.BufferAttribute(galaxyColor, 3));
  g.setAttribute("driftMultiplier", new THREE.BufferAttribute(driftMultiplier, 1));

  return g;
}

function StarLayer({
  layerIndex,
  geometry,
  parallaxFactor,
  baseOpacity,
  blendMode,
  reducedMotion,
  fragmentShader = starFragmentShader,  // NEW: Allow custom fragment shader (default to standard)
}: {
  layerIndex: number;
  geometry: THREE.BufferGeometry;
  parallaxFactor: number;
  baseOpacity: number;
  blendMode: THREE.Blending;
  reducedMotion: boolean;
  fragmentShader?: string;  // NEW: Optional custom shader
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
    }
  });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTwinkleScale: { value: reducedMotion ? 0.3 : 1 },
      uReducedMotion: { value: reducedMotion ? 1 : 0 },
      uDriftDir: { value: DRIFT_DIR },
      uParallax: { value: parallaxFactor },
      uDriftSpeed: { value: DRIFT_SPEED_GLOBAL },
      uDriftSpeedMax: { value: DRIFT_SPEED_MAX },
      uTurbulence: { value: TURBULENCE_ENABLED ? TURBULENCE_AMPLITUDE : 0.0 },
      uWrapRadius: { value: WRAP_RADIUS },
      uBaseOpacity: { value: baseOpacity },
    }),
    [reducedMotion, parallaxFactor, baseOpacity]
  );

  return (
    <points ref={pointsRef} geometry={geometry}>
      <shaderMaterial
        ref={matRef}
        vertexShader={starVertexShader}
        fragmentShader={fragmentShader}  // Use provided shader (default or custom)
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={blendMode}
      />
    </points>
  );
}

function generateInteractiveObjects(includeTestCenter = false): CosmicObject[] {
  const kinds: CosmicObjectKind[] = [
    "star",
    "star",
    "star",
    "star",
    "galaxy",
    "galaxy",
    "galaxy",
    "galaxy",
    "galaxy",
    "galaxy",
    "galaxy",
    "galaxy",
    "asteroid",
    "asteroid",
    "asteroid",
    "asteroid",
    "comet",
    "comet",
  ];
  const out: CosmicObject[] = [];
  if (includeTestCenter) {
    out.push({
      id: "cosmic-test-center",
      kind: "star",
      position: [0, 0, -2],
      rarityTier: 1,
    });
  }
  const radius = WRAP_RADIUS * 0.7;
  const start = out.length;
  for (let i = start; i < INTERACTIVE_COUNT + start; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = radius * (0.3 + 0.7 * Math.random());
    const kind = kinds[(i - start) % kinds.length];
    out.push({
      id: `cosmic-${kind}-${i}`,
      kind,
      position: [
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      ],
      rarityTier: 1,
    });
  }

  // POST-PROCESS: Guarantee at least 3 galaxies in central 60% of viewport
  // Camera is at [0, 0, 8] looking at origin
  // Central 60% viewport ≈ NDC coords within [-0.6, 0.6] for x and y

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 8);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  // Helper to check if object is in central viewport region
  const isInCentralRegion = (obj: CosmicObject): boolean => {
    const pos = new THREE.Vector3(...obj.position);
    pos.project(camera);
    // Check if NDC coords are within central 60% (±0.6 range)
    return Math.abs(pos.x) <= 0.6 && Math.abs(pos.y) <= 0.6;
  };

  // Count central galaxies
  const galaxies = out.filter(o => o.kind === "galaxy");
  const centralGalaxies = galaxies.filter(isInCentralRegion);
  const minCentralGalaxies = 3;

  if (centralGalaxies.length < minCentralGalaxies) {
    // Need to reposition some galaxies to central region
    const deficit = minCentralGalaxies - centralGalaxies.length;
    const peripheralGalaxies = galaxies.filter(g => !isInCentralRegion(g));

    // Reposition first 'deficit' peripheral galaxies to central region
    for (let i = 0; i < Math.min(deficit, peripheralGalaxies.length); i++) {
      const galaxy = peripheralGalaxies[i];

      // Generate position in central viewport region
      // Using rejection sampling: generate random positions until one projects to center
      let attempts = 0;
      let newPos: [number, number, number];

      do {
        // Random spherical coords
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        // Bias toward mid-depth range (keep varied z-distribution)
        const r = radius * (0.4 + 0.3 * Math.random()); // 0.4-0.7 range

        newPos = [
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi),
        ];

        attempts++;
        if (attempts > 50) {
          // Fallback: place near center with random offset
          newPos = [
            (Math.random() - 0.5) * 2,  // ±1 range
            (Math.random() - 0.5) * 2,
            -1 - Math.random() * 2,     // -1 to -3 depth
          ];
          break;
        }
      } while (!isInCentralRegion({ ...galaxy, position: newPos }));

      // Update galaxy position (preserves ID and stats determinism)
      galaxy.position = newPos;
    }
  }

  return out;
}

function InteractiveLayer({
  groupRef,
  objects,
  reducedMotion,
  debugMode,
  hoveredObjectId,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
  objects: CosmicObject[];
  reducedMotion: boolean;
  debugMode?: boolean;
  hoveredObjectId?: string | null;
}) {
  const meshRef = useRef<THREE.Points>(null);

  // Set ready flag after component mounts (for E2E testing)
  useEffect(() => {
    if (debugMode && typeof window !== "undefined") {
      (window as unknown as { __COSMIC_LAYER_READY__?: boolean }).__COSMIC_LAYER_READY__ = true;
    }
  }, [debugMode]);

  const geometry = useMemo(() => {
    const pos = new Float32Array(objects.length * 3);
    const size = new Float32Array(objects.length);
    const objectKind = new Float32Array(objects.length);

    objects.forEach((o, i) => {
      pos[i * 3] = o.position[0];
      pos[i * 3 + 1] = o.position[1];
      pos[i * 3 + 2] = o.position[2];

      // Size based on object kind
      if (o.kind === 'galaxy') {
        size[i] = 8.0 + Math.random() * 4.0;  // Galaxies: 8-12 base size (larger than stars)
      } else {
        size[i] = o.id === "cosmic-test-center"
          ? (debugMode ? 15 : 6)  // Increased from 5 to 6 for easier clicking
          : 3.0 + Math.random() * 2.0;  // Stars/asteroids/comets: 3-5 base size
      }

      // Encode kind as float for shader
      const kindMap: Record<CosmicObjectKind, number> = {
        'star': 0.0,
        'galaxy': 1.0,
        'asteroid': 2.0,
        'comet': 3.0,
      };
      objectKind[i] = kindMap[o.kind] || 0.0;
    });

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("size", new THREE.BufferAttribute(size, 1));
    g.setAttribute("objectKind", new THREE.BufferAttribute(objectKind, 1));
    return g;
  }, [objects, debugMode]);

  const timeRef = useRef(0);
  useFrame((_, delta) => {
    if (matRef.current) {
      if (!reducedMotion) {
        matRef.current.uniforms.uTime.value = (timeRef.current += delta);
      }
      // Update hover index
      const hoveredIdx = hoveredObjectId
        ? objects.findIndex(obj => obj.id === hoveredObjectId)
        : -1;
      matRef.current.uniforms.uHoveredIndex.value = hoveredIdx;
    }
  });

  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBright: { value: reducedMotion ? 0.6 : INTERACTIVE_BRIGHTNESS_MULT },
      uDriftDir: { value: DRIFT_DIR },
      uParallax: { value: PARALLAX_INTERACTIVE },
      uDriftSpeed: { value: DRIFT_SPEED_GLOBAL },
      uTurbulence: { value: TURBULENCE_ENABLED ? TURBULENCE_AMPLITUDE : 0.0 },
      uWrapRadius: { value: WRAP_RADIUS },
      uReducedMotion: { value: (reducedMotion || debugMode) ? 1 : 0 },  // Disable drift in debug mode
      uHoveredIndex: { value: -1 },  // NEW: Add hover index uniform
    }),
    [reducedMotion, debugMode]
  );

  return (
    <group ref={groupRef} name="interactiveLayer">
      <points ref={meshRef} geometry={geometry}>
        <shaderMaterial
          ref={matRef}
          vertexShader={`
            attribute float size;
            attribute float objectKind;
            uniform float uTime;
            uniform float uBright;
            uniform vec3 uDriftDir;
            uniform float uParallax;
            uniform float uDriftSpeed;
            uniform float uTurbulence;
            uniform float uWrapRadius;
            uniform float uReducedMotion;
            uniform float uHoveredIndex;
            varying float vA;
            varying float vIsHovered;
            varying float vObjectKind;

            vec3 computeTurbulence(vec3 pos, float time) {
              float noiseX = sin(pos.x * 0.1 + time * 0.05) * cos(pos.z * 0.08);
              float noiseY = cos(pos.y * 0.12 + time * 0.04) * sin(pos.x * 0.09);
              float noiseZ = sin(pos.z * 0.11 + time * 0.06) * cos(pos.y * 0.07);
              return vec3(noiseX, noiseY, noiseZ);
            }

            vec3 wrapSphere(vec3 pos, float radius) {
              float dist = length(pos);
              if (dist > radius) {
                return -normalize(pos) * (radius * 0.8);
              }
              return pos;
            }

            void main() {
              vec3 pos = position;

              if (uReducedMotion < 0.5) {
                vec3 drift = uDriftDir * uTime * uParallax * uDriftSpeed;
                pos += drift;

                if (uTurbulence > 0.0) {
                  vec3 turbulence = computeTurbulence(position, uTime) * uTurbulence;
                  pos += turbulence;
                }

                pos = wrapSphere(pos, uWrapRadius);
              }

              vec4 mv = modelViewMatrix * vec4(pos, 1.0);
              gl_Position = projectionMatrix * mv;

              // Check if this vertex is hovered
              float isHovered = (float(gl_VertexID) == uHoveredIndex) ? 1.0 : 0.0;
              vIsHovered = isHovered;

              // Boost brightness by 20% when hovered
              vA = uBright * (0.75 + 0.25 * sin(uTime * 2.0)) * (1.0 + isHovered * 0.2);

              // SIZE DIFFERENTIATION: Galaxies are 2.8x larger
              float baseSize = size;
              if (objectKind > 0.5 && objectKind < 1.5) {
                baseSize *= 2.8;
              }

              // Apply hover multiplier
              float sizeMultiplier = 1.0 + isHovered * 0.35;
              float computedSize = baseSize * sizeMultiplier * (250.0 / -mv.z);

              // Increase max clamp for galaxies
              gl_PointSize = (objectKind > 0.5 && objectKind < 1.5)
                ? clamp(computedSize, 8.0, 24.0)  // Galaxies: larger max size
                : clamp(computedSize, 3.0, 12.0); // Stars/asteroids/comets

              // Pass objectKind to fragment shader
              vObjectKind = objectKind;
            }
          `}
          fragmentShader={`
            varying float vA;
            varying float vIsHovered;
            varying float vObjectKind;

            // Spiral galaxy pattern function
            float galaxySpiral(vec2 coord, float rotation, float tightness) {
              float angle = atan(coord.y, coord.x);
              float dist = length(coord);

              // Logarithmic spiral pattern
              float spiral = sin(angle * 3.0 + rotation - dist * tightness * 15.0);

              // Fade with distance
              float fade = 1.0 - smoothstep(0.0, 0.5, dist);

              return max(0.0, spiral) * fade;
            }

            void main() {
              vec2 coord = gl_PointCoord - 0.5;
              float dist = length(coord);

              // GALAXY RENDERING (objectKind ≈ 1.0)
              if (vObjectKind > 0.5 && vObjectKind < 1.5) {
                // Core glow (bright center)
                float core = smoothstep(0.5, 0.0, dist * 2.5) * 1.2;

                // Multiple spiral arms with different rotations
                float spiral1 = galaxySpiral(coord, 0.0, 1.0);
                float spiral2 = galaxySpiral(coord, 2.094, 1.0);  // 120° offset
                float spiral3 = galaxySpiral(coord, 4.189, 1.0);  // 240° offset

                // Combine spirals
                float spirals = (spiral1 + spiral2 + spiral3) * 0.4;

                // Diffuse glow (larger soft halo)
                float glow = smoothstep(0.6, 0.0, dist) * 0.3;

                // Combine all components
                float galaxyAlpha = core + spirals + glow;

                // Add hover glow
                float hoverGlow = vIsHovered * smoothstep(0.8, 0.3, dist) * 0.3;
                float finalAlpha = (galaxyAlpha * vA * 0.45) + hoverGlow;

                // Galaxy color: subtle blue-purple tint (vs pure white stars)
                vec3 galaxyColor = vec3(0.85, 0.90, 1.0);  // Cool blue tint

                // Mix in some purple in the core
                float purpleMix = core * 0.3;
                galaxyColor = mix(galaxyColor, vec3(0.9, 0.8, 1.0), purpleMix);

                gl_FragColor = vec4(galaxyColor, finalAlpha);
              }
              // STAR RENDERING (objectKind ≈ 0.0)
              else {
                float coreAlpha = smoothstep(0.6, 0.0, dist);
                float glowAlpha = vIsHovered * smoothstep(0.8, 0.3, dist) * 0.3;
                float finalAlpha = (coreAlpha * vA * ${INTERACTIVE_BASE_OPACITY.toFixed(2)}) + glowAlpha;
                vec3 color = vec3(1.0, 1.0, 1.0);  // Pure white for stars
                gl_FragColor = vec4(color, finalAlpha);
              }
            }
          `}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

function NebulaLayer({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const timeRef = useRef(0);

  const geom = useMemo(
    () => new THREE.PlaneGeometry(WRAP_RADIUS * 4, WRAP_RADIUS * 4),
    []
  );

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDriftDir: { value: DRIFT_DIR },
      uParallax: { value: PARALLAX_NEBULA },
      uDriftSpeed: { value: DRIFT_SPEED_GLOBAL },
      uReducedMotion: { value: reducedMotion ? 1 : 0 },
      uNebulaIntensity: { value: NEBULA_INTENSITY },
      uNebulaScale: { value: NEBULA_SCALE },
      uCenterFade: { value: NEBULA_CENTER_FADE },
      uDriftSpeedNebula: { value: NEBULA_DRIFT_SPEED },
      uColorCyan: { value: new THREE.Vector3(...NEBULA_COLOR_CYAN) },
      uColorPurple: { value: new THREE.Vector3(...NEBULA_COLOR_PURPLE) },
      uColorAmber: { value: new THREE.Vector3(...NEBULA_COLOR_AMBER) },
    }),
    [reducedMotion]
  );

  useFrame((_, delta) => {
    if (matRef.current) {
      timeRef.current += delta;
      matRef.current.uniforms.uTime.value = timeRef.current;
    }
  });

  return (
    <mesh ref={ref} geometry={geom} position={[0, 0, -WRAP_RADIUS * 0.5]}>
      <shaderMaterial
        ref={matRef}
        vertexShader={`
          uniform float uTime;
          uniform vec3 uDriftDir;
          uniform float uParallax;
          uniform float uDriftSpeed;
          uniform float uReducedMotion;
          uniform float uDriftSpeedNebula;
          varying vec2 vUv;
          varying vec3 vWorldPos;

          void main() {
            vUv = uv;

            vec3 pos = position;

            // Apply drift (extremely subtle for nebula)
            if (uReducedMotion < 0.5) {
              vec3 drift = uDriftDir * uTime * uDriftSpeedNebula;
              pos += drift;
            }

            vec4 worldPos = modelMatrix * vec4(pos, 1.0);
            vWorldPos = worldPos.xyz;

            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform float uReducedMotion;
          uniform float uNebulaIntensity;
          uniform float uNebulaScale;
          uniform float uCenterFade;
          uniform vec3 uColorCyan;
          uniform vec3 uColorPurple;
          uniform vec3 uColorAmber;
          varying vec2 vUv;
          varying vec3 vWorldPos;

          // Simple 2D noise function (hash-based)
          float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }

          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);

            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));

            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
          }

          // FBM (Fractal Brownian Motion)
          float fbm(vec2 p) {
            float value = 0.0;
            float amplitude = 0.5;
            float frequency = 1.0;

            for (int i = 0; i < 5; i++) {
              value += amplitude * noise(p * frequency);
              frequency *= 2.0;
              amplitude *= 0.5;
            }

            return value;
          }

          void main() {
            vec2 uv = vUv * 2.0 - 1.0;
            float t = uReducedMotion > 0.5 ? 0.0 : uTime * 0.01;

            // Generate cloud blobs at different scales (using NEBULA_SCALE)
            float cloud1 = fbm(vUv * uNebulaScale * 1.2 + vec2(t * 0.5, t * 0.3));
            float cloud2 = fbm(vUv * uNebulaScale * 1.8 + vec2(-t * 0.3, t * 0.4));
            float cloud3 = fbm(vUv * uNebulaScale * 0.9 + vec2(t * 0.2, -t * 0.25));

            float clouds = (cloud1 + cloud2 * 0.7 + cloud3 * 0.5) / 2.2;

            // Increase cloud contrast for visibility
            clouds = pow(clouds, 1.8);

            // Radial center fade (calm center for portfolio)
            float r = length(uv);
            float mask = smoothstep(0.0, 1.0, r * uCenterFade);
            mask = pow(mask, 1.5);  // Optional: sharper falloff toward center

            // Color mixing based on cloud density
            vec3 nebulaColor;

            // Base: cyan/blue
            nebulaColor = uColorCyan;

            // Mix in purple core pockets where clouds are dense
            float purpleMix = smoothstep(0.4, 0.7, cloud1) * 0.6;
            nebulaColor = mix(nebulaColor, uColorPurple, purpleMix);

            // Rare amber highlights in very dense regions
            float amberMix = smoothstep(0.7, 0.9, cloud2) * 0.3;
            nebulaColor = mix(nebulaColor, uColorAmber, amberMix);

            // Desaturate slightly for portfolio-first aesthetic
            float luminance = dot(nebulaColor, vec3(0.299, 0.587, 0.114));
            nebulaColor = mix(nebulaColor, vec3(luminance), 0.3);

            // Apply center fade (stronger at edges, calm at center)
            nebulaColor *= mask;

            // Final opacity based on NEBULA_INTENSITY and cloud density
            float alpha = uNebulaIntensity * (0.5 + clouds * 0.5) * mask;

            gl_FragColor = vec4(nebulaColor, alpha);
          }
        `}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function BackgroundGalaxyLayer({
  geometry,
  reducedMotion,
}: {
  geometry: THREE.BufferGeometry;
  reducedMotion: boolean;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
    }
  });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uReducedMotion: { value: reducedMotion ? 1 : 0 },
      uDriftDir: { value: DRIFT_DIR },
      uParallax: { value: PARALLAX_BACKGROUND_GALAXY },
      uDriftSpeed: { value: DRIFT_SPEED_GLOBAL },
      uDriftSpeedMax: { value: DRIFT_SPEED_MAX },
      uTurbulence: { value: TURBULENCE_ENABLED ? TURBULENCE_AMPLITUDE : 0.0 },
      uWrapRadius: { value: WRAP_RADIUS },
    }),
    [reducedMotion]
  );

  return (
    <points ref={pointsRef} geometry={geometry} name="backgroundGalaxyLayer">
      <shaderMaterial
        ref={matRef}
        vertexShader={backgroundGalaxyVertexShader}
        fragmentShader={backgroundGalaxyFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function RefCapture({
  cameraRef,
  sceneRef,
  debugMode,
}: {
  cameraRef: React.RefObject<THREE.Camera | null>;
  sceneRef: React.RefObject<THREE.Scene | null>;
  debugMode?: boolean;
}) {
  const { camera, scene } = useThree();
  useEffect(() => {
    cameraRef.current = camera;
    sceneRef.current = scene;
    if (debugMode && typeof window !== "undefined") {
      (window as unknown as { __COSMIC_CAMERA_READY__?: boolean }).__COSMIC_CAMERA_READY__ = true;
    }
    return () => {
      cameraRef.current = null;
      sceneRef.current = null;
    };
  }, [camera, scene, cameraRef, sceneRef, debugMode]);
  return null;
}

function CameraOscillation({
  cameraRef,
  reducedMotion,
  debugMode,
}: {
  cameraRef: React.RefObject<THREE.Camera | null>;
  reducedMotion: boolean;
  debugMode: boolean;
}) {
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    // CRITICAL: Disable in debug mode for E2E test accuracy
    if (reducedMotion || !CAMERA_OSCILLATION_ENABLED || debugMode) return;
    const cam = cameraRef.current;
    if (!cam) return;

    timeRef.current += delta;
    const t = timeRef.current;

    // Subtle yaw (horizontal sway) - enhanced amplitude
    const yaw = Math.sin(t * CAMERA_YAW_FREQUENCY * Math.PI * 2) * CAMERA_YAW_AMPLITUDE;

    // Subtle pitch (vertical bob) - enhanced amplitude
    const pitch = Math.sin(t * CAMERA_PITCH_FREQUENCY * Math.PI * 2) * CAMERA_PITCH_AMPLITUDE;

    // NEW: Very subtle roll (adds 3D depth perception)
    const roll = Math.sin(t * CAMERA_ROLL_FREQUENCY * Math.PI * 2) * CAMERA_ROLL_AMPLITUDE;

    // Apply rotation (Euler angles, order matters)
    cam.rotation.order = 'YXZ'; // Yaw, Pitch, Roll
    cam.rotation.y = yaw;
    cam.rotation.x = pitch;
    cam.rotation.z = roll;  // NEW: Roll component
  });

  return null;
}

function ShootingStar({
  reducedMotion,
  cameraRef
}: {
  reducedMotion: boolean;
  cameraRef: React.RefObject<THREE.Camera | null>;
}) {
  const lineRef = useRef<THREE.Line>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const [active, setActive] = useState(false);

  // State refs
  const startTime = useRef(0);
  const duration = useRef(0);
  const startPos = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());

  const spawnMeteor = useCallback(() => {
    if (reducedMotion) return;

    const camera = cameraRef.current;
    if (!camera) return;  // Early exit if camera not ready

    // Pick random start edge
    const startEdge = Math.floor(Math.random() * 4) as MeteorEdge;

    // Pick different end edge (3 remaining choices)
    const remainingEdges = [0, 1, 2, 3].filter(e => e !== startEdge);
    const endEdge = remainingEdges[Math.floor(Math.random() * 3)] as MeteorEdge;

    // Generate random positions along edges (-1 to 1 range)
    const startOffset = (Math.random() * 2 - 1);  // Full range: -1 to 1
    const endOffset = (Math.random() * 2 - 1);

    // Calculate world positions using helper
    startPos.current.copy(getEdgePosition(startEdge, startOffset, camera));
    const endPos = getEdgePosition(endEdge, endOffset, camera);

    // Calculate direction vector (normalized)
    direction.current.copy(endPos).sub(startPos.current).normalize();

    // Randomize duration (0.6-1.2s)
    duration.current = METEOR_MIN_DURATION +
                       Math.random() * (METEOR_MAX_DURATION - METEOR_MIN_DURATION);

    startTime.current = 0;
    setActive(true);
  }, [reducedMotion, cameraRef]);

  // Timer for spawning
  useEffect(() => {
    if (reducedMotion) return;

    const scheduleNext = () => {
      // Detect mobile based on viewport width (consistent with DPR logic)
      const isMobile = typeof window !== 'undefined' &&
                       window.innerWidth < DPR_MOBILE_BREAKPOINT;

      const minInterval = isMobile ? METEOR_MIN_INTERVAL_MOBILE : METEOR_MIN_INTERVAL_DESKTOP;
      const maxInterval = isMobile ? METEOR_MAX_INTERVAL_MOBILE : METEOR_MAX_INTERVAL_DESKTOP;

      const delay = (minInterval + Math.random() * (maxInterval - minInterval)) * 1000;
      return setTimeout(() => spawnMeteor(), delay);
    };

    let timer = scheduleNext();
    return () => clearTimeout(timer);
  }, [spawnMeteor, reducedMotion]);

  // Animation loop
  useFrame((_, delta) => {
    if (!active || !lineRef.current || !materialRef.current) return;

    startTime.current += delta;
    const t = startTime.current / duration.current;

    if (t >= 1.0) {
      setActive(false);
      return;
    }

    // Update position
    const currentPos = startPos.current.clone()
      .add(direction.current.clone().multiplyScalar(t * METEOR_SPEED));
    const endPos = currentPos.clone()
      .add(direction.current.clone().multiplyScalar(-METEOR_TRAIL_LENGTH));

    const positions = lineRef.current.geometry.attributes.position;
    positions.setXYZ(0, currentPos.x, currentPos.y, currentPos.z);
    positions.setXYZ(1, endPos.x, endPos.y, endPos.z);
    positions.needsUpdate = true;

    // Fade in/out
    const fadeIn = Math.min(t * 4, 1.0);
    const fadeOut = Math.max(1.0 - (t - 0.7) * 3.3, 0.0);
    const alpha = fadeIn * fadeOut * METEOR_BRIGHTNESS;
    materialRef.current.uniforms.uAlpha.value = alpha;
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(6); // 2 vertices * 3 coords
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  const uniforms = useMemo(() => ({ uAlpha: { value: 0.0 } }), []);

  if (!active) return null;

  return (
    <line ref={lineRef} geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={`
          void main() {
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uAlpha;
          void main() {
            gl_FragColor = vec4(1.0, 1.0, 0.9, uAlpha);
          }
        `}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </line>
  );
}

interface CosmicBackgroundSceneProps {
  onSelect?: (detail: CosmicObjectSelectedDetail) => void;
  debugCaptureSelect?: boolean;
  testCenterObject?: boolean;
}

const getInteractiveObjects = (testCenter: boolean): CosmicObject[] =>
  generateInteractiveObjects(testCenter);

export default function CosmicBackgroundScene({
  onSelect,
  debugCaptureSelect: debugCaptureSelectProp = false,
  testCenterObject: testCenterObjectProp = false,
}: CosmicBackgroundSceneProps) {
  // For static builds, read debug mode from client-side URL
  const [debugCaptureSelect, setDebugCaptureSelect] = useState(debugCaptureSelectProp);
  const [testCenterObject, setTestCenterObject] = useState(testCenterObjectProp);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const debugMode = params.get("cosmic-debug") === "1";
      if (debugMode) {
        setDebugCaptureSelect(true);
        setTestCenterObject(true);
      }
    }
  }, []);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const interactiveGroupRef = useRef<THREE.Group | null>(null);
  const reducedMotion = useReducedMotion();
  const interactiveObjects = useMemo(
    () => getInteractiveObjects(testCenterObject),
    [testCenterObject]
  );

  const geos = useMemo(
    () => ({
      far: createStarLayerGeometry(STAR_COUNT_FAR, WRAP_RADIUS, EXCLUSION_RADIUS, false),
      mid: createStarLayerGeometry(STAR_COUNT_MID, WRAP_RADIUS * 0.7, EXCLUSION_RADIUS * 0.7, false),
      near: createStarLayerGeometry(STAR_COUNT_NEAR, WRAP_RADIUS * 0.6, EXCLUSION_RADIUS * 0.5, true), // Enable streaks for NEAR layer
      backgroundGalaxy: createBackgroundGalaxyGeometry(
        GALAXY_BG_COUNT,
        WRAP_RADIUS,
        EXCLUSION_RADIUS * 1.2  // Keep galaxies farther from ship
      ),
    }),
    []
  );

  // Hover state for interactive objects
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
  const [reticlePosition, setReticlePosition] = useState<{ x: number; y: number } | null>(null);
  const lastHoverIdRef = useRef<string | null>(null);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest("button, a, [role=button], input, [contenteditable=true]")
      )
        return;
      const canvas = wrapperRef.current?.querySelector("canvas");
      const cam = cameraRef.current;
      const scene = sceneRef.current;
      const group = interactiveGroupRef.current;
      if (!canvas || !cam || !scene || !group) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || x > rect.width || y < 0 || y > rect.height) return;
      const ndx = (x / rect.width) * 2 - 1;
      const ndy = -((y / rect.height) * 2 - 1);
      const raycaster = new THREE.Raycaster();
      // Reduced threshold to prevent false positives on empty space
      // Higher values = larger click radius (more forgiving but more false positives)
      raycaster.params.Points = { threshold: debugCaptureSelect ? 3 : 5 };
      const mouse = new THREE.Vector2(ndx, ndy);

      // Temporarily reset camera rotation for accurate raycasting
      const originalRotation = cam.rotation.clone();
      cam.rotation.set(0, 0, 0);
      raycaster.setFromCamera(mouse, cam);
      const hits = raycaster.intersectObjects(group.children, true);
      cam.rotation.copy(originalRotation);  // Restore rotation
      if (hits.length === 0) return;

      // In debug mode, prefer the star closest to canvas center (for E2E test accuracy)
      let hit = hits[0];
      if (debugCaptureSelect && hits.length > 1) {
        hit = hits.reduce((closest, current) => {
          const closestIdx = closest.index ?? 0;
          const currentIdx = current.index ?? 0;
          const closestObj = interactiveObjects[closestIdx];
          const currentObj = interactiveObjects[currentIdx];

          // Project both to NDC and find distance from center
          const closestPos = new THREE.Vector3(...closestObj.position);
          const currentPos = new THREE.Vector3(...currentObj.position);
          closestPos.project(cam);
          currentPos.project(cam);

          const closestDist = Math.sqrt(closestPos.x ** 2 + closestPos.y ** 2);
          const currentDist = Math.sqrt(currentPos.x ** 2 + currentPos.y ** 2);

          return currentDist < closestDist ? current : closest;
        }, hits[0]);
      }

      const pointIndex = hit.index ?? 0;
      const obj = interactiveObjects[pointIndex];

      // CRITICAL: Validate object exists and index is valid
      if (!obj || pointIndex < 0 || pointIndex >= interactiveObjects.length) {
        console.warn('Invalid object click detected - ignoring');
        return;
      }

      // Additional validation: check distance from camera (reject too-far clicks)
      const hitDistance = hit.distance;
      if (hitDistance > WRAP_RADIUS * 1.5) {
        console.warn('Click too far from valid objects - ignoring');
        return;
      }

      const detail: CosmicObjectSelectedDetail = {
        id: obj.id,
        kind: obj.kind,
        position: [...obj.position],
        screen: { x: e.clientX, y: e.clientY },
        timestamp: Date.now(),
      };

      console.log(`✅ Valid click on object: ${obj.id} (${obj.kind})`);

      window.dispatchEvent(
        new CustomEvent(COSMIC_OBJECT_SELECTED_EVENT, { detail })
      );
      onSelect?.(detail);
      if (debugCaptureSelect && typeof window !== "undefined") {
        (window as unknown as { __LAST_COSMIC_SELECT__?: CosmicObjectSelectedDetail }).__LAST_COSMIC_SELECT__ = detail;
      }
    },
    [onSelect, debugCaptureSelect, interactiveObjects]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const canvas = wrapperRef.current?.querySelector("canvas");
      const cam = cameraRef.current;
      const group = interactiveGroupRef.current;
      if (!canvas || !cam || !group) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check if mouse is outside canvas bounds
      if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
        if (lastHoverIdRef.current !== null) {
          lastHoverIdRef.current = null;
          setHoveredObjectId(null);
          setReticlePosition(null);  // Clear reticle
          canvas.style.cursor = "default";
        }
        return;
      }

      const ndx = (x / rect.width) * 2 - 1;
      const ndy = -((y / rect.height) * 2 - 1);
      const raycaster = new THREE.Raycaster();
      raycaster.params.Points = { threshold: 5 };
      const mouse = new THREE.Vector2(ndx, ndy);

      // Use same raycasting logic as click
      const originalRotation = cam.rotation.clone();
      cam.rotation.set(0, 0, 0);
      raycaster.setFromCamera(mouse, cam);
      const hits = raycaster.intersectObjects(group.children, true);
      cam.rotation.copy(originalRotation);

      if (hits.length > 0) {
        const pointIndex = hits[0].index ?? 0;
        const obj = interactiveObjects[pointIndex];
        if (obj && obj.id !== lastHoverIdRef.current) {
          lastHoverIdRef.current = obj.id;
          setHoveredObjectId(obj.id);
          setReticlePosition({ x: e.clientX, y: e.clientY });  // Set reticle position
          canvas.style.cursor = "pointer";

          // Dispatch hover event
          const hoverDetail = {
            id: obj.id,
            kind: obj.kind,
            screen: { x: e.clientX, y: e.clientY }
          };
          window.dispatchEvent(
            new CustomEvent("cosmic-object-hovered", { detail: hoverDetail })
          );
        } else if (obj) {
          // Same object, update reticle position for smooth tracking
          setReticlePosition({ x: e.clientX, y: e.clientY });
        }
      } else {
        if (lastHoverIdRef.current !== null) {
          lastHoverIdRef.current = null;
          setHoveredObjectId(null);
          setReticlePosition(null);  // Clear reticle
          canvas.style.cursor = "default";
          window.dispatchEvent(
            new CustomEvent("cosmic-object-hovered", { detail: null })
          );
        }
      }
    },
    [interactiveObjects]
  );

  useEffect(() => {
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [handleClick]);

  useEffect(() => {
    document.addEventListener("pointermove", handlePointerMove);
    return () => document.removeEventListener("pointermove", handlePointerMove);
  }, [handlePointerMove]);

  // Set aria-label on the actual canvas element (R3F doesn't pass it through)
  useEffect(() => {
    const canvas = wrapperRef.current?.querySelector("canvas");
    if (canvas) {
      canvas.setAttribute(
        "aria-label",
        "Cosmic background: starfield with discoverable stars and objects. Click brighter stars to explore."
      );
    }
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="cosmic-background-wrapper fixed inset-0"
      style={{ zIndex: "var(--z-starfield)", pointerEvents: "none" }}
      data-testid="cosmic-background"
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 75, near: 0.1, far: 100 }}
        dpr={[
          1,
          typeof window !== 'undefined' && window.innerWidth < DPR_MOBILE_BREAKPOINT
            ? DPR_MAX_MOBILE
            : DPR_MAX_DESKTOP
        ]}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "low-power",
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 1);
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.3;  // Increased for brighter stars
        }}
        frameloop="always"
        aria-label="Cosmic background: starfield with discoverable stars and objects. Click brighter stars to explore."
      >
        <RefCapture cameraRef={cameraRef} sceneRef={sceneRef} debugMode={debugCaptureSelect} />
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          enableZoom={true}
          enablePan={false}
          minDistance={2}
          maxDistance={20}
        />
        <CameraOscillation cameraRef={cameraRef} reducedMotion={reducedMotion} debugMode={debugCaptureSelect} />
        <color attach="background" args={[0x000000]} />
        <NebulaLayer reducedMotion={reducedMotion} />
        {/* TEMP DISABLED: Procedural background galaxies - will replace with real OpenNGC data */}
        {/* <BackgroundGalaxyLayer
          geometry={geos.backgroundGalaxy}
          reducedMotion={reducedMotion}
        /> */}

        {/* GAIA COMBINED LAYER - Hipparcos stars + Gaia galaxies */}
        <GaiaCombinedLayer
          baseOpacity={0.85}
          blendMode={THREE.AdditiveBlending}
          reducedMotion={reducedMotion}
        />

        <InteractiveLayer
          groupRef={interactiveGroupRef}
          objects={interactiveObjects}
          reducedMotion={reducedMotion}
          debugMode={debugCaptureSelect}
          hoveredObjectId={hoveredObjectId}
        />
        <ShootingStar reducedMotion={reducedMotion} cameraRef={cameraRef} />
      </Canvas>

      {/* Hover Reticle Overlay */}
      {!reducedMotion && reticlePosition && (
        <div
          className="pointer-events-none fixed z-[44]"
          style={{
            left: reticlePosition.x,
            top: reticlePosition.y,
            transform: "translate(-50%, -50%)",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 40 40" className="animate-pulse">
            {/* Outer ring */}
            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke="rgba(147, 197, 253, 0.6)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            {/* Inner crosshair */}
            <line x1="20" y1="8" x2="20" y2="14" stroke="rgba(147, 197, 253, 0.8)" strokeWidth="1.5" />
            <line x1="20" y1="26" x2="20" y2="32" stroke="rgba(147, 197, 253, 0.8)" strokeWidth="1.5" />
            <line x1="8" y1="20" x2="14" y2="20" stroke="rgba(147, 197, 253, 0.8)" strokeWidth="1.5" />
            <line x1="26" y1="20" x2="32" y2="20" stroke="rgba(147, 197, 253, 0.8)" strokeWidth="1.5" />
            {/* Center dot */}
            <circle cx="20" cy="20" r="2" fill="rgba(253, 224, 71, 0.9)" />
          </svg>
        </div>
      )}
    </div>
  );
}

export { getInteractiveObjects };
