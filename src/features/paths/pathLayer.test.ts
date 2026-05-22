import { describe, expect, it, vi } from 'vitest';
import type { GroupDrawCommand } from '../../renderer';
import { createPathLayer } from './pathLayer';
import { polygonFromPoints, rectPath } from './builder';
import type { Path } from './types';
import type { FillStyle, Stroke } from 'core/paint-types';
import { ColorOverrideRegistry } from '../../animation/colorRegistry';

describe('createPathLayer', () => {
  it('emits one path command per visible node, wrapped in a world-transform group', () => {
    const path: Path = rectPath(0, 0, 10, 10);
    const fill: FillStyle = { fill: 'solid', color: '#fff' };
    const layer = createPathLayer({
      getNodes: () => [{ id: 'a' }, { id: 'b' }],
      getPath: () => path,
      getFill: () => fill,
    });
    const tree = layer.draw(null, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 100, height: 100 });
    expect(tree).toHaveLength(1);
    expect(tree[0].kind).toBe('group');
    const group = tree[0] as GroupDrawCommand;
    expect(group.children).toHaveLength(2);
    expect(group.children[0]).toMatchObject({ kind: 'path', path, fill });
    expect(group.children[1]).toMatchObject({ kind: 'path', path, fill });
  });

  it('skips hidden nodes', () => {
    const path: Path = rectPath(0, 0, 10, 10);
    const layer = createPathLayer({
      getNodes: () => [{ id: 'a' }, { id: 'b' }],
      getPath: () => path,
      getFill: () => ({ fill: 'solid', color: '#f00' }),
      isHidden: (n) => n.id === 'b',
    });
    const tree = layer.draw(null, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 100, height: 100 });
    const group = tree[0] as GroupDrawCommand;
    expect(group.children).toHaveLength(1);
  });

  it('skips nodes with no fill and no stroke', () => {
    const path: Path = rectPath(0, 0, 10, 10);
    const layer = createPathLayer({
      getNodes: () => [{ id: 'a' }],
      getPath: () => path,
      // no getFill or getStroke
    });
    const tree = layer.draw(null, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 100, height: 100 });
    const group = tree[0] as GroupDrawCommand;
    expect(group.children).toHaveLength(0);
  });

  it('passes stroke through when getStroke returns a stroke', () => {
    const path: Path = rectPath(0, 0, 10, 10);
    const stroke: Stroke = { paint: { fill: 'solid', color: '#000' }, width: 2 };
    const layer = createPathLayer({
      getNodes: () => [{ id: 'a' }],
      getPath: () => path,
      getStroke: () => stroke,
    });
    const tree = layer.draw(null, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 100, height: 100 });
    const group = tree[0] as GroupDrawCommand;
    expect(group.children[0]).toMatchObject({ kind: 'path', path, stroke });
  });

  it('group transform reflects the view (scale=2 → mat3 scale=2)', () => {
    const path: Path = rectPath(0, 0, 10, 10);
    const layer = createPathLayer({
      getNodes: () => [{ id: 'a' }],
      getPath: () => path,
      getFill: () => ({ fill: 'solid', color: '#fff' }),
    });
    const tree = layer.draw(null, { x: 5, y: 7, scale: { x: 2, y: 2 } }, { width: 100, height: 100 });
    const group = tree[0] as GroupDrawCommand;
    expect(group.transform).toBeDefined();
    expect(Array.from(group.transform!)).toEqual([2, 0, 0, 0, 2, 0, -10, -14, 1]);
  });
});

