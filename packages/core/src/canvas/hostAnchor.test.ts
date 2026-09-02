import { describe, it, expect } from 'vitest';
import { hostAnchorStyle } from './hostAnchor';

const VIEWPORT = { width: 1000, height: 800 };
const PANEL = { width: 200, height: 100 };
const OFFSET = { top: 76, right: 8 };

describe('hostAnchorStyle', () => {
  it('sits at the host top-right corner plus the offset', () => {
    expect(hostAnchorStyle({
      host: { x: 100, y: 50, width: 600, height: 400 },
      panel: PANEL, viewport: VIEWPORT, offset: OFFSET,
    })).toEqual({ top: 126, right: 308 });
  });

  it('pulls the panel down when the host has scrolled above the viewport', () => {
    expect(hostAnchorStyle({
      host: { x: 100, y: -200, width: 600, height: 400 },
      panel: PANEL, viewport: VIEWPORT, offset: OFFSET,
    }).top).toBe(0);
  });

  it('keeps the panel on screen when the host runs past the right edge', () => {
    expect(hostAnchorStyle({
      host: { x: 100, y: 50, width: 1200, height: 400 },
      panel: PANEL, viewport: VIEWPORT, offset: OFFSET,
    }).right).toBe(0);
  });

  it('lifts the panel when the offset would push it below the viewport', () => {
    expect(hostAnchorStyle({
      host: { x: 100, y: 700, width: 600, height: 400 },
      panel: PANEL, viewport: VIEWPORT, offset: OFFSET,
    }).top).toBe(700);
  });

  it('keeps padding between the panel and the viewport edge', () => {
    expect(hostAnchorStyle({
      host: { x: 100, y: -200, width: 600, height: 400 },
      panel: PANEL, viewport: VIEWPORT, offset: OFFSET, padding: 12,
    }).top).toBe(12);
  });

  it('pins a panel taller than the viewport to the top rather than off it', () => {
    expect(hostAnchorStyle({
      host: { x: 100, y: 50, width: 600, height: 400 },
      panel: { width: 200, height: 900 }, viewport: VIEWPORT, offset: OFFSET,
    }).top).toBe(0);
  });
});
