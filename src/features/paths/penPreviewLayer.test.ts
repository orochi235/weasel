import { describe, it, expect, vi } from 'vitest';
import { createPenPreviewLayer } from './penPreviewLayer';
import { useUserPenTool, type PenScratch } from '../../tools/builtin/useUserPenTool';
import { renderHook } from '@testing-library/react';
import type { PolygonPath } from './types';

interface Pose { kind: 'path'; path: PolygonPath; closed: boolean }

function makeStubCtx(): {
  ctx: CanvasRenderingContext2D;
  calls: { fn: string; args: unknown[] }[];
} {
  const calls: { fn: string; args: unknown[] }[] = [];
  const rec = (fn: string) => (...args: unknown[]) => { calls.push({ fn, args }); };
  const ctx = {
    beginPath: rec('beginPath'),
    moveTo: rec('moveTo'),
    lineTo: rec('lineTo'),
    bezierCurveTo: rec('bezierCurveTo'),
    arc: rec('arc'),
    closePath: rec('closePath'),
    fill: rec('fill'),
    stroke: rec('stroke'),
    save: rec('save'),
    restore: rec('restore'),
    setLineDash: rec('setLineDash'),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

function setup() {
  const adapter = { addObject: vi.fn(() => 'id'), setSelection: vi.fn() };
  const wrapPath = (path: PolygonPath, opts: { closed: boolean }): Pose =>
    ({ kind: 'path', path, closed: opts.closed });
  const { result } = renderHook(() => useUserPenTool<Pose>({ wrapPath, adapter }));
  const tool = result.current;
  const scratch = tool.initScratch!() as PenScratch;
  const layer = createPenPreviewLayer({ penTool: tool });
  return { tool, scratch, layer };
}

describe('createPenPreviewLayer', () => {
  it('returns a screen-space RenderLayer with a stable id', () => {
    const { layer } = setup();
    expect(layer.space).toBe('screen');
    expect(layer.id).toBe('penPreview');
  });

  it('renders nothing in Idle state (no anchors, no cursor)', () => {
    const { layer } = setup();
    const { ctx, calls } = makeStubCtx();
    layer.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    // No path drawing calls (moveTo/lineTo/arc) should fire.
    expect(calls.some((c) => c.fn === 'moveTo' || c.fn === 'arc' || c.fn === 'lineTo')).toBe(false);
  });

  it('renders an anchor circle (arc) per placed anchor', () => {
    const { scratch, layer } = setup();
    scratch.current = { anchors: [{ x: 10, y: 20 }, { x: 30, y: 40 }], closed: false };
    const { ctx, calls } = makeStubCtx();
    layer.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    const arcs = calls.filter((c) => c.fn === 'arc');
    expect(arcs.length).toBeGreaterThanOrEqual(2);
  });

  it('renders rubber-band line from latest anchor to cursor', () => {
    const { scratch, layer } = setup();
    scratch.current = { anchors: [{ x: 10, y: 20 }], closed: false };
    scratch.cursor = { x: 100, y: 200 };
    const { ctx, calls } = makeStubCtx();
    layer.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    // moveTo(10,20) + lineTo(100,200) somewhere among draw calls (screen = world here).
    const moveTos = calls.filter((c) => c.fn === 'moveTo' && c.args[0] === 10 && c.args[1] === 20);
    const lineTos = calls.filter((c) => c.fn === 'lineTo' && c.args[0] === 100 && c.args[1] === 200);
    expect(moveTos.length).toBeGreaterThan(0);
    expect(lineTos.length).toBeGreaterThan(0);
  });

  it('renders a curve preview (bezierCurveTo) when latest anchor has outHandle and cursor is set', () => {
    const { scratch, layer } = setup();
    scratch.current = {
      anchors: [{ x: 0, y: 0, outHandle: { x: 50, y: 0 } }],
      closed: false,
    };
    scratch.cursor = { x: 100, y: 100 };
    const { ctx, calls } = makeStubCtx();
    layer.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    expect(calls.some((c) => c.fn === 'bezierCurveTo')).toBe(true);
  });

  it('renders close-hint highlight (extra arc on first anchor) when closeHintActive', () => {
    const { scratch, layer } = setup();
    scratch.current = {
      anchors: [{ x: 10, y: 10 }, { x: 100, y: 10 }, { x: 50, y: 100 }],
      closed: false,
    };
    scratch.cursor = { x: 12, y: 12 };
    scratch.closeHintActive = true;
    const { ctx, calls } = makeStubCtx();
    layer.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    // First anchor is at (10,10). With closeHintActive the layer should draw
    // an extra (larger) ring at that point — at least one arc with cx≈10, cy≈10.
    const arcsAtFirst = calls.filter((c) => c.fn === 'arc' && c.args[0] === 10 && c.args[1] === 10);
    // One small anchor circle plus the close-hint ring → ≥2.
    expect(arcsAtFirst.length).toBeGreaterThanOrEqual(2);
  });

  it('passes coords through worldToScreen (verified via non-identity view)', () => {
    const { scratch, layer } = setup();
    scratch.current = { anchors: [{ x: 10, y: 20 }], closed: false };
    const { ctx, calls } = makeStubCtx();
    // view = pan (5, 5), scale 2 → world (10, 20) → screen ((10-5)*2, (20-5)*2) = (10, 30)
    layer.draw(ctx, undefined, { x: 5, y: 5, scale: 2 });
    const arcAtScreen = calls.find((c) => c.fn === 'arc' && c.args[0] === 10 && c.args[1] === 30);
    expect(arcAtScreen).toBeTruthy();
  });

  it('renders finished subpaths as faded outlines', () => {
    const { scratch, layer } = setup();
    scratch.finishedSubpaths = [{
      anchors: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }],
      closed: true,
    }];
    const { ctx, calls } = makeStubCtx();
    layer.draw(ctx, undefined, { x: 0, y: 0, scale: 1 });
    // Should issue moveTo(0,0), lineTo(10,0), lineTo(5,10), closePath, stroke.
    expect(calls.some((c) => c.fn === 'moveTo')).toBe(true);
    expect(calls.some((c) => c.fn === 'closePath')).toBe(true);
    expect(calls.some((c) => c.fn === 'stroke')).toBe(true);
  });
});
