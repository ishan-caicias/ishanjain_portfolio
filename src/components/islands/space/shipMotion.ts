import type { WarpPhase } from "./sceneEvents";

/** The small amount of inertial state needed to animate the ship's bank. */
export interface ShipMotionState {
  readonly bank: number;
  readonly bankVelocity: number;
}

const MAX_BANK = 1;
const MAX_BANK_VELOCITY = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Advances the ship bank by one frame using a critically damped response.
 *
 * The explicit integration keeps this function deterministic and inexpensive
 * enough to call from the renderer's animation loop. Inputs are sanitized so
 * a stalled tab or an invalid sensor value cannot push the ship out of bounds.
 */
export function nextShipMotion(
  state: ShipMotionState,
  targetBank: number,
  dt: number,
  phase: WarpPhase,
): ShipMotionState {
  // The phase is intentionally part of the API so the renderer can evolve the
  // travel phases without changing its motion call site. Banking is the same
  // inertial response in each phase; plume intensity is phase-specific below.
  void phase;

  const bank = clamp(finiteOr(state.bank, 0), -MAX_BANK, MAX_BANK);
  const bankVelocity = clamp(
    finiteOr(state.bankVelocity, 0),
    -MAX_BANK_VELOCITY,
    MAX_BANK_VELOCITY,
  );
  const target = clamp(finiteOr(targetBank, 0), -MAX_BANK, MAX_BANK);
  const elapsed = Math.max(0, finiteOr(dt, 0));

  if (elapsed === 0) {
    return { bank, bankVelocity };
  }

  const acceleration = 28 * (target - bank) - 10.6 * bankVelocity;
  const nextVelocity = clamp(
    bankVelocity + acceleration * elapsed,
    -MAX_BANK_VELOCITY,
    MAX_BANK_VELOCITY,
  );
  const nextBank = clamp(bank + nextVelocity * elapsed, -MAX_BANK, MAX_BANK);

  return { bank: nextBank, bankVelocity: nextVelocity };
}

/** Returns the deterministic nozzle/plume intensity for a travel phase. */
export function plumeIntensityForPhase(phase: WarpPhase): number {
  switch (phase) {
    case "warp":
      return 1;
    case "decel":
      return 0.8;
    case "aim":
      return 0.45;
    case "flip":
      return 0.65;
    case "idle":
    default:
      return 0.25;
  }
}