describe('createPathLayer — getVertexColors', () => {
  it('threads per-anchor colors through to the emitted PathDrawCommand', () => {
    const path = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    const colors = [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1];
    const layer = createPathLayer({
      getNodes: () => [{ id: 'a' }],
      getPath: () => path,
      getVertexColors: () => colors,
    });
    const out = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } } as any, { width: 100, height: 100 });
    const group = out[0] as any;
    const cmd = group.children[0];
    expect(cmd.vertexColors).toEqual(colors);
    // Placeholder fill is synthesized so the renderer's gate passes.
    expect(cmd.fill).toEqual({ color: '#ffffff' });
  });

  it('explicit fill from getFill wins over the synthesized placeholder', () => {
    const path = rectPath(0, 0, 10, 10);
    const layer = createPathLayer({
      getNodes: () => [{ id: 'a' }],
      getPath: () => path,
      getFill: () => ({ color: '#abcdef', opacity: 0.5 }),
      getVertexColors: () => [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 1, 1, 1],
    });
    const out = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } } as any, { width: 100, height: 100 });
    const cmd = (out[0] as any).children[0];
    expect(cmd.fill).toEqual({ color: '#abcdef', opacity: 0.5 });
  });

  it('warns and drops colors when the array length does not match 4 × anchor count (dev mode)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const path = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    // 3 anchors → expects 12 floats; supply 8.
    // Mismatched colors drop both the array and the placeholder, skipping the node entirely.
    const layer = createPathLayer({
      getNodes: () => [{ id: 'wrong' }],
      getPath: () => path,
      getVertexColors: () => [1, 0, 0, 1, 0, 1, 0, 1],
    });
    const out = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } } as any, { width: 100, height: 100 });
    const group = out[0] as any;
    expect(group.children).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('warns once per (layer-id, node-id) pair across multiple draw calls', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const path = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    const layer = createPathLayer({
      id: 'L1',
      getNodes: () => [{ id: 'wrong' }],
      getPath: () => path,
      getFill: () => ({ color: '#f00' }), // Explicit fill so node is rendered despite bad colors
      getVertexColors: () => [1, 0, 0, 1],
    });
    layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } } as any, { width: 100, height: 100 });
    layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } } as any, { width: 100, height: 100 });
    layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } } as any, { width: 100, height: 100 });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('createPathLayer — getStrokeVertexColors', () => {
  it('threads stroke vertex colors onto Stroke.vertexColors with placeholder stroke', () => {
    const path = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    const colors = [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1];
    const layer = createPathLayer({
      getNodes: () => [{ id: 'a' }],
      getPath: () => path,
      getStrokeVertexColors: () => colors,
    });
    const out = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } } as any, { width: 100, height: 100 });
    const cmd = (out[0] as any).children[0];
    expect(cmd.stroke.vertexColors).toEqual(colors);
    expect(cmd.stroke.paint).toEqual({ color: '#ffffff' });
    expect(cmd.stroke.width).toBe(1);
  });

  it('threads stroke vertex colors onto an existing Stroke (overriding any pre-set vertexColors)', () => {
    const path = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    const colors = [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1];
    const layer = createPathLayer({
      getNodes: () => [{ id: 'a' }],
      getPath: () => path,
      getStroke: () => ({ paint: { color: '#000' }, width: 3 }),
      getStrokeVertexColors: () => colors,
    });
    const out = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } } as any, { width: 100, height: 100 });
    const cmd = (out[0] as any).children[0];
    expect(cmd.stroke.vertexColors).toEqual(colors);
    expect(cmd.stroke.paint).toEqual({ color: '#000' });
    expect(cmd.stroke.width).toBe(3);
  });
});

describe('createPathLayer color overrides', () => {
  const triangle = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }]);
  const baseFillColors = [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255];
  const view = { x: 0, y: 0, scale: { x: 1, y: 1 } } as any;
  const size = { width: 100, height: 100 };

  it('falls back to the consumer accessor when no override is registered', () => {
    const layer = createPathLayer({
      getNodes: () => [{ id: 'tri' }],
      getPath: () => triangle,
      getVertexColors: () => baseFillColors,
    });
    const out = layer.draw(undefined, view, size);
    const cmd = (out[0] as any).children[0];
    expect(cmd.vertexColors).toEqual(baseFillColors);
  });

  it('uses an array override when registered for fill', () => {
    const overrideColors = [128, 128, 128, 255, 128, 128, 128, 255, 128, 128, 128, 255];
    const registry = new ColorOverrideRegistry();
    registry.set('tri', 'fill', overrideColors);
    const layer = createPathLayer({
      getNodes: () => [{ id: 'tri' }],
      getPath: () => triangle,
      getVertexColors: () => baseFillColors,
      colorOverrides: registry,
    });
    const out = layer.draw(undefined, view, size);
    const cmd = (out[0] as any).children[0];
    expect(cmd.vertexColors).toEqual(overrideColors);
  });

  it('calls a function override with base colors and tMs', () => {
    const registry = new ColorOverrideRegistry();
    let received: { base?: readonly number[]; tMs?: number } = {};
    registry.set('tri', 'fill', (base, tMs) => {
      received = { base, tMs };
      return base.map((v) => 255 - v);
    });
    const layer = createPathLayer({
      getNodes: () => [{ id: 'tri' }],
      getPath: () => triangle,
      getVertexColors: () => baseFillColors,
      colorOverrides: registry,
      now: () => 1234,
    });
    const out = layer.draw(undefined, view, size);
    const cmd = (out[0] as any).children[0];
    expect(received.base).toEqual(baseFillColors);
    expect(received.tMs).toBe(1234);
    expect(cmd.vertexColors[0]).toBe(0);
  });

  it('falls back to base colors if function override returns wrong length (dev guard)', () => {
    const registry = new ColorOverrideRegistry();
    registry.set('tri', 'fill', () => [1, 2, 3, 4]);
    const layer = createPathLayer({
      getNodes: () => [{ id: 'tri' }],
      getPath: () => triangle,
      getVertexColors: () => baseFillColors,
      colorOverrides: registry,
    });
    const out = layer.draw(undefined, view, size);
    const cmd = (out[0] as any).children[0];
    expect(cmd.vertexColors).toEqual(baseFillColors);
  });
});
