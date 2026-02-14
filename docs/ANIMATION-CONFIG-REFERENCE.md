# Animation Configuration Reference
## Quick Reference for Tweaking Timings and Positions

This document provides a quick reference for all configurable animation constants in the Mission Control Hub.

---

## 🎯 Quick Links

- **Astronaut Docking:** [src/components/islands/AstronautMascot.tsx](#astronaut-docking)
- **Rover Animation:** [src/components/islands/RoverAnimation.tsx](#rover-animation)
- **Footer Earth:** [src/components/layout/Footer.astro](#footer-earth)

---

## 🚀 Astronaut Docking

**File:** `src/components/islands/AstronautMascot.tsx`
**Line:** 5

### Constants

```typescript
const DOCKING_TRANSITION_DURATION = 1.5; // seconds
```

### What It Controls

- Time for astronaut to travel **from hub to panel header**
- Time for astronaut to travel **from panel header back to hub**

### How to Adjust

**Faster (snappy):**
```typescript
const DOCKING_TRANSITION_DURATION = 0.8; // seconds
```

**Slower (dramatic):**
```typescript
const DOCKING_TRANSITION_DURATION = 2.5; // seconds
```

### Docking Position

**File:** `src/components/islands/PanelShell.tsx`
**Line:** 98

```typescript
window.dispatchEvent(new CustomEvent("astronaut:dock", {
  detail: {
    x: rect.right - 80, // 80px from right edge of panel
    y: rect.top + rect.height / 2, // Centered vertically in header
  }
}));
```

**To adjust horizontal position:**
```typescript
x: rect.right - 100, // Further left
x: rect.right - 60,  // Further right
```

**To adjust vertical position:**
```typescript
y: rect.top + 20,          // Near top
y: rect.top + rect.height - 20, // Near bottom
```

---

## 🤖 Rover Animation

**File:** `src/components/islands/RoverAnimation.tsx`
**Lines:** 6-11

### Constants

```typescript
const TRAVEL_DURATION = 3000;    // ms - rover travel time
const DEPLOY_ANIMATION = 500;    // ms - flag deployment
const HOLD_DURATION = 8000;      // ms - display before auto-reset
const RESET_DURATION = 500;      // ms - fade out time
const ROVER_START_X = -50;       // px - starting position (left)
const ROVER_END_X = 720;         // px - ending position (center)
```

### What Each Controls

| Constant | Controls | Default | Suggested Range |
|----------|----------|---------|----------------|
| `TRAVEL_DURATION` | How long rover takes to travel across screen | 3000 ms (3s) | 2000-5000 ms |
| `DEPLOY_ANIMATION` | How fast flag rises and unfurls | 500 ms | 300-800 ms |
| `HOLD_DURATION` | How long "Thanks!" message displays | 8000 ms (8s) | 5000-12000 ms |
| `RESET_DURATION` | How fast rover fades out | 500 ms | 300-1000 ms |
| `ROVER_START_X` | Where rover starts (offscreen left) | -50 px | -100 to 0 |
| `ROVER_END_X` | Where rover stops (center of 1440 viewBox) | 720 px | 500-900 |

### Common Adjustments

**Faster Animation (snappier):**
```typescript
const TRAVEL_DURATION = 2000;    // 2 seconds instead of 3
const DEPLOY_ANIMATION = 300;    // Quicker flag
const HOLD_DURATION = 5000;      // 5 seconds display
```

**Slower Animation (more dramatic):**
```typescript
const TRAVEL_DURATION = 5000;    // 5 seconds travel
const DEPLOY_ANIMATION = 800;    // Slower flag unfurl
const HOLD_DURATION = 12000;     // 12 seconds display
```

**Change Rover Destination (not centered):**
```typescript
const ROVER_END_X = 900;  // Stop further right
const ROVER_END_X = 500;  // Stop further left
```

---

## 🌍 Footer Earth

**File:** `src/components/layout/Footer.astro`

### Dimensions

**Line:** 10
```html
<svg viewBox="0 0 1440 150">
```

**To adjust Earth height:**
```html
<svg viewBox="0 0 1440 180">  <!-- Taller (closer to original) -->
<svg viewBox="0 0 1440 120">  <!-- Even slimmer -->
```

**Important:** If you change the height, you must recalculate all path y-coordinates proportionally:
- Original height: 200
- Current height: 150 (multiply by 0.75)
- For 180: multiply original by 0.9
- For 120: multiply original by 0.6

### Atmosphere Glow

**Lines:** 28-33
```html
<radialGradient id="atmosphere-glow" cx="50%" cy="100%" r="60%">
  <stop offset="0%" stop-color="#5c6bc0" stop-opacity="0.3"></stop>
  <stop offset="30%" stop-color="#3f51b5" stop-opacity="0.15"></stop>
  <stop offset="70%" stop-color="#283593" stop-opacity="0.05"></stop>
  <stop offset="100%" stop-color="transparent" stop-opacity="0"></stop>
</radialGradient>
```

**To adjust glow intensity:**
```html
<!-- Brighter glow -->
<stop offset="0%" stop-color="#5c6bc0" stop-opacity="0.5"></stop>
<stop offset="30%" stop-color="#3f51b5" stop-opacity="0.25"></stop>

<!-- Subtler glow -->
<stop offset="0%" stop-color="#5c6bc0" stop-opacity="0.2"></stop>
<stop offset="30%" stop-color="#3f51b5" stop-opacity="0.08"></stop>
```

**To adjust glow size:**
```html
<radialGradient id="atmosphere-glow" cx="50%" cy="100%" r="80%">  <!-- Larger -->
<radialGradient id="atmosphere-glow" cx="50%" cy="100%" r="40%">  <!-- Smaller -->
```

**To adjust glow color:**
```html
<!-- Golden atmosphere -->
<stop offset="0%" stop-color="#ffd54f" stop-opacity="0.3"></stop>
<stop offset="30%" stop-color="#ffc107" stop-opacity="0.15"></stop>

<!-- Green atmosphere -->
<stop offset="0%" stop-color="#43a047" stop-opacity="0.3"></stop>
<stop offset="30%" stop-color="#2e7d32" stop-opacity="0.15"></stop>
```

---

## 🎨 Testing Your Changes

After modifying any constants:

1. **Save the file**
2. **Rebuild:** `npm run build`
3. **Start dev server:** `npm run dev`
4. **Test the animation:**
   - For astronaut: Open a panel
   - For rover: Click DEPLOY button
   - For Earth: Visual inspection of footer

---

## 🔧 Common Scenarios

### "I want the astronaut to dock faster"
**File:** `AstronautMascot.tsx` line 5
**Change:** `const DOCKING_TRANSITION_DURATION = 1.0;` (or lower)

### "I want the rover to travel slower"
**File:** `RoverAnimation.tsx` line 6
**Change:** `const TRAVEL_DURATION = 5000;` (or higher)

### "I want 'Thanks!' to display longer"
**File:** `RoverAnimation.tsx` line 8
**Change:** `const HOLD_DURATION = 12000;` (or higher)

### "I want the Earth atmosphere glow more visible"
**File:** `Footer.astro` line 29
**Change:** `stop-opacity="0.5"` (increase opacity values)

### "I want the rover to stop at a different position"
**File:** `RoverAnimation.tsx` line 11
**Change:** `const ROVER_END_X = 900;` (adjust x-coordinate)

---

## ⚠️ Important Notes

1. **All timings use different units:**
   - `AstronautMascot.tsx`: **seconds** (1.5 = 1.5 seconds)
   - `RoverAnimation.tsx`: **milliseconds** (3000 = 3 seconds)

2. **Reduced Motion:**
   - All animations automatically respect `prefers-reduced-motion`
   - Don't worry about breaking accessibility when adjusting timings

3. **Performance:**
   - Keep `TRAVEL_DURATION` under 8000ms (8s) for best UX
   - Keep `DOCKING_TRANSITION_DURATION` under 3s for responsiveness

4. **SVG Coordinates:**
   - Footer viewBox is `0 0 1440 150`
   - X-axis: 0 (left) to 1440 (right)
   - Y-axis: 0 (top) to 150 (bottom)
   - Rover positions use this coordinate system

---

## 📋 Default Values Summary

| Component | Constant | Default | Unit |
|-----------|----------|---------|------|
| Astronaut | Docking Duration | 1.5 | seconds |
| Rover | Travel Duration | 3000 | milliseconds |
| Rover | Deploy Animation | 500 | milliseconds |
| Rover | Hold Duration | 8000 | milliseconds |
| Rover | Reset Duration | 500 | milliseconds |
| Rover | Start Position | -50 | pixels (SVG units) |
| Rover | End Position | 720 | pixels (SVG units) |
| Earth | ViewBox Height | 150 | pixels (SVG units) |
| Earth | Atmosphere Radius | 60% | percentage |
| Earth | Glow Opacity | 0.3-0.0 | opacity (0-1) |

---

## 🚀 Need Help?

If you're unsure about a change:
1. Make a backup of the file first
2. Make small adjustments (change one constant at a time)
3. Test immediately after each change
4. Use browser DevTools to inspect animations in real-time

**Remember:** You can always revert to defaults by checking this document or the git history!

---

**Last Updated:** 2026-02-10
**Version:** Phase 2 Complete
