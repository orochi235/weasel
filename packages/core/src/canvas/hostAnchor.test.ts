import { describe, it, expect } from 'vitest';
import { hostAnchorRect, hostAnchorCss } from './hostAnchor';

const VIEWPORT = { width: 1000, height: 800 };
const PANEL = { width: 200, height: 100 };
const HOST = { x: 100, y: 50, width: 600, height: 400 };
const TOP_RIGHT = { x: 'end', y: 'start' } as const;
const BOTTOM_LEFT = { x: 'start', y: 'end' } as const;

describe('hostAnchorRect', () => {
  it('insets from the host corner the alignment names', () => {
    expect(hostAnchorRect({
      host: HOST, panel: PANEL, viewport: VIEWPORT,
      align: TOP_RIGHT, offset: { x: 8, y: 76 },
    })).toEqual({ x: 492, y: 126, width: 200, height: 100 });
  });

  it('insets from the opposite corner for the opposite alignment', () => {
    expect(hostAnchorRect({
      host: HOST, panel: PANEL, viewport: VIEWPORT,
      align: BOTTOM_LEFT, offset: { x: 8, y: 8 },
    })).toEqual({ x: 108, y: 342, width: 200, height: 100 });
  });

  it('centers on an axis when asked to', () => {
    expect(hostAnchorRect({
      host: HOST, panel: PANEL, viewport: VIEWPORT,
      align: { x: 'center', y: 'start' }, offset: { x: 0, y: 0 },
    }).x).toBe(300);
  });

  it('pulls the panel back when the host has scrolled above the viewport', () => {
    expect(hostAnchorRect({
      host: { ...HOST, y: -200 }, panel: PANEL, viewport: VIEWPORT,
      align: TOP_RIGHT, offset: { x: 8, y: 76 },
    }).y).toBe(0);
  });

  it('keeps the panel on screen when the host runs past the right edge', () => {
    expect(hostAnchorRect({
      host: { ...HOST, width: 1200 }, panel: PANEL, viewport: VIEWPORT,
      align: TOP_RIGHT, offset: { x: 8, y: 76 },
    }).x).toBe(800);
  });

  it('keeps padding between the panel and the viewport edge', () => {
    expect(hostAnchorRect({
      host: { ...HOST, y: -200 }, panel: PANEL, viewport: VIEWPORT,
      align: TOP_RIGHT, offset: { x: 8, y: 76 }, padding: 12,
    }).y).toBe(12);
  });

  it('pins a panel taller than the viewport to the top rather than off it', () => {
    expect(hostAnchorRect({
      host: HOST, panel: { width: 200, height: 900 }, viewport: VIEWPORT,
      align: TOP_RIGHT, offset: { x: 8, y: 76 },
    }).y).toBe(0);
  });
});

describe('hostAnchorCss', () => {
  it('pins the edges the alignment names, so a growing box holds that corner', () => {
    expect(hostAnchorCss(
      { x: 492, y: 126, width: 200, height: 100 }, TOP_RIGHT, VIEWPORT,
    )).toEqual({ top: 126, right: 308 });
  });

  it('pins the opposite edges for the opposite alignment', () => {
    expect(hostAnchorCss(
      { x: 108, y: 342, width: 200, height: 100 }, BOTTOM_LEFT, VIEWPORT,
    )).toEqual({ bottom: 358, left: 108 });
  });

  it('treats a centered axis as pinned to its leading edge', () => {
    expect(hostAnchorCss(
      { x: 300, y: 126, width: 200, height: 100 }, { x: 'center', y: 'start' }, VIEWPORT,
    )).toEqual({ top: 126, left: 300 });
  });
});
