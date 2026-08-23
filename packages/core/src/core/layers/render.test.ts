import { describe, expect, it, vi } from 'vitest';
import { type LayerCommandCache, type RenderLayer, drawLayers } from './render';
import type { DrawCommand } from '../../renderer';

describe('drawLayers', () => {
  it('returns concatenated DrawCommands from each visible layer in order', () => {
    // Use screen-space layers so commands pass through unwrapped — this
    // test exercises iteration order, not the world-space auto-wrap.
    const aCmd: DrawCommand = { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, fill: { fill: 'solid', color: '#fff' } };
    const bCmd: DrawCommand = { kind: 'path', path: { kind: 'rect', x: 1, y: 1, width: 1, height: 1 }, fill: { fill: 'solid', color: '#000' } };
    const a: RenderLayer<unknown> = { id: 'a', label: 'A', space: 'screen', draw: () => [aCmd] };
    const b: RenderLayer<unknown> = { id: 'b', label: 'B', space: 'screen', draw: () => [bCmd] };
    const out = drawLayers([a, b], null, {}, undefined, undefined, { width: 10, height: 10 });
    expect(out).toEqual([aCmd, bCmd]);
  });

  it('honors the order array', () => {
    const a: RenderLayer<unknown> = { id: 'a', label: 'A', space: 'screen', draw: () => [{ kind: 'group', children: [] }] };
    const b: RenderLayer<unknown> = { id: 'b', label: 'B', space: 'screen', draw: () => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, fill: { fill: 'solid', color: '#fff' } }] };
    const out = drawLayers([a, b], null, {}, ['b', 'a'], undefined, { width: 10, height: 10 });
    expect(out[0].kind).toBe('path');
    expect(out[1].kind).toBe('group');
  });

  it('skips layers whose visibility is false', () => {
    const draw = vi.fn(() => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, fill: { fill: 'solid', color: '#fff' } }] as DrawCommand[]);
    const a: RenderLayer<unknown> = { id: 'a', label: 'A', draw };
    const out = drawLayers([a], null, { a: false }, undefined, undefined, { width: 10, height: 10 });
    expect(out).toEqual([]);
    expect(draw).not.toHaveBeenCalled();
  });

  it('respects defaultVisible: false', () => {
    const draw = vi.fn(() => [] as DrawCommand[]);
    const a: RenderLayer<unknown> = { id: 'a', label: 'A', draw, defaultVisible: false };
    drawLayers([a], null, {}, undefined, undefined, { width: 10, height: 10 });
    expect(draw).not.toHaveBeenCalled();
  });

  it('explicit visibility overrides defaultVisible', () => {
    const hiddenDraw = vi.fn(() => [] as DrawCommand[]);
    const shownDraw = vi.fn(() => [] as DrawCommand[]);
    const hidden: RenderLayer<unknown> = { id: 'hidden', label: 'H', draw: hiddenDraw, defaultVisible: true };
    const shown: RenderLayer<unknown> = { id: 'shown', label: 'S', draw: shownDraw, defaultVisible: false };
    drawLayers([hidden, shown], null, { hidden: false, shown: true }, undefined, undefined, { width: 10, height: 10 });
    expect(hiddenDraw).not.toHaveBeenCalled();
    expect(shownDraw).toHaveBeenCalled();
  });

  it('always draws alwaysOn layers regardless of visibility map', () => {
    const cmd: DrawCommand = { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, fill: { fill: 'solid', color: '#fff' } };
    const a: RenderLayer<unknown> = { id: 'a', label: 'A', space: 'screen', alwaysOn: true, draw: () => [cmd] };
    const out = drawLayers([a], null, { a: false }, undefined, undefined, { width: 10, height: 10 });
    expect(out).toEqual([cmd]);
  });

  it('wraps world-space layer output in a group with viewToMat3 transform', () => {
    const cmd: DrawCommand = { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, fill: { fill: 'solid', color: '#fff' } };
    const a: RenderLayer<unknown> = { id: 'a', label: 'A', draw: () => [cmd] };
    const out = drawLayers([a], null, {}, undefined, { x: 5, y: 7, scale: { x: 2, y: 2 } }, { width: 10, height: 10 });
    expect(out.length).toBe(1);
    expect(out[0].kind).toBe('group');
    const group = out[0] as { kind: 'group'; transform?: number[]; children: DrawCommand[] };
    // viewToMat3 for { x: 5, y: 7, scale: { x: 2, y: 2 } } produces a non-identity affine.
    expect(group.transform).toBeDefined();
    expect(group.children).toEqual([cmd]);
  });

  it('treats unset space as world (auto-wraps)', () => {
    const cmd: DrawCommand = { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, fill: { fill: 'solid', color: '#fff' } };
    const a: RenderLayer<unknown> = { id: 'a', label: 'A', draw: () => [cmd] }; // no `space`
    const out = drawLayers([a], null, {}, undefined, undefined, { width: 10, height: 10 });
    expect(out[0].kind).toBe('group');
  });

  it('passes screen-space layer output through unchanged', () => {
    const cmd: DrawCommand = { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, fill: { fill: 'solid', color: '#fff' } };
    const a: RenderLayer<unknown> = { id: 'a', label: 'A', space: 'screen', draw: () => [cmd] };
    const out = drawLayers([a], null, {}, undefined, undefined, { width: 10, height: 10 });
    expect(out).toEqual([cmd]);
  });

  it('does not emit an empty group when a world-space layer returns no commands', () => {
    const a: RenderLayer<unknown> = { id: 'a', label: 'A', draw: () => [] };
    const out = drawLayers([a], null, {}, undefined, undefined, { width: 10, height: 10 });
    expect(out).toEqual([]);
  });

  it('layers absent from order array are skipped', () => {
    const aDraw = vi.fn(() => [] as DrawCommand[]);
    const bDraw = vi.fn(() => [] as DrawCommand[]);
    const a: RenderLayer<unknown> = { id: 'a', label: 'A', draw: aDraw };
    const b: RenderLayer<unknown> = { id: 'b', label: 'B', draw: bDraw };
    drawLayers([a, b], null, {}, ['a'], undefined, { width: 10, height: 10 });
    expect(aDraw).toHaveBeenCalled();
    expect(bDraw).not.toHaveBeenCalled();
  });

  it('unknown ids in order are silently dropped', () => {
    const draw = vi.fn(() => [] as DrawCommand[]);
    const a: RenderLayer<unknown> = { id: 'a', label: 'A', draw };
    drawLayers([a], null, {}, ['ghost', 'a'], undefined, { width: 10, height: 10 });
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('passes view and dims through to draw', () => {
    const draw = vi.fn(() => [] as DrawCommand[]);
    const a: RenderLayer<unknown> = { id: 'a', label: 'A', draw };
    drawLayers([a], 'data', {}, undefined, { x: 5, y: 7, scale: { x: 2, y: 2 } }, { width: 320, height: 240 });
    expect(draw).toHaveBeenCalledWith('data', { x: 5, y: 7, scale: { x: 2, y: 2 } }, { width: 320, height: 240 });
  });

  it('uses identity view when view is undefined', () => {
    const draw = vi.fn(() => [] as DrawCommand[]);
    const a: RenderLayer<unknown> = { id: 'a', label: 'A', draw };
    drawLayers([a], null, {}, undefined, undefined, { width: 1, height: 1 });
    expect(draw).toHaveBeenCalledWith(null, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 1, height: 1 });
  });
});

