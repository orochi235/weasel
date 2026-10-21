import { describe, expect, it } from 'vitest';
import {
  anchorsToPath, cubicPointAt, pathToAnchors, type AnchorSet, type PenAnchor, type PolygonPath,
} from '@weasel-js/geom';
import { actionCursor, tuneAction, type InvocationCtx, type OngoingHandle, type OngoingInvoker } from '@weasel-js/routing';
import { makeEditAnchorsDepForTests as makeEditAnchorsDep } from '@weasel-js/core/test-seams';
import {
  brushRingCursor, simplifyBrushAction, SIMPLIFY_BRUSH_RADIUS_PX, SIMPLIFY_BRUSH_TOOL,
} from './simplifyBrush';

/** A gentle wave sampled every 5 units along x from 0 to 400: dense, so most anchors are redundant. */
function wave(): AnchorSet {
  return {
    anchors: [Array.from({ length: 81 }, (_, i) => ({ x: i * 5, y: 20 * Math.sin(i / 8) }))],
    closed: [false],
  };
}

/** The wave with a smooth bump 6 tall on top of it around x = 200. */
function bumpy(): AnchorSet {
  const set = wave();
  set.anchors[0] = set.anchors[0].map((a) => ({ x: a.x, y: a.y - 6 * Math.exp(-(((a.x - 200) / 12) ** 2)) }));
  return set;
}

/** Points along every segment of `sub`, curves included. */
function sampled(sub: readonly PenAnchor[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < sub.length; i++) {
    const a = sub[i], b = sub[i + 1];
    for (let k = 0; k <= 16; k++) out.push(cubicPointAt(a, a.outHandle ?? a, b.inHandle ?? b, b, k / 16));
  }
  return out;
}

const encode = (set: AnchorSet): PolygonPath => anchorsToPath(set.anchors, set.closed);
const anchorsOf = (path: unknown): PenAnchor[] => pathToAnchors(path as PolygonPath).anchors[0];

function setup(original: AnchorSet = wave(), tool: string | null = SIMPLIFY_BRUSH_TOOL) {
  const commits: Array<{ path: PolygonPath; label: string }> = [];
  let current = encode(original);
  const dep = makeEditAnchorsDep({
    editingId: 'p1',
    getEditablePath: () => current,
    applyEdit: (_id, worldPath, label) => {
      current = worldPath as PolygonPath;
      commits.push({ path: current, label });
    },
  });
  dep.setTool(tool);
  const deps = { editAnchors: dep, view: { get: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }) } };
  const at = (x: number, y: number): InvocationCtx => ({
    world: { x, y },
    screen: { x, y },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: deps as never,
  });
  return { dep, commits, at, original: anchorsToPath(original.anchors, original.closed) };
}

const start = (ctx: InvocationCtx, params?: Record<string, unknown>): OngoingHandle =>
  (simplifyBrushAction.invoker as OngoingInvoker).start(ctx, params ? { params } : undefined);

/** Brush along the wave from x0 to x1, a point every 5 units. */
function brushAlong(h: OngoingHandle, at: (x: number, y: number) => InvocationCtx, x0: number, x1: number) {
  for (let x = x0; x <= x1; x += 5) h.onMove?.(at(x, 20 * Math.sin(x / 40)));
  h.onEnd?.(at(x1, 0), 'commit');
}

