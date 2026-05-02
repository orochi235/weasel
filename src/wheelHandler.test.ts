import { describe, expect, it } from 'vitest';
import type { WheelInput, WheelState } from './wheelHandler';
import { computeWheelAction } from './wheelHandler';

const baseState: WheelState = { zoom: 1, panX: 100, panY: 200 };
const baseInput: WheelInput = { deltaX: 0, deltaY: 0, mouseX: 400, mouseY: 300 };

describe('computeWheelAction', () => {
  it('zooms in on negative deltaY', () => {
    const result = computeWheelAction(baseState, { ...baseInput, deltaY: -100 });
    expect(result.zoom).toBeGreaterThan(baseState.zoom);
  });

  it('zooms out on positive deltaY', () => {
    const result = computeWheelAction(baseState, { ...baseInput, deltaY: 100 });
    expect(result.zoom).toBeLessThan(baseState.zoom);
  });

  it('clamps zoom to default minimum of 0.1', () => {
    const lowState = { ...baseState, zoom: 0.11 };
    const result = computeWheelAction(lowState, { ...baseInput, deltaY: 100 });
    expect(result.zoom).toBeGreaterThanOrEqual(0.1);
  });

  it('clamps zoom to default maximum of 10', () => {
    const highState = { ...baseState, zoom: 9.5 };
    const result = computeWheelAction(highState, { ...baseInput, deltaY: -100 });
    expect(result.zoom).toBeLessThanOrEqual(10);
  });

  it('honors explicit bounds', () => {
    const result = computeWheelAction(
      { ...baseState, zoom: 1.95 },
      { ...baseInput, deltaY: -100 },
      { min: 0.5, max: 2 },
    );
    expect(result.zoom).toBe(2);
  });

  it('preserves world point under mouse when zooming in', () => {
    const state: WheelState = { zoom: 1, panX: 100, panY: 200 };
    const mouse: WheelInput = { deltaX: 0, deltaY: -100, mouseX: 400, mouseY: 300 };

    const worldXBefore = (mouse.mouseX - state.panX) / state.zoom;
    const worldYBefore = (mouse.mouseY - state.panY) / state.zoom;

    const result = computeWheelAction(state, mouse);

    const worldXAfter = (mouse.mouseX - result.panX) / result.zoom;
    const worldYAfter = (mouse.mouseY - result.panY) / result.zoom;

    expect(worldXAfter).toBeCloseTo(worldXBefore, 5);
    expect(worldYAfter).toBeCloseTo(worldYBefore, 5);
  });

  it('preserves world point under mouse when zooming out', () => {
    const state: WheelState = { zoom: 2, panX: -50, panY: -50 };
    const mouse: WheelInput = { deltaX: 0, deltaY: 50, mouseX: 250, mouseY: 250 };

    const worldXBefore = (mouse.mouseX - state.panX) / state.zoom;
    const worldYBefore = (mouse.mouseY - state.panY) / state.zoom;

    const result = computeWheelAction(state, mouse);

    const worldXAfter = (mouse.mouseX - result.panX) / result.zoom;
    const worldYAfter = (mouse.mouseY - result.panY) / result.zoom;

    expect(worldXAfter).toBeCloseTo(worldXBefore, 5);
    expect(worldYAfter).toBeCloseTo(worldYBefore, 5);
  });

  describe('shift+wheel scrolls horizontally', () => {
    it('scrolls left on positive deltaY', () => {
      const result = computeWheelAction(baseState, { ...baseInput, deltaY: 30, shiftKey: true });
      expect(result.panX).toBe(70);
      expect(result.panY).toBe(200);
      expect(result.zoom).toBe(1);
    });

    it('scrolls right on negative deltaY', () => {
      const result = computeWheelAction(baseState, { ...baseInput, deltaY: -30, shiftKey: true });
      expect(result.panX).toBe(130);
      expect(result.panY).toBe(200);
      expect(result.zoom).toBe(1);
    });
  });

  describe('cmd+wheel scrolls vertically', () => {
    it('scrolls up on positive deltaY', () => {
      const result = computeWheelAction(baseState, { ...baseInput, deltaY: 30, metaKey: true });
      expect(result.panX).toBe(100);
      expect(result.panY).toBe(170);
      expect(result.zoom).toBe(1);
    });

    it('scrolls down on negative deltaY', () => {
      const result = computeWheelAction(baseState, { ...baseInput, deltaY: -30, metaKey: true });
      expect(result.panX).toBe(100);
      expect(result.panY).toBe(230);
      expect(result.zoom).toBe(1);
    });
  });
});
