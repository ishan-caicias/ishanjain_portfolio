/**
 * Real Star Layer - Renders stars from Hipparcos catalog
 * Uses actual celestial coordinates with pre-computed Cartesian positions
 */

import { useRef, useEffect, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { loadHipparcosStars, scaleHipparcosPositions, type HipparcosStar } from "@/utils/loadHipparcosData";

// Reuse existing constants from CosmicBackgroundScene
const WRAP_RADIUS = 12;
const DRIFT_SPEED_GLOBAL = 0.2;  // Reduced from 1.0 - much slower drift
// Drift direction: primarily horizontal (X), slight upward (Y), minimal depth (Z)
const DRIFT_DIR = new THREE.Vector3(1.0, 0.08, 0.35).normalize();

interface RealStarLayerProps {
  maxMagnitude?: number;      // Filter stars dimmer than this
  parallaxFactor: number;      // Drift speed multiplier
  baseOpacity: number;         // Base alpha value
  blendMode: THREE.Blending;   // Additive or Normal
  reducedMotion: boolean;      // Accessibility mode
}

/**
 * Map spectral type to RGB color
 * Based on star temperature (O = hottest/blue, M = coolest/red)
 */
function spectralTypeToRGB(spect?: string): [number, number, number] {
  if (!spect) return [1.0, 1.0, 1.0]; // White default

  const type = spect.charAt(0).toUpperCase();

  const colorMap: Record<string, [number, number, number]> = {
    'O': [0.6, 0.7, 1.0],    // Blue (very hot, >30,000 K)
    'B': [0.7, 0.85, 1.0],   // Blue-white (10,000-30,000 K)
    'A': [1.0, 1.0, 1.0],    // White (7,500-10,000 K)
    'F': [1.0, 1.0, 0.9],    // Yellow-white (6,000-7,500 K)
    'G': [1.0, 0.95, 0.7],   // Yellow (5,200-6,000 K) like Sun
    'K': [1.0, 0.85, 0.6],   // Orange (3,700-5,200 K)
    'M': [1.0, 0.7, 0.5],    // Red (2,400-3,700 K)
  };

  return colorMap[type] || [1.0, 1.0, 1.0];
}

/**
 * Create geometry from real HYG star data
 */
function createRealStarGeometry(stars: HYGStar[]): THREE.BufferGeometry {
  const count = stars.length;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const magnitudes = new Float32Array(count);
  const twinklePhases = new Float32Array(count);  // Random phase for twinkle
  const twinkleAmps = new Float32Array(count);    // Twinkle amplitude

  for (let i = 0; i < count; i++) {
    const star = stars[i];

    // Position: Rotate HYG coordinates 90° around Y-axis to align with camera
    // HYG: +X points to RA=0° (vernal equinox), cone pointing right
    // Three.js camera: looks toward -Z
    // Apply 90° Y-rotation: x' = -z, y' = y, z' = x
    positions[i * 3] = -star.z;      // -Z becomes X
    positions[i * 3 + 1] = star.y;   // Y stays Y
    positions[i * 3 + 2] = star.x;   // X becomes Z (now cone points toward camera)

    // Color based on spectral type
    const [r, g, b] = spectralTypeToRGB(star.spect);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;

    // Size based on magnitude (brighter stars = larger)
    // Magnitude scale: -1.44 (Sirius, brightest) to 8.0 (dimmest visible)
    // Invert: bright stars = small mag value = large size
    const normalizedMag = (8.0 - star.mag) / 9.44; // 0 (dim) to 1 (bright)
    // INCREASED: Make stars more prominent (was 0.3-1.8, now 0.6-3.0)
    sizes[i] = 0.6 + normalizedMag * 2.4; // Size range: 0.6-3.0

    magnitudes[i] = star.mag;

    // Twinkle parameters (random for each star)
    twinklePhases[i] = Math.random() * Math.PI * 2;
    // Brighter stars twinkle more (more noticeable)
    // INCREASED: More noticeable twinkle (was 0.1-0.25, now 0.15-0.35)
    twinkleAmps[i] = 0.15 + normalizedMag * 0.20; // Range: 0.15-0.35
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("magnitude", new THREE.BufferAttribute(magnitudes, 1));
  geometry.setAttribute("twinklePhase", new THREE.BufferAttribute(twinklePhases, 1));
  geometry.setAttribute("twinkleAmp", new THREE.BufferAttribute(twinkleAmps, 1));

  return geometry;
}

// Enhanced vertex shader with drift and twinkle
const vertexShader = `
  attribute float size;
  attribute float magnitude;
  attribute float twinklePhase;
  attribute float twinkleAmp;

  uniform float uTime;
  uniform float uReducedMotion;
  uniform vec3 uDriftDir;
  uniform float uParallax;
  uniform float uDriftSpeed;
  uniform float uWrapRadius;

  varying vec3 vColor;
  varying float vBrightness;

  // Spherical wrap-around for infinite scrolling
  vec3 wrapSphere(vec3 pos, float radius) {
    float dist = length(pos);
    if (dist > radius) {
      return -normalize(pos) * (radius * 0.8);
    }
    return pos;
  }

  void main() {
    vColor = color;

    vec3 pos = position;

    // TEMP DISABLED: Drift motion (debugging coordinate system)
    // if (uReducedMotion < 0.5) {
    //   vec3 drift = uDriftDir * uTime * uParallax * uDriftSpeed;
    //   pos += drift;
    //   pos = wrapSphere(pos, uWrapRadius);
    // }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Brightness with twinkle animation
    float baseBrightness = (8.0 - magnitude) / 9.44;
    float twinkle = uReducedMotion > 0.5
      ? 0.05
      : (sin(uTime * 1.2 + twinklePhase) * twinkleAmp + 1.0 - twinkleAmp);

    vBrightness = baseBrightness * twinkle;

    // Size scaling with distance
    float distanceFactor = -mvPosition.z;
    gl_PointSize = size * (200.0 / distanceFactor);
    gl_PointSize = clamp(gl_PointSize, 1.0, 4.0);
  }
`;

// Enhanced fragment shader with better falloff
const fragmentShader = `
  varying vec3 vColor;
  varying float vBrightness;
  uniform float uBaseOpacity;

  void main() {
    vec2 coord = gl_PointCoord - 0.5;
    float dist = length(coord);

    // Soft radial falloff with core brightness
    float core = smoothstep(0.5, 0.0, dist);
    float glow = smoothstep(0.6, 0.0, dist) * 0.3;
    float alpha = (core + glow) * vBrightness * uBaseOpacity;

    gl_FragColor = vec4(vColor, alpha);
  }
`;

export default function RealStarLayer({
  maxMagnitude = 7.0,  // Default: show ~25k brightest stars
  parallaxFactor,
  baseOpacity,
  blendMode,
  reducedMotion,
}: RealStarLayerProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const [stars, setStars] = useState<HipparcosStar[]>([]);
  const [loading, setLoading] = useState(true);

  // Load real star data on mount
  useEffect(() => {
    let cancelled = false;

    async function loadStars() {
      try {
        console.log('🚀 RealStarLayer: Starting to load Hipparcos stars...');
        const allStars = await loadHipparcosStars();

        if (cancelled) return;

        console.log(`📊 Loaded ${allStars.length.toLocaleString()} total stars, filtering to mag < ${maxMagnitude}...`);

        // Filter by magnitude
        const filtered = allStars.filter(s => s.mag <= maxMagnitude);

        console.log(`🔍 Filtered to ${filtered.length.toLocaleString()} stars, scaling positions...`);

        // Scale to fit within WRAP_RADIUS
        const scaled = scaleHipparcosPositions(filtered, WRAP_RADIUS * 0.8);

        setStars(scaled);
        setLoading(false);

        console.log(`✅ RealStarLayer: Rendered ${scaled.length.toLocaleString()} real stars (mag < ${maxMagnitude})`);
      } catch (error) {
        console.error('❌ RealStarLayer: Failed to load Hipparcos stars:', error);
        setLoading(false);
      }
    }

    console.log('🎬 RealStarLayer: Component mounted, calling loadStars()');
    loadStars();

    return () => {
      cancelled = true;
      console.log('🛑 RealStarLayer: Component unmounted');
    };
  }, [maxMagnitude]);

  const geometry = useMemo(() => {
    if (stars.length === 0) return null;
    return createRealStarGeometry(stars);
  }, [stars]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBaseOpacity: { value: baseOpacity },
      uReducedMotion: { value: reducedMotion ? 1 : 0 },
      uDriftDir: { value: DRIFT_DIR },
      uParallax: { value: parallaxFactor },
      uDriftSpeed: { value: DRIFT_SPEED_GLOBAL },
      uWrapRadius: { value: WRAP_RADIUS },
    }),
    [baseOpacity, reducedMotion, parallaxFactor]
  );

  useFrame((_, delta) => {
    if (matRef.current && !reducedMotion) {
      matRef.current.uniforms.uTime.value += delta;
    }
  });

  if (loading || !geometry) {
    return null; // Show nothing while loading
  }

  return (
    <points ref={pointsRef} geometry={geometry}>
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        vertexColors
        depthWrite={false}
        blending={blendMode}
      />
    </points>
  );
}
