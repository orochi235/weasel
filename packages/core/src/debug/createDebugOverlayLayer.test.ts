import { describe, it, expect } from 'vitest';
import type { PathDrawCommand } from '../renderer';
import { createDebugOverlayLayer } from './createDebugOverlayLayer';
import { createDebugSink } from './createDebugSink';

const DIMS = { width: 800, height: 600 };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

describe('createDebugOverlayLayer', () => {
  it('is registered as a screen-space layer', () => {
    const sink = createDebugSink({ bounds: true });
    const layer = createDebugOverlayLayer({ sink, config: { bounds: true } });
    expect(layer.space).toBe('screen');
    expect(layer.id).toBe('debug-overlay');
  });

  it('emits one rect path per hitbox when hitboxes flag is on', () => {
    const sink = createDebugSink({ hitboxes: true });
    sink.recordHitbox('a', 'body', { kind: 'rect', x: 0, y: 0, width: 10, height: 10 });
    const layer = createDebugOverlayLayer({ sink, config: { hitboxes: true } });
    const tree = layer.draw(null, VIEW, DIMS);
    expect(tree.filter((c) => c.kind === 'path')).toHaveLength(1);
    const cmd = tree[0] as PathDrawCommand;
    expect(cmd.stroke?.dash).toEqual([2, 2]);
  });

  it('anchors layer panel to canvas right edge using dims.width', () => {
    const sink = createDebugSink({ layers: true });
    sink.recordLayer('grid', 'Grid', 'world', 0);
    const layer = createDebugOverlayLayer({ sink, config: { layers: true } });
    const tree = layer.draw(null, VIEW, { width: 1000, height: 600 });
    // Expect the bg rect to be near the right edge of the 1000px canvas.
    const bg = tree.find((c) => c.kind === 'path') as PathDrawCommand;
    expect(bg).toBeDefined();
    const r = bg.path as { x: number; width: number };
    expect(r.x + r.width).toBeLessThan(1000);
    expect(r.x).toBeGreaterThan(800);
  });

  it('applies per-feature stroke overrides, defaulting the rest', () => {
    const sink = createDebugSink({ hitboxes: true, bounds: true });
    sink.recordHitbox('a', 'body', { kind: 'rect', x: 0, y: 0, width: 10, height: 10 });
    sink.recordBounds('a', { x: 0, y: 0, width: 10, height: 10 });
    const layer = createDebugOverlayLayer({
      sink,
      config: { hitboxes: true, bounds: true, strokes: { hitbox: { width: 3 } } },
    });
    const [hitbox, bounds] = layer.draw(null, VIEW, DIMS) as PathDrawCommand[];
    expect(hitbox.stroke?.width).toBe(3);
    // An override with no `dash` is a solid line, not the default's dash.
    expect(hitbox.stroke?.dash).toBeUndefined();
    expect(bounds.stroke?.width).toBe(1);
  });

  it('skips a feature when its config flag is off', () => {
    const sink = createDebugSink({ bounds: true, origins: true });
    sink.recordBounds('a', { x: 0, y: 0, width: 10, height: 10 });
    sink.recordOrigin('a', { x: 0, y: 0 });
    const layer = createDebugOverlayLayer({ sink, config: { bounds: true } });
    const tree = layer.draw(null, VIEW, { width: 200, height: 100 });
    // bounds: 1 path. origins: 0.
    expect(tree.filter((c) => c.kind === 'path')).toHaveLength(1);
  });
});
