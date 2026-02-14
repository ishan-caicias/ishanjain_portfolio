import { useRef, useEffect, useCallback } from "react";
import { selectTargets, getDailySeed } from "@/content/nasaTargets";
import type { NasaTarget } from "@/types/nasa";

interface Star {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  baseOpacity: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  isSpecial: boolean;
  hubbleIndex: number | null;
  targetId?: string; // NASA target ID
}

interface StarfieldProps {
  starCount?: number;
  specialStarCount?: number;
}

export default function Starfield({
  starCount = 200,
  specialStarCount = 8, // Increased from 6 to 8 for NASA targets
}: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number>(0);
  const prefersReducedMotion = useRef(false);
  const nasaTargetsRef = useRef<NasaTarget[]>([]);

  const createStars = useCallback(
    (width: number, height: number): Star[] => {
      const stars: Star[] = [];
      const totalStars = starCount + specialStarCount;

      // Select NASA targets for special stars (deterministic daily selection)
      if (nasaTargetsRef.current.length === 0) {
        const dailySeed = getDailySeed();
        nasaTargetsRef.current = selectTargets(dailySeed, specialStarCount);
        console.log(`[Starfield] Selected ${nasaTargetsRef.current.length} NASA targets for ${dailySeed}`);
      }

      for (let i = 0; i < totalStars; i++) {
        const isSpecial = i >= starCount;
        const specialIndex = i - starCount;

        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: isSpecial ? 2 + Math.random() * 1.5 : 0.5 + Math.random() * 1.5,
          opacity: 0.3 + Math.random() * 0.7,
          baseOpacity: 0.3 + Math.random() * 0.7,
          twinkleSpeed: 0.002 + Math.random() * 0.004,
          twinkleOffset: Math.random() * Math.PI * 2,
          isSpecial,
          hubbleIndex: isSpecial ? specialIndex : null,
          targetId: isSpecial && nasaTargetsRef.current[specialIndex]
            ? nasaTargetsRef.current[specialIndex].id
            : undefined,
        });
      }
      return stars;
    },
    [starCount, specialStarCount],
  );

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
      ctx.clearRect(0, 0, width, height);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const parallaxStrength = 0.02;

      for (const star of starsRef.current) {
        // Parallax offset based on star size (larger = more movement)
        const offsetX = prefersReducedMotion.current
          ? 0
          : (mx - width / 2) * parallaxStrength * star.radius;
        const offsetY = prefersReducedMotion.current
          ? 0
          : (my - height / 2) * parallaxStrength * star.radius;

        const drawX = star.x + offsetX;
        const drawY = star.y + offsetY;

        // Twinkle
        const twinkle = prefersReducedMotion.current
          ? 1
          : Math.sin(time * star.twinkleSpeed + star.twinkleOffset) * 0.3 + 0.7;
        const opacity = star.baseOpacity * twinkle;

        ctx.beginPath();
        ctx.arc(drawX, drawY, star.radius, 0, Math.PI * 2);

        if (star.isSpecial) {
          // Gold-tinted special stars with glow
          ctx.fillStyle = `rgba(255, 213, 79, ${opacity})`;
          ctx.shadowColor = "rgba(255, 193, 7, 0.4)";
          ctx.shadowBlur = 8;
        } else {
          ctx.fillStyle = `rgba(232, 234, 246, ${opacity})`;
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
        }

        ctx.fill();
        ctx.shadowBlur = 0;
      }
    },
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Check reduced motion preference
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotion.current = motionQuery.matches;
    const handleMotionChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
    };
    motionQuery.addEventListener("change", handleMotionChange);

    // Set canvas size
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      starsRef.current = createStars(rect.width, rect.height);
    };

    resize();

    // Debounced resize handler
    let resizeTimeout: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resize, 250);
    };
    window.addEventListener("resize", handleResize);

    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Animation loop
    const animate = (time: number) => {
      const rect = canvas.getBoundingClientRect();
      draw(ctx, rect.width, rect.height, time);

      if (!prefersReducedMotion.current) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (prefersReducedMotion.current) {
      // Draw once for reduced motion
      draw(ctx, canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height, 0);
    } else {
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      cancelAnimationFrame(animationRef.current);
      clearTimeout(resizeTimeout);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      motionQuery.removeEventListener("change", handleMotionChange);
    };
  }, [createStars, draw]);

  // Click handler for special stars
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const hitRadius = 20; // generous click target for a11y

      for (const star of starsRef.current) {
        if (!star.isSpecial) continue;

        const dx = clickX - star.x;
        const dy = clickY - star.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < hitRadius) {
          // Dispatch custom event with NASA target ID or Hubble fallback
          window.dispatchEvent(
            new CustomEvent("starclick", {
              detail: {
                targetId: star.targetId,
                isLegacy: !star.targetId, // Legacy if no NASA target
                hubbleIndex: star.hubbleIndex,
              },
            }),
          );
          break;
        }
      }
    },
    [],
  );

  return (
    <canvas
      ref={canvasRef}
      className="starfield-canvas absolute inset-0 h-full w-full"
      onClick={handleCanvasClick}
      role="img"
      aria-label="Animated starfield background. Click on the brighter golden stars to discover NASA space imagery."
      style={{ cursor: "crosshair" }}
    />
  );
}
