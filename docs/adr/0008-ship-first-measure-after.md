# ADR-0008 — Ship PF-10 at full scope, measure on real devices after

**Date:** 2026-07-21
**Status:** Accepted
**Supersedes (in part):** the GO/NO-GO framing of PF-10 C2 and the frame-budget precondition on
PF-10 C3. **Does not supersede** PF-09's B6 device budgets themselves, which remain the standard
the measurements will be judged against.

## Context

Three PF-10 phases were code-complete but formally blocked on the same thing, and had been for
several sessions:

- **C2 (SDSS DR18, 3,637,862 real galaxies)** — wired live since TR-067, held behind an explicit
  ⛔ GO/NO-GO gate requiring desktop / iPad / mid-Android measurement before shipping to any tier.
- **C3 (154,662 real Gaia DR3 asteroids)** — code-complete since TR-074, orbital motion since
  TR-075, with its exit criterion stated as "frame budget holds on every device class".
- **C4.1/C4.2 (planetary spheres, VT streaming, Venus)** — inheriting the same expectation.

The instrument problem is the reason none of these gates ever ran. TR-067 measured CI's bundled
Chromium (SwiftShader) at **~3 fps against ~50 fps on real Chrome/GPU hardware on the identical
scene** — a ~17× gap. So the only automated instrument available is confirmed unrepresentative at
this scene's scale, and every gate has been waiting on a manual real-device pass that keeps not
happening because there is always another feature to land first.

TR-075 sharpened the cost of that: an isolated A/B showed the belt's orbital motion carries a real
frame-time cost **on SwiftShader**, which is precisely the instrument that over-weights per-vertex
work relative to a real GPU. Acting on that reading would have meant tier-gating a feature from a
software rasterizer's opinion — the exact mistake TR-066 made with the white-dwarf gate and TR-067
had to reverse.

## Decision

**Owner direction, 2026-07-21: ship every PF-10 feature at full scope. Collect real-device data
from the shipped build, then adjust rendering from that data.**

Concretely:

1. **C2 ships.** The full 3,637,862-record SDSS DR18 field, no tier gate, no decimated subsample.
   The GO/NO-GO gate is **retired as a precondition** and replaced by post-ship measurement.
2. **C3 ships at full scope.** All 154,662 real asteroids, orbital motion active, unchanged tier
   body counts for the Havok subset.
3. **C4 ships at full scope.** Spheres, ultra textures, VT streaming, the Venus descent.
4. **PF-09's B6 frame-budget gate is NOT applied to PF-10 items.** It is revisited after each
   PF-10 item is complete in full, against real hardware, rather than blocking each item in turn.

## Why this is the right call rather than a shortcut

**The measurement is better after shipping, not before.** Every gate needs the same real devices
against the same scene. Running that pass once against the complete scene produces one coherent
dataset; running it five times against five partial scenes produces five datasets that cannot be
compared, and delays every feature behind the slowest measurement.

**The rollback is cheap and already built.** Every heavy layer is independently disableable:
`?engine=webgl` restores the archived engine wholesale, `?tier=lite` reduces quality budgets,
and each bulk layer is a separate lazy fetch after `cosmos:ready`. Nothing here is a one-way door.

**Startup is not what is at risk.** Every bulk asset — SDSS, the belt, planet textures, VT tiles —
is fetched _after_ the first frame and _after_ `cosmos:ready`, none is awaited, and none gates
startup. The risk is sustained frame rate on weak hardware, which is exactly the thing only real
hardware can report.

**It matches the owner's stated priority order.** Goal 1 is maximum realism; goal 2 is measured
performance. Shipping full scope and then measuring serves both in that order. Gating on an
unrepresentative instrument serves neither.

## Consequences

- **PF-10 phases are no longer blocked on measurement.** C2 and C3 move from "gate pending" to
  shipped; their exit criteria are rewritten as post-ship measurement obligations rather than
  preconditions.
- **A real obligation is created, not removed.** The device pass still has to happen — on the
  owner's mid-tier and flagship Android hardware, on desktop, and on a tablet if one becomes
  available — and its results still get a TR. This ADR changes _when_, not _whether_.
- **A regression may reach a visitor before it reaches us.** Accepted deliberately: the site is a
  portfolio, not a service, and the failure mode is a low frame rate on weak hardware rather than
  a broken page. The dual-engine seam and tier flags bound the blast radius.
- **CI's E2E suite remains a correctness instrument, not a performance one.** Its SwiftShader
  timings must not be read as device data, and the established rotating-flake set stays a known
  quantity rather than a signal.

## Alternatives rejected

- **Keep gating.** Rejected: it has already blocked three phases across multiple sessions with no
  measurement produced, and the gate depends on hardware access that is intermittent.
- **Tier-gate defensively from SwiftShader numbers.** Rejected explicitly — this is TR-066's
  white-dwarf mistake, which TR-067 had to reverse on owner direction. Doing it again from the
  same class of evidence would repeat a documented error.
- **Ship a decimated SDSS subsample as a safe default.** Rejected: it trades away the phase's
  entire point (a real, complete catalog) to hedge against a risk nobody has measured.
