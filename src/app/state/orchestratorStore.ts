/**
 * Single orchestration store for navigation + deploy.
 * Deterministic: no timeouts; store only holds state. Components run animations
 * and call setters to report completion (e.g. ship opened -> setShipState('open')).
 */

export type SectionKey =
  | "bio"
  | "skills"
  | "experience"
  | "projects"
  | "writing"
  | "connect"
  | null;

export type ShipState = "idle" | "opening" | "open" | "closing";

export type DeployState = "idle" | "deploying" | "landed" | "flagged";

export interface OrchestratorState {
  activeSection: SectionKey;
  shipState: ShipState;
  deployState: DeployState;
}

const initialState: OrchestratorState = {
  activeSection: null,
  shipState: "idle",
  deployState: "idle",
};

let state: OrchestratorState = { ...initialState };

type Listener = (s: OrchestratorState) => void;
const listeners = new Set<Listener>();

function getState(): OrchestratorState {
  return state;
}

function setState(partial: Partial<OrchestratorState>): void {
  state = { ...state, ...partial };
  listeners.forEach((fn) => fn(state));
}

/** Select a section: sets activeSection and transitions ship to opening. */
export function selectSection(key: SectionKey): void {
  if (key === null) {
    setState({ activeSection: null, shipState: "closing" });
    return;
  }
  setState({
    activeSection: key,
    shipState: "opening",
  });
}

/** Close current section; ship transitions to closing. */
export function closeSection(): void {
  setState({
    activeSection: null,
    shipState: "closing",
  });
}

/** Called by SpaceshipScene when door open animation finishes. */
export function setShipState(shipState: ShipState): void {
  setState({ shipState });
}

/** Deploy rover (wire to rover later). */
export function requestDeploy(): void {
  setState({ deployState: "deploying" });
}

export function resetDeploy(): void {
  setState({ deployState: "idle" });
}

/** Subscribe to state changes (returns unsubscribe). */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reset to initial state (for tests). */
export function reset(): void {
  state = { ...initialState };
  listeners.forEach((fn) => fn(state));
}

export const orchestratorStore = {
  getState,
  selectSection,
  closeSection,
  setShipState,
  requestDeploy,
  resetDeploy,
  subscribe,
  reset,
};
