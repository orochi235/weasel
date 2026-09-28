import { describe, it, expect } from 'vitest';
import type { DrawCommand, PathDrawCommand, TextDrawCommand } from '../renderer';
import { buildDebugOverlayCommands, createDebugOverlayLayer } from './createDebugOverlayLayer';
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

  it('outlines the previous viewport and trails a pan\'s grab point to where it is now', () => {
    const sink = createDebugSink({ viewport: true });
    const from = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const to = { x: -100, y: -40, scale: { x: 1, y: 1 } };
    sink.recordViewport('pan', from, to, { x: 50, y: 50 });
    const tree = createDebugOverlayLayer({ sink, config: { viewport: true } }).draw(null, to, DIMS);
    const outline = tree[0] as PathDrawCommand;
    // The old viewport's top-left, seen through the panned camera.
    expect(outline.path).toMatchObject({ kind: 'rect', x: 100, y: 40, width: 800, height: 600 });
    const trail = tree.find((c) => c.kind === 'path' && c.path.kind === 'polygon'
      && (c.path as { commands: Uint8Array }).commands.length === 2) as PathDrawCommand;
    const coords = Array.from((trail.path as { coords: Float32Array }).coords);
    expect(coords).toEqual([50, 50, 150, 90]);
    expect(texts(tree).some((t) => t.includes('+100.0') && t.includes('+40.0'))).toBe(true);
  });

  it('reads a zoom as a factor and the scale it moved between', () => {
    const sink = createDebugSink({ viewport: true });
    const from = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const to = { x: 25, y: 25, scale: { x: 2, y: 2 } };
    sink.recordViewport('zoom', from, to, { x: 50, y: 50 });
    const tree = createDebugOverlayLayer({ sink, config: { viewport: true } }).draw(null, to, DIMS);
    const outline = tree[0] as PathDrawCommand;
    expect(outline.path).toMatchObject({ x: -50, y: -50, width: 1600, height: 1200 });
    expect(texts(tree).some((t) => t.includes('×2.000') && t.includes('1.000 → 2.000'))).toBe(true);
  });

  it('prints frame stats with every number in a fixed-width, decimal-aligned column', () => {
    const debug = {
      ...createDebugSink({ fps: true }).snapshot(),
      frame: {
        paintMs: 12.25,
        drawCalls: 117,
        layers: [
          { id: 'scene', drawCalls: 110, ms: 11.5 },
          { id: 'selection-overlay', drawCalls: 7, ms: 0.75 },
        ],
      },
    };
    const lines = texts(buildDebugOverlayCommands(debug, { fps: true }, VIEW, DIMS, [0, 16, 32, 48]));
    expect(lines[0]).toMatch(/^fps +62\.50 +$/);
    const msLines = lines.filter((l) => l.endsWith(' ms'));
    // frame, paint, and one per layer.
    expect(msLines).toHaveLength(4);
    const dotColumns = new Set(msLines.map((l) => l.lastIndexOf('.')));
    expect(dotColumns.size).toBe(1);
    expect(new Set(lines.map((l) => l.length)).size).toBe(1);
    expect(lines.find((l) => l.startsWith('scene'))).toMatch(/ 110 +11\.50 ms$/);
  });
});

function texts(tree: readonly DrawCommand[]): string[] {
  return tree
    .filter((c): c is TextDrawCommand => c.kind === 'text')
    .map((c) => c.runs.map((r) => r.text).join(''));
}
