/**
 * Combined Gaia Layer - Renders Hipparcos stars + Gaia galaxies
 * Phase 0: Simple flat rendering without LOD
 */

import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { loadHipparcosStars, scaleHipparcosPositions, type HipparcosStar } from "@/utils/loadHipparcosData";
import { loadGaiaGalaxies, scaleGalaxyPositions, type GaiaGalaxy } from "@/utils/loadGaiaGalaxies";

const WRAP_RADIUS = 12;

interface GaiaCombinedLayerProps {
  baseOpacity: number;
  blendMode: THREE.Blending;
  reducedMotion: boolean;
}

/**
 * Map spectral type to RGB color
 */
function spectralTypeToRGB(spect?: string): [number, number, number] {
  if (!spect) return [1.0, 1.0, 1.0];

  const type = spect.charAt(0).toUpperCase();
  const colorMap: Record<string, [number, number, number]> = {
    'O': [0.6, 0.7, 1.0],   // Blue
    'B': [0.7, 0.8, 1.0],   // Blue-white
    'A': [1.0, 1.0, 1.0],   // White
    'F': [1.0, 1.0, 0.9],   // Yellow-white
    'G': [1.0, 0.95, 0.8],  // Yellow (Sun)
    'K': [1.0, 0.85, 0.7],  // Orange
    'M': [1.0, 0.7, 0.6],   // Red
  };

  return colorMap[type] || [1.0, 1.0, 1.0];
}

export default function GaiaCombinedLayer({
  baseOpacity,
  blendMode,
  reducedMotion,
}: GaiaCombinedLayerProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const [loading, setLoading] = useState(true);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  // Load data on mount
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        console.log('🚀 GaiaCombinedLayer: Loading Hipparcos stars + Gaia galaxies...');

        // Load both datasets
        const [stars, galaxies] = await Promise.all([
          loadHipparcosStars(),
          loadGaiaGalaxies()
        ]);

        if (cancelled) return;

        console.log(`📊 Loaded ${stars.length} stars + ${galaxies.length} galaxies`);

        // Scale to fit within scene
        const scaledStars = scaleHipparcosPositions(stars, WRAP_RADIUS * 0.8);
        const scaledGalaxies = scaleGalaxyPositions(galaxies, WRAP_RADIUS * 1.2); // Galaxies farther out

        // Debug: log sample positions
        if (scaledStars.length > 0) {
          const s = scaledStars[0];
          console.log(`🔍 Sample star pos: (${s.x.toFixed(2)}, ${s.y.toFixed(2)}, ${s.z.toFixed(2)}), dist: ${Math.sqrt(s.x*s.x + s.y*s.y + s.z*s.z).toFixed(2)}`);
        }

        // Create geometry
        const totalPoints = scaledStars.length + scaledGalaxies.length;
        const positions = new Float32Array(totalPoints * 3);
        const colors = new Float32Array(totalPoints * 3);
        const sizes = new Float32Array(totalPoints);
        const magnitudes = new Float32Array(totalPoints);

        let index = 0;

        // Add stars
        for (const star of scaledStars) {
          positions[index * 3] = star.x;
          positions[index * 3 + 1] = star.y;
          positions[index * 3 + 2] = star.z;

          const [r, g, b] = spectralTypeToRGB(star.spect);
          colors[index * 3] = r;
          colors[index * 3 + 1] = g;
          colors[index * 3 + 2] = b;

          // Size based on magnitude
          const normalizedMag = (8.0 - star.mag) / 9.44;
          sizes[index] = 0.6 + normalizedMag * 2.4;

          magnitudes[index] = star.mag;

          index++;
        }

        // Add galaxies (larger, distinct color)
        for (const galaxy of scaledGalaxies) {
          positions[index * 3] = galaxy.x;
          positions[index * 3 + 1] = galaxy.y;
          positions[index * 3 + 2] = galaxy.z;

          // Galaxies have yellowish tint
          colors[index * 3] = 1.0;
          colors[index * 3 + 1] = 0.95;
          colors[index * 3 + 2] = 0.8;

          // Galaxies are much larger
          sizes[index] = 5.0;

          magnitudes[index] = galaxy.appMag;

          index++;
        }

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geom.setAttribute('magnitude', new THREE.BufferAttribute(magnitudes, 1));

        setGeometry(geom);
        setLoading(false);

        console.log(`✅ GaiaCombinedLayer: Rendered ${totalPoints} objects`);

      } catch (error) {
        console.error('❌ GaiaCombinedLayer: Failed to load data:', error);
        setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  // Debug: log geometry attributes to verify data (must be before conditional return)
  useEffect(() => {
    if (geometry) {
      console.log('🔍 GaiaCombinedLayer geometry check:');
      console.log('  - positions:', geometry.attributes.position?.count);
      console.log('  - colors:', geometry.attributes.color?.count);
      console.log('  - sizes:', geometry.attributes.size?.count);
      console.log('  - baseOpacity:', baseOpacity);
      console.log('  - blendMode:', blendMode);
    }
  }, [geometry, baseOpacity, blendMode]);

  if (loading || !geometry) {
    return null;
  }

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={5.0}  // Increased from 1.5 for visibility testing
        sizeAttenuation={true}
        vertexColors={true}
        transparent={true}
        opacity={0.6}  // Override baseOpacity for testing (was baseOpacity)
        blending={THREE.NormalBlending}  // Change from AdditiveBlending to NormalBlending for testing
        depthWrite={false}
        fog={false}
      />
    </points>
  );
}