/** The farthest the curve through `after` strays from the polyline through `before`. */
function worstOff(after: readonly PenAnchor[], before: readonly PenAnchor[]): number {
  let worst = 0;
  for (const p of sampled(after)) {
    let best = Infinity;
    for (let i = 0; i + 1 < before.length; i++) {
      const a = before[i], b = before[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
      best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
    }
    worst = Math.max(worst, best);
  }
  return worst;
}

describe('simplifyBrush', () => {
  it('thins the brushed stretch, staying within the tolerance, as one undo step', () => {
    const { commits, at, original } = setup();
    const h = start(at(100, 20 * Math.sin(2.5)), { radiusPx: 6, tolerance: 0.5 });
    brushAlong(h, at, 100, 300);
    expect(commits).toHaveLength(1);
    expect(commits[0].label).toBe('Simplify brush');
    const after = anchorsOf(commits[0].path);
    expect(after.length).toBeLessThan(81 - 25);
    expect(worstOff(after, anchorsOf(original))).toBeLessThan(0.5 + 0.05);
  });

  it('leaves every anchor outside the brush where it was', () => {
    const { commits, at, original } = setup();
    const h = start(at(100, 20 * Math.sin(2.5)), { radiusPx: 6, tolerance: 0.5 });
    brushAlong(h, at, 100, 300);
    const before = anchorsOf(original);
    const after = anchorsOf(commits[0].path);
    expect(after.slice(0, 19)).toEqual(before.slice(0, 19));
    expect(after.slice(-19)).toEqual(before.slice(-19));
  });

  it('keeps a detail under the brush at a tight tolerance', () => {
    const { commits, at, original } = setup(bumpy());
    const h = start(at(150, 0), { radiusPx: 30, tolerance: 0.25 });
    brushAlong(h, at, 150, 250);
    const after = anchorsOf(commits[0].path);
    expect(after.length).toBeLessThan(81);
    // The bump rises 6 above the wave; the curve still reaches it, to within the tolerance.
    const top = Math.min(...sampled(after).filter((p) => Math.abs(p.x - 200) < 3).map((p) => p.y));
    expect(top).toBeLessThan(20 * Math.sin(5) - 6 + 0.25 + 0.05);
    expect(worstOff(after, anchorsOf(original))).toBeLessThan(0.25 + 0.05);
  });

  it('previews the refit while the brush is down, and commits nothing on cancel', () => {
    const { commits, at } = setup();
    const h = start(at(100, 0), { radiusPx: 60, tolerance: 0.5 });
    expect(h.previewIds?.()).toEqual(['p1']);
    expect(anchorsOf(h.previewPose?.('p1')).length).toBeLessThan(81);
    h.onEnd?.(at(100, 0), 'cancel');
    expect(commits).toHaveLength(0);
  });

  it('commits nothing for a stroke that thinned nothing', () => {
    const { commits, at } = setup();
    const h = start(at(200, 80), { radiusPx: 6 });
    h.onMove?.(at(260, 80));
    h.onEnd?.(at(260, 80), 'commit');
    expect(commits).toHaveLength(0);
  });

  it('shows its footprint as a brush overlay and a ring cursor', () => {
    const { at } = setup();
    const h = start(at(0, 60));
    h.onMove?.(at(10, 60));
    expect(h.overlay?.()).toEqual({
      kind: 'brush',
      points: [{ x: 0, y: 60 }, { x: 10, y: 60 }],
      radiusPx: SIMPLIFY_BRUSH_RADIUS_PX,
    });
    expect(h.cursor?.()).toMatchObject({ glyph: 'brush' });
  });

  it('hovers with a ring as wide as the brush it would start', () => {
    expect(actionCursor(simplifyBrushAction)).toEqual(brushRingCursor(SIMPLIFY_BRUSH_RADIUS_PX));
    const tuned = tuneAction(simplifyBrushAction, [{ params: () => ({ radiusPx: 30 }) }]);
    expect(actionCursor(tuned)).toEqual(brushRingCursor(30));
    expect(brushRingCursor(30)).not.toEqual(brushRingCursor(SIMPLIFY_BRUSH_RADIUS_PX));
  });

  it('clears the anchor selection it renumbered', () => {
    const { dep, at } = setup();
    dep.setSelectedAnchors([3]);
    brushAlong(start(at(100, 0), { radiusPx: 60 }), at, 100, 300);
    expect(dep.selectedAnchors.size).toBe(0);
  });

  it('owns a plain drag only while its path-edit tool is on', () => {
    expect(simplifyBrushAction.defaultBinding).toEqual([{ spec: { kind: 'drag' }, opts: { id: 'simplifyBrush.drag', yields: true } }]);
    const off = setup(wave(), null);
    expect(start(off.at(100, 0))).toEqual({});
    expect(simplifyBrushAction.enabled?.(off.at(0, 0).deps)).not.toBe(true);
    const on = setup();
    expect(simplifyBrushAction.enabled?.(on.at(0, 0).deps)).toBe(true);
  });
});
