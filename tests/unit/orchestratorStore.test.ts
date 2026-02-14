import { describe, it, expect, beforeEach } from "vitest";
import {
  orchestratorStore,
  selectSection,
  closeSection,
  setShipState,
  requestDeploy,
  resetDeploy,
} from "@/app/state/orchestratorStore";

describe("orchestratorStore", () => {
  beforeEach(() => {
    orchestratorStore.reset();
  });

  describe("selectSection", () => {
    it("sets activeSection and shipState to opening", () => {
      selectSection("projects");
      const state = orchestratorStore.getState();
      expect(state.activeSection).toBe("projects");
      expect(state.shipState).toBe("opening");
    });

    it("selectSection(null) sets activeSection null and shipState closing", () => {
      selectSection("skills");
      selectSection(null);
      const state = orchestratorStore.getState();
      expect(state.activeSection).toBe(null);
      expect(state.shipState).toBe("closing");
    });
  });

  describe("closeSection", () => {
    it("resets activeSection and sets shipState to closing", () => {
      selectSection("experience");
      closeSection();
      const state = orchestratorStore.getState();
      expect(state.activeSection).toBe(null);
      expect(state.shipState).toBe("closing");
    });
  });

  describe("setShipState", () => {
    it("updates shipState when component reports open", () => {
      selectSection("writing");
      setShipState("open");
      expect(orchestratorStore.getState().shipState).toBe("open");
    });

    it("updates shipState to idle when component reports close done", () => {
      selectSection("bio");
      setShipState("open");
      closeSection();
      setShipState("idle");
      expect(orchestratorStore.getState().shipState).toBe("idle");
    });
  });

  describe("requestDeploy / resetDeploy", () => {
    it("requestDeploy sets deployState to deploying", () => {
      requestDeploy();
      expect(orchestratorStore.getState().deployState).toBe("deploying");
    });

    it("resetDeploy sets deployState to idle", () => {
      requestDeploy();
      resetDeploy();
      expect(orchestratorStore.getState().deployState).toBe("idle");
    });
  });

  describe("subscribe", () => {
    it("notifies when state changes", () => {
      const states: unknown[] = [];
      const unsub = orchestratorStore.subscribe((s) => states.push({ ...s }));
      selectSection("connect");
      unsub();
      selectSection("bio");
      expect(states.length).toBe(1);
      expect(states[0]).toMatchObject({
        activeSection: "connect",
        shipState: "opening",
      });
    });
  });
});