function countingLayer(id: string, calls: { n: number }): RenderLayer<{ v: number }> {
  return {
    id,
    label: id,
    deps: (data) => [data.v],
    draw: (data) => {
      calls.n += 1;
      return [
        {
          kind: 'path',
          path: { kind: 'rect', x: data.v, y: 0, width: 1, height: 1 },
          fill: { fill: 'solid', color: '#fff' },
        },
      ];
    },
  };
}

const DIMS = { width: 100, height: 100 };

describe('drawLayers command caching', () => {
  it('reuses the tree when deps are unchanged', () => {
    const calls = { n: 0 };
    const layers = [countingLayer('a', calls)];
    const cache: LayerCommandCache = new Map();
    drawLayers(layers, { v: 1 }, {}, undefined, undefined, DIMS, cache);
    drawLayers(layers, { v: 1 }, {}, undefined, undefined, DIMS, cache);
    expect(calls.n).toBe(1);
  });

  it('rebuilds when deps change', () => {
    const calls = { n: 0 };
    const layers = [countingLayer('a', calls)];
    const cache: LayerCommandCache = new Map();
    drawLayers(layers, { v: 1 }, {}, undefined, undefined, DIMS, cache);
    drawLayers(layers, { v: 2 }, {}, undefined, undefined, DIMS, cache);
    expect(calls.n).toBe(2);
  });

  it('rebuilds every call for a layer with no deps', () => {
    const calls = { n: 0 };
    const layer = { ...countingLayer('a', calls) };
    delete (layer as { deps?: unknown }).deps;
    const cache: LayerCommandCache = new Map();
    drawLayers([layer], { v: 1 }, {}, undefined, undefined, DIMS, cache);
    drawLayers([layer], { v: 1 }, {}, undefined, undefined, DIMS, cache);
    expect(calls.n).toBe(2);
  });

  it('rebuilds every call when no cache is supplied', () => {
    const calls = { n: 0 };
    const layers = [countingLayer('a', calls)];
    drawLayers(layers, { v: 1 }, {}, undefined, undefined, DIMS);
    drawLayers(layers, { v: 1 }, {}, undefined, undefined, DIMS);
    expect(calls.n).toBe(2);
  });

  it('returns the same array identity on a cache hit', () => {
    const calls = { n: 0 };
    const layers = [countingLayer('a', calls)];
    const cache: LayerCommandCache = new Map();
    const first = drawLayers(layers, { v: 1 }, {}, undefined, undefined, DIMS, cache);
    const second = drawLayers(layers, { v: 1 }, {}, undefined, undefined, DIMS, cache);
    const firstChildren = (first[0] as { children: unknown[] }).children;
    const secondChildren = (second[0] as { children: unknown[] }).children;
    expect(secondChildren).toBe(firstChildren);
  });

  it('drops entries for layers that are no longer present', () => {
    const calls = { n: 0 };
    const cache: LayerCommandCache = new Map();
    drawLayers([countingLayer('a', calls)], { v: 1 }, {}, undefined, undefined, DIMS, cache);
    expect(cache.has('a')).toBe(true);
    drawLayers([countingLayer('b', calls)], { v: 1 }, {}, undefined, undefined, DIMS, cache);
    expect(cache.has('a')).toBe(false);
  });

  it('does not serve a hidden layer from cache to a visible one', () => {
    const calls = { n: 0 };
    const layers = [countingLayer('a', calls)];
    const cache: LayerCommandCache = new Map();
    drawLayers(layers, { v: 1 }, { a: false }, undefined, undefined, DIMS, cache);
    expect(calls.n).toBe(0);
    drawLayers(layers, { v: 1 }, { a: true }, undefined, undefined, DIMS, cache);
    expect(calls.n).toBe(1);
  });
});
