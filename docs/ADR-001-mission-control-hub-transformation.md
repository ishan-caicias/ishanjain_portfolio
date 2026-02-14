# ADR-001: Mission Control Space Station Hub Transformation

**Status:** Proposed
**Date:** 2026-02-10
**Author:** Claude Sonnet 4.5 (with Ishan Jain)

---

## Context

The current portfolio is a single-page scroll application with 8 sections stacked vertically (Hero, Credibility, Experience, Achievements, Projects, Skills, Writing, Contact). While functional and accessible, it lacks the immersive, interactive experience that aligns with the space/astronomy theme established by the Starfield background and astronaut mascot.

### Current Architecture

- **Framework:** Astro 5.2.0 with React 19 islands
- **Styling:** Tailwind CSS v4 with CSS custom properties
- **Islands:** Starfield (canvas), AstronautMascot, StarModal, MissionControl
- **Content:** TypeScript arrays in `/src/content/` (not Astro Content Collections)
- **Theme:** Royal blue primary (#5c6bc0 range), gold accents, dark navy background (#0a0e27)

### The Problem

1. **Navigation:** Linear scroll doesn't leverage the space station theme
2. **Engagement:** Static sections lack interactivity beyond the starfield
3. **Discoverability:** All content visible immediately reduces focused attention
4. **Underutilized Assets:** Astronaut mascot and starfield could play larger roles

### Goals

Transform the portfolio into an interactive **Mission Control Space Station Hub** where:

- Landing shows a central space station hub with large accessible controls
- Clicking opens a "DockedModule" overlay panel (spacecraft console aesthetic)
- Hub remains visible but dimmed behind the panel
- Starfield persists across hub and panels with dynamic opacity
- Astronaut "docks" at the active panel header
- Footer Earth becomes interactive with rover animation on DEPLOY
- All existing section content is reused without duplication
- Maintains WCAG 2.1 AA accessibility and production quality

---

## Decision

We will implement a **panel-based navigation system** with the following architecture:

### 1. Core Components

#### SpaceStationHub.tsx (NEW - React Island)
- Central circular/grid command center with 7 controls
- Controls: About, Skills, Experience, Projects, Writing, Connect, DEPLOY
- HTML/CSS layout with SVG decorative accents (not pure SVG)
- Full keyboard navigation (Tab, Arrow keys, Enter/Space)
- Dispatches panel open events to PanelCoordinator

**Rationale:** React island needed for complex state management, event coordination, and motion animations. HTML/CSS preferred over pure SVG for accessibility and responsive design.

#### PanelCoordinator.tsx (NEW - React Island)
- Top-level orchestrator managing global panel state
- Handles URL hash routing (#skills opens Skills panel)
- Listens to browser back/forward events
- Coordinates SpaceStationHub and PanelShell
- Dispatches astronaut docking events
- Sets `data-panel-open` attribute on body for CSS hooks

**Rationale:** Separates state management from presentation. Single source of truth for panel state. Enables clean component boundaries and easier testing.

#### PanelShell.tsx (NEW - React Island)
- Reusable modal overlay with DockedModule aesthetics
- Focus trap (Tab cycles within panel only)
- ESC, backdrop click, X button close handlers
- Body scroll lock when open
- Motion animations (slide-in from right)
- Reduced motion support (fade in/out instead)
- `aria-modal="true"` and `role="dialog"`

**Rationale:** React island for modal state, animations, and focus management. Reusable across all panels. Matches existing pattern in MissionControl.tsx.

#### Panel{X}.astro (NEW - Astro Wrappers × 6)
- Thin wrappers: PanelAbout, PanelSkills, PanelExperience, PanelProjects, PanelWriting, PanelContact
- Import existing section components and content
- Remove outer `<section>` wrapper (panel provides container)
- Add scrollable container with panel-specific padding
- Zero duplication of business logic

**Rationale:** Astro components for static content reuse. Avoids converting all sections to React. Leverages existing components and content collections.

### 2. Modified Components

#### Starfield.tsx (MODIFY)
- Add `opacity` prop (0-1 range, default 1)
- Add `density` prop ('full' | 'reduced', default 'full')
- Optionally pause animation when panel open (CPU optimization)

**Change Strategy:** CSS-based via body attribute
```css
body[data-panel-open="true"] .starfield-canvas {
  opacity: 0.3;
  transition: opacity 0.3s ease-in-out;
}
```

**Rationale:** Avoids prop drilling. Simpler state management. Browser's CSS engine is efficient. Supports reduced motion.

#### AstronautMascot.tsx (MODIFY)
- Listen for custom `astronaut:dock` event with coordinates
- Listen for `astronaut:return` event to restore hub position
- Add docking state machine: 'hub' | 'docking' | 'docked' | 'returning'
- Calculate smooth transitions with existing easing
- Respect `prefers-reduced-motion` (teleport instead of animate)

**Rationale:** Event-driven coordination matches existing Starfield pattern (starclick events). Avoids tight coupling between panels and astronaut.

#### Footer.astro (MODIFY)
- Slim Earth SVG viewBox: `200` → `150` height
- Add radial gradient for realistic horizon atmosphere glow
- Integrate RoverAnimation island

**Rationale:** Visual polish without breaking existing layout. Maintains footer structure.

#### RoverAnimation.tsx (NEW - React Island)
- Rover SVG animation traveling to Earth center
- Plants flag with "Thanks for visiting!" message
- Triggered by DEPLOY button in hub
- Auto-reset after 5 seconds OR click rover
- State machine: 'idle' | 'traveling' | 'deployed' | 'resetting'
- Motion keyframe animations with reduced motion support

**Rationale:** React island for animation state and timers. Adds delight and reinforces space station theme.

### 3. Routing Strategy

**URL Hash Routing** (no client-side router library)

- `#skills` → Opens Skills panel
- `#experience` → Opens Experience panel
- `#` or no hash → Hub view (no panel open)
- Browser back/forward buttons work natively
- Deep linking supported (share `ishanjain.dev/#projects`)

**Implementation:**
```typescript
// PanelCoordinator.tsx
useEffect(() => {
  const handleHashChange = () => {
    const hash = window.location.hash.slice(1);
    const validPanels = ['about', 'skills', 'experience', 'projects', 'writing', 'contact'];
    if (validPanels.includes(hash)) {
      setActivePanelId(hash);
    } else if (hash === '') {
      setActivePanelId(null);
    }
  };

  handleHashChange(); // Initial load
  window.addEventListener('hashchange', handleHashChange);
  return () => window.removeEventListener('hashchange', handleHashChange);
}, []);
```

**Rationale:** Native browser history API. No dependencies. SEO-friendly (hash navigation is standard). Works with Astro SSG (client-side only).

### 4. Animation Strategy

**Motion Library (Framer Motion fork)**

Already installed and used in MissionControl.tsx. Provides:
- `AnimatePresence` for exit animations
- Built-in `prefers-reduced-motion` support
- Spring physics for organic feel
- GPU-accelerated transforms

**Animation Breakdown:**
| Element | Animation | Reduced Motion Fallback |
|---------|-----------|-------------------------|
| Panel open | Slide from right + scale | Fade in |
| Panel close | Slide to right + scale | Fade out |
| Backdrop | Opacity fade | Instant |
| Astronaut dock | CSS transition (existing) | Teleport |
| Rover travel | Motion keyframes | Fade in |
| Hub controls | CSS hover/focus | No animation |

**Rationale:** Consistent with existing codebase. Performant (transform + opacity = GPU composited). Accessible.

### 5. State Management

**Event-Driven Architecture** (no Context API or Zustand)

**State Flow:**
```
User clicks Hub control "Skills"
  → SpaceStationHub.onPanelOpen('skills')
    → PanelCoordinator updates hash → #skills
      → PanelCoordinator.setState(activePanelId: 'skills')
        → PanelShell receives isOpen=true, panelId='skills'
          → PanelShell.dispatchEvent('astronaut:dock', { x, y })
            → AstronautMascot listens and animates to coordinates
```

**Rationale:**
- SpaceStationHub and PanelShell are siblings, not nested (Context overkill)
- URL hash as single source of truth
- Custom events for loose coupling (existing pattern: starclick)
- Simpler debugging and testing

### 6. Content Integration

**Challenge:** Astro components can't be children of React islands

**Solution:** Hybrid approach
1. Convert Panel{X}.astro to Panel{X}.tsx (React components)
2. Import section content logic (skillCategories, experiences, etc.)
3. Rebuild section markup in React with same Tailwind classes
4. Reuse UI primitives where possible (or convert to React)

**Example PanelSkills.tsx:**
```tsx
import { skillCategories } from '@/content/skills';

export default function PanelSkills() {
  return (
    <div className="panel-content">
      <h2 className="font-heading text-3xl font-bold text-text-primary">
        Skills & Tools
      </h2>
      <p className="mt-2 text-text-muted">
        Technologies I work with regularly
      </p>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 mt-8">
        {skillCategories.map((category) => (
          <div key={category.name}>
            <h3 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-gold-400">
              {category.name}
            </h3>
            <ul className="space-y-1.5">
              {category.skills.map((skill) => (
                <li key={skill} className="flex items-center gap-2 text-sm text-text-muted">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-royal-400" />
                  {skill}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Rationale:** Clean React component tree. No Astro/React boundary issues. Content logic (data) is reused. Markup is duplicated but simplified (no Astro overhead).

### 7. Accessibility

All new components follow WCAG 2.1 AA standards:

#### Keyboard Navigation
- Hub controls: Tab to enter, Arrow keys to navigate, Enter/Space to activate
- Panel: Tab cycles within (focus trap), Shift+Tab backward, ESC closes
- Focus restoration: Closing panel returns focus to triggering control

#### Screen Readers
- `role="navigation"` on hub container
- `aria-label="Mission control navigation hub"`
- `role="dialog"` and `aria-modal="true"` on panels
- `aria-labelledby` pointing to panel heading
- Live region announcements: "Skills panel opened", "Panel closed"

#### Reduced Motion
- All animations respect `prefers-reduced-motion`
- Panel: Fade instead of slide
- Astronaut: Teleport instead of animate
- Rover: Fade instead of travel

#### Color Contrast
- Maintain existing AA+ contrast ratios
- Hub control borders: royal-600 on surface-elevated (sufficient contrast)
- Panel text: text-primary on surface-elevated (sufficient contrast)

**Rationale:** Accessibility is non-negotiable. Follow existing patterns (StarModal has focus trap, SkipLink exists). Use semantic HTML.

---

## File Structure

### New Files (13 total)
```
src/
├── components/
│   ├── islands/
│   │   ├── SpaceStationHub.tsx          (~300 lines)
│   │   ├── PanelCoordinator.tsx         (~150 lines)
│   │   ├── PanelShell.tsx               (~200 lines)
│   │   └── RoverAnimation.tsx           (~250 lines)
│   └── panels/                          [NEW DIRECTORY]
│       ├── PanelAbout.tsx               (~100 lines)
│       ├── PanelSkills.tsx              (~80 lines)
│       ├── PanelExperience.tsx          (~100 lines)
│       ├── PanelProjects.tsx            (~120 lines)
│       ├── PanelWriting.tsx             (~50 lines)
│       └── PanelContact.tsx             (~80 lines)
├── types/
│   └── index.ts                         (MODIFY +30 lines)
├── styles/
│   ├── panels.css                       (~100 lines)
│   └── global.css                       (MODIFY +20 lines)
└── utils/
    └── announce.ts                      (~15 lines, screen reader announcements)
```

### Modified Files (5 total)
```
src/
├── pages/
│   └── index.astro                      (MAJOR - replace section stack with PanelCoordinator)
├── layouts/
│   └── BaseLayout.astro                 (MINOR - import panels.css)
├── components/
│   ├── islands/
│   │   ├── Starfield.tsx                (MINOR - add opacity/density props)
│   │   └── AstronautMascot.tsx          (MODERATE - add docking state machine)
│   └── layout/
│       └── Footer.astro                 (MODERATE - slim Earth SVG, add RoverAnimation)
```

### Preserved Files (No Changes)
- All `/src/content/*.ts` (data remains identical)
- All `/src/components/ui/*.astro` (may convert to React later if needed)
- All tests (will update after implementation)

**Total LOC Estimate:** ~1,600 new lines, ~200 modified lines

---

## Consequences

### Positive

1. **Immersive UX:** Space station theme comes alive with interactive hub and docking panels
2. **Better Focus:** Panels isolate content, reducing cognitive load
3. **Shareable Links:** Deep linking (#skills) allows direct content sharing
4. **Scalable:** Adding new panels is trivial (create Panel{X}.tsx, add control to hub)
5. **Performance:** Panel content lazy rendered only when opened
6. **Accessibility:** Full keyboard nav, screen reader support, reduced motion
7. **Maintainable:** Clear component boundaries, event-driven architecture

### Negative

1. **Complexity:** More components, more state, more coordination
2. **Duplication:** Panel markup duplicates section structure (trade-off for React compatibility)
3. **Testing:** Increased test surface area (hub interactions, panel routing, animations)
4. **Bundle Size:** +4 React islands = larger JS bundle (mitigated by code splitting)
5. **SEO:** Hash routing doesn't help SEO (but portfolio isn't content-focused, so acceptable)

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Animation performance issues on low-end devices | Medium | Medium | Use GPU-accelerated transforms, respect reduced motion, test on mid-range devices |
| Focus trap bugs breaking keyboard nav | Low | High | Extensive keyboard testing, follow existing StarModal pattern |
| Panel content doesn't fit mobile screens | Medium | Medium | Design mobile-first, test responsive breakpoints, use scrollable containers |
| Increased bundle size impacts load time | Low | Medium | Code split panels, lazy load animations, monitor Lighthouse scores |
| Accessibility regressions | Low | High | Automated axe tests, manual screen reader testing, maintain existing patterns |

---

## Alternatives Considered

### Alternative 1: Keep One-Page Scroll, Add Modals
**Description:** Keep existing layout, open modals on section click
**Pros:** Simpler, less refactoring
**Cons:** Doesn't leverage space station theme, modals feel disconnected
**Rejected:** Doesn't achieve immersive UX goal

### Alternative 2: Multi-Page Astro Routing
**Description:** Separate pages for each section (/skills, /experience)
**Pros:** True SEO benefits, simpler routing
**Cons:** Loses single-page feel, starfield/astronaut state doesn't persist
**Rejected:** Breaks continuity of space station experience

### Alternative 3: Pure Astro View Transitions
**Description:** Use Astro's View Transitions API for page animations
**Pros:** Built-in, no React needed
**Cons:** Overkill for panels, less control over animations, requires multi-page
**Rejected:** Doesn't fit single hub paradigm

### Alternative 4: Full React SPA
**Description:** Convert entire portfolio to React with React Router
**Pros:** Easier state management, no Astro/React boundary issues
**Cons:** Loses Astro's build-time optimizations, larger JS bundle, unnecessary
**Rejected:** Astro's islands architecture is perfect for this use case

---

## Implementation Plan

### Phase 1: Foundation (Day 1)
- [ ] Create type definitions (PanelId, HubControl, etc.)
- [ ] Implement PanelCoordinator with basic state and hash routing
- [ ] Implement PanelShell with modal structure (no animations)
- [ ] Update index.astro to render PanelCoordinator
- [ ] Test URL hash routing and panel open/close

**Deliverable:** Panel system works with blank panels, no styling

### Phase 2: Hub Component (Day 2)
- [ ] Design SpaceStationHub layout (circular grid)
- [ ] Implement hub controls with keyboard navigation
- [ ] Add control icons (SVG)
- [ ] Wire up onPanelOpen callbacks
- [ ] Add ARIA attributes
- [ ] Test keyboard navigation flow

**Deliverable:** Hub renders and opens panels via buttons/keyboard

### Phase 3: Panel Content (Day 3)
- [ ] Convert section components to Panel{X}.tsx React components
- [ ] Import content from `/src/content/*.ts`
- [ ] Rebuild section markup with Tailwind classes
- [ ] Create panels.css for shared panel styles
- [ ] Test each panel renders correctly

**Deliverable:** Panels display real content

### Phase 4: Animations (Day 4)
- [ ] Add motion animations to PanelShell (slide-in, backdrop fade)
- [ ] Implement prefers-reduced-motion fallbacks
- [ ] Add body scroll lock when panel open
- [ ] Test animation performance (60fps target)
- [ ] Polish hub control hover states

**Deliverable:** Smooth panel animations

### Phase 5: Starfield Integration (Day 4)
- [ ] Move Starfield to root level in index.astro
- [ ] Add body[data-panel-open] attribute logic to PanelCoordinator
- [ ] Add CSS for starfield opacity transition
- [ ] Test starfield persists across hub + panels
- [ ] Verify reduced motion support

**Deliverable:** Starfield dims when panel opens

### Phase 6: Astronaut Docking (Day 5)
- [ ] Modify AstronautMascot.tsx with docking state machine
- [ ] Calculate panel header coordinates in PanelShell
- [ ] Dispatch astronaut:dock event on panel open
- [ ] Implement docking animation with CSS transition
- [ ] Implement return animation on panel close
- [ ] Add prefers-reduced-motion teleport fallback

**Deliverable:** Astronaut docks at panel header

### Phase 7: Footer Enhancements (Day 6)
- [ ] Redesign Earth SVG (slimmer viewBox, atmosphere gradient)
- [ ] Create RoverAnimation.tsx component
- [ ] Implement rover travel animation (Motion keyframes)
- [ ] Add flag planting with "Thanks for visiting!" text
- [ ] Wire up DEPLOY button in hub
- [ ] Test reset logic (auto + click)

**Deliverable:** DEPLOY triggers rover animation

### Phase 8: Polish & Accessibility (Day 7)
- [ ] Implement focus trap in PanelShell (Tab cycling)
- [ ] Add screen reader announcements (announce.ts utility)
- [ ] Test full keyboard navigation flow
- [ ] Run automated accessibility audit (axe DevTools)
- [ ] Test with screen reader (NVDA/JAWS)
- [ ] Verify WCAG 2.1 AA contrast ratios
- [ ] Add comprehensive aria-labels

**Deliverable:** Fully accessible panel system

### Phase 9: Testing & Documentation (Day 8)
- [ ] Update E2E tests for hub + panel flows (mission-control-hub.spec.ts)
- [ ] Add unit tests for PanelCoordinator state management
- [ ] Test browser back/forward button behavior
- [ ] Test deep linking (#skills on page load)
- [ ] Test mobile responsiveness (responsive breakpoints)
- [ ] Update README with new component architecture
- [ ] Create migration notes for future developers

**Deliverable:** Production-ready system with tests

---

## Verification

### Functional Requirements
- [ ] Hub renders with 7 accessible controls
- [ ] Clicking control opens corresponding panel
- [ ] Panel displays correct section content
- [ ] ESC, backdrop click, X button close panel
- [ ] URL hash updates on panel open (#skills)
- [ ] Deep linking works (#experience on page load)
- [ ] Browser back/forward buttons work
- [ ] Starfield dims when panel open
- [ ] Astronaut docks at panel header
- [ ] DEPLOY triggers rover animation
- [ ] Rover resets after 5 seconds or click

### Accessibility Requirements
- [ ] All controls keyboard accessible (Tab, Arrow keys, Enter)
- [ ] Focus trap works in open panel
- [ ] Focus restoration on panel close
- [ ] Screen reader announces panel state changes
- [ ] All animations respect prefers-reduced-motion
- [ ] WCAG 2.1 AA contrast ratios maintained
- [ ] No automated accessibility violations (axe)

### Performance Requirements
- [ ] Panel animations run at 60fps
- [ ] Initial page load Lighthouse score > 90
- [ ] JS bundle size increase < 50kb (gzipped)
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s

### Testing Requirements
- [ ] Unit tests for PanelCoordinator state management
- [ ] Unit tests for announce utility
- [ ] E2E test: Open panel via hub button
- [ ] E2E test: Close panel via ESC key
- [ ] E2E test: Deep linking opens correct panel
- [ ] E2E test: Browser back button closes panel
- [ ] E2E test: Keyboard navigation through hub controls
- [ ] E2E test: DEPLOY rover animation
- [ ] Accessibility test: Hub has no violations
- [ ] Accessibility test: Open panel has no violations

---

## Open Questions

1. **Mobile Behavior:** Should hub controls stack vertically on mobile or use a different layout?
   - **Recommendation:** Responsive grid (2 columns on mobile, 3 on tablet, circular on desktop)

2. **Panel Width:** Should panels be full-width on mobile?
   - **Recommendation:** Yes, full-width on < 768px for better readability

3. **Astronaut Mobile:** Should astronaut docking work on mobile or be hidden?
   - **Recommendation:** Hide astronaut on < 768px (existing behavior in AstronautMascot.tsx)

4. **DEPLOY Panel:** Should DEPLOY open a panel or just trigger rover animation?
   - **Recommendation:** Just trigger rover animation (no panel). Delight moment, not content.

5. **Scroll Position:** Should panels remember scroll position when closed and reopened?
   - **Recommendation:** No, reset to top. Simpler implementation, clearer UX.

6. **Hub State:** Should hub show active state when panel is open?
   - **Recommendation:** Yes, dim hub and highlight active control (border glow)

7. **Transition Duration:** What feels right for panel slide-in?
   - **Recommendation:** 300ms with spring easing (test and adjust)

8. **NASA APOD API:** Should we integrate NASA's Astronomy Picture of the Day API?
   - **Current:** Hubble data is static JSON in `/public/hubble/data.json`
   - **Recommendation:** Keep static for now. If NASA API integration desired, add to StarModal as enhancement later.
   - **Action:** Prompt user if they want to add `PUBLIC_NASA_API_KEY` env var

---

## References

- [Astro Islands Architecture](https://docs.astro.build/en/concepts/islands/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Motion Library Documentation](https://motion.dev/)
- [URL Hash Navigation Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/History_API)
- [Focus Trap React Patterns](https://github.com/focus-trap/focus-trap-react)

---

## Notes

- This ADR represents a significant UX transformation while preserving the technical foundation (Astro + React islands, Tailwind, TypeScript).
- The hybrid approach (React islands for interactivity, Astro for content) leverages each tool's strengths.
- Content logic is fully reused; only markup is adapted for React compatibility.
- All existing tests, CI/CD, and documentation will be updated to reflect the new architecture.
- The space station theme is elevated from decorative (starfield, astronaut) to foundational (hub, docked panels, rover).

---

**Next Steps:**
1. User review and approval of this ADR
2. Proceed with Phase 1 implementation
3. Iterate based on user feedback and testing results

---

**Author Note:** This transformation is ambitious but achievable. The architecture is solid, the plan is detailed, and the existing codebase is well-structured to support this enhancement. Let's build a stellar portfolio experience! 🚀
