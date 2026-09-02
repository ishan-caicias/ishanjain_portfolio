# ADR-0009 — Asset weight is budgeted, configurable, and ratcheted at the high-water mark

**Date:** 2026-07-21
**Status:** Accepted
**Context:** PF-10 C4 closeout ([TR-079](../test-reports/TR-079.md))

## Context

`npm run budget:check` has gated the JS and WASM payload since PF-09 B6, and it has caught real
defects — the `largestChunkGz` ceiling is the TR-027 barrel-import canary and remains the single
most valuable number in the build.

It has never looked at `public/assets` at all.

Across PF-10 that directory grew to **209 MB**: the 47 MB SDSS DR18 galaxy field (C2), the DR3
asteroid pack (C3), 61 planetary surface and elevation maps and a 1,364-tile virtual-texture
normal pyramid (C4). Every one of those was a deliberate, justified addition. None of them was
_measured against anything_, because there was nothing to measure against.

The concrete cost of that gap is recorded in TR-077 Part 4 and TR-078 Part 7: the 63 MB of VT
tiles had to be escalated to the owner **by hand**, as a paragraph in a test report, because no
automated signal existed. A gate would have raised it on the commit that introduced it.

Two further facts shape the decision:

1. **`resources/` is gitignored, so CI can never regenerate any asset.** The committed bytes under
   `public/assets` _are_ the deliverable. Asset weight is therefore not an emergent property of a
   build — it is a reviewable, committed fact, which is exactly the kind of thing a gate can hold.
2. **Nobody knows what the right ceiling is.** It has never been measured on real hardware over a
   real network, and ADR-0008 has already established that this project ships first and measures
   on real devices afterwards.

## Decision

**1. `public/assets` is gated, in raw bytes, at three granularities.**

Total, largest-single-file, and per-directory. Per-directory matters because it makes a regression
_attributable_: "assets grew 46 MB" is a shrug, "`assets/planets` grew 46 MB" is a conversation.
Largest-single-file is separate from the total on the same reasoning — a new 45 MB asset and a
thousand tiles each growing slightly are different events wanting different responses.

Raw bytes, not gzip: JPEG and PNG are already entropy-coded, so gzipping ~2,600 files would burn
real CPU per gate run to discover they are ~0% smaller. Raw bytes are also what the visitor's disk
cache and the CDN's egress actually see.

The gate reads `public/assets` rather than `dist/`. `astro build` copies `public/` verbatim, so
they are identical for this measurement — but reading the source tree means the asset half of the
gate **needs no build**, which is what lets it run from `predev`/`prepreview` and as a fast
standalone CI step instead of only after a multi-minute build.

**2. Every budget moves to `budgets.config.mjs` — data, separate from measurement.**

The JS/WASM ceilings move there too. Previously they were a `const` literal inside the measurement
script, which made every tuning pass a code edit in a file full of logic. Policy and measurement
are now separate files, so adjusting a ceiling is a one-line data change with a comment beside it.

**3. Asset ceilings start AT the high-water mark, with no headroom.**

This differs deliberately from the bundle ceilings, which carry ~15% slack off a measured
baseline. There is no defensible slack figure for assets yet, so the gate answers the only question
currently answerable — _did this grow?_ — as loudly as possible, and the numbers get walked **down**
as real-device data arrives under ADR-0008's post-ship measurement obligation.

The consequence is intended: **tripping this gate is normal, and is not a failure.** Landing an
asset means raising the number in the same commit with a one-line why. That is the workflow, not an
exception to it.

**4. A raised budget must be justified in the same commit. Never raised to make CI green.**

Inherited unchanged from the bundle gate's founding rule, and restated because the asset budgets
will be edited far more often than the bundle ones. A budget quietly raised to unblock a build has
been converted from a signal into a rubber stamp.

## Consequences

- The gate caught its own first real growth immediately: the C4 pack completion took
  `public/assets` from 208.92 MB to 255.26 MB, and CI refused it until the ceiling was raised
  deliberately with the cause recorded. That is the intended behaviour, demonstrated rather than
  asserted.
- It also surfaced **6.58 MB of `-base` (2048) tier maps that are shipped but never fetched** —
  `babylon-engine.ts` reads only `.high` and `.ultra`. Kept rather than trimmed, because C4.3's
  tier gating is the work that will consume them; recorded in the config so it is a known
  quantity rather than a discovery.
- Asset budgets will be edited often. That is by design; the audit trail is the git history of one
  small data file.
- **Not covered by this ADR:** what the ceilings _should_ be. That needs the real-device pass
  ADR-0008 defers, and the two largest levers — the `ultra` tier (70.1 MB) and the VT pyramid
  (62.9 MB) — are explicitly left as open owner decisions rather than trimmed on a guess.

## Alternatives considered

**Gate `dist/` after the build, like the JS half.** Rejected: it would make the asset check
unavailable to the dev-time hooks and would add minutes to the feedback loop for a measurement
that needs none, since `public/` is copied verbatim.

**Set ceilings with headroom, as the bundle budgets do.** Rejected: headroom encodes a belief about
the right size, and no such belief is currently justified by measurement. A high-water ratchet
encodes only what is true — this is what it costs today.

**Fail only on the total.** Rejected: a total-only gate reports that something grew without saying
what, which in a 2,600-file tree is barely more actionable than no gate at all.
