import { describe, expect, it, vi } from 'vitest';
import { type LayerCommandCache, type RenderLayer, drawLayers, drawOneLayer } from './render';
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

  it('keeps a hidden layer entry in cache and reuses it once shown again', () => {
    const calls = { n: 0 };
    const layers = [countingLayer('a', calls)];
    const cache: LayerCommandCache = new Map();
    drawLayers(layers, { v: 1 }, { a: true }, undefined, undefined, DIMS, cache);
    expect(calls.n).toBe(1);
    drawLayers(layers, { v: 1 }, { a: false }, undefined, undefined, DIMS, cache);
    expect(calls.n).toBe(1);
    expect(cache.has('a')).toBe(true);
    drawLayers(layers, { v: 1 }, { a: true }, undefined, undefined, DIMS, cache);
    expect(calls.n).toBe(1);
  });
});

describe('a layer that throws', () => {
  const PATH_CMD: DrawCommand = {
    kind: 'path',
    path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 },
    fill: { fill: 'solid', color: '#fff' },
  };
  const boom = (): DrawCommand[] => {
    throw new Error('layer is broken');
  };

  it('drops its own commands and lets the rest of the frame paint', () => {
    const bad: RenderLayer<unknown> = { id: 'bad', label: 'Bad', space: 'screen', draw: boom };
    const good: RenderLayer<unknown> = {
      id: 'good', label: 'Good', space: 'screen', draw: () => [PATH_CMD],
    };
    const onLayerError = vi.fn();
    const out = drawLayers(
      [bad, good], null, {}, undefined, undefined, { width: 10, height: 10 },
      undefined, onLayerError,
    );
    expect(out).toEqual([PATH_CMD]);
    expect(onLayerError).toHaveBeenCalledTimes(1);
    expect(onLayerError.mock.calls[0][0].layerId).toBe('bad');
    expect((onLayerError.mock.calls[0][0].error as Error).message).toBe('layer is broken');
  });

  // Otherwise the last good tree is served back under deps that have since
  // moved on, which is a stale layer wearing a working one's face.
  it('drops its cache entry, so the next frame is a real re-attempt', () => {
    let broken = true;
    const layer: RenderLayer<{ v: number }> = {
      id: 'a',
      label: 'A',
      space: 'screen',
      deps: (d) => [d.v],
      draw: () => {
        if (broken) throw new Error('layer is broken');
        return [PATH_CMD];
      },
    };
    const cache: LayerCommandCache = new Map();
    const onLayerError = vi.fn();
    const dims = { width: 10, height: 10 };

    drawLayers([layer], { v: 1 }, {}, undefined, undefined, dims, cache, onLayerError);
    expect(cache.has('a')).toBe(false);

    broken = false;
    const out = drawLayers([layer], { v: 1 }, {}, undefined, undefined, dims, cache, onLayerError);
    expect(out).toEqual([PATH_CMD]);
    expect(onLayerError).toHaveBeenCalledTimes(1);
  });
});

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

describe('RenderLayer.effects', () => {
  const cmds: DrawCommand[] = [
    { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, fill: { color: '#f00' } },
  ];
  const fx = [{ program: { id: 'test:fx' } }];

  it('rides on the group a world-space layer is already wrapped in', () => {
    const layer: RenderLayer<undefined> = {
      id: 'w', label: 'w', draw: () => cmds, effects: fx,
    };
    const out = drawOneLayer(layer, undefined, VIEW, DIMS);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'group', effects: fx });
  });

  it('wraps a screen-space layer that would otherwise pass straight through', () => {
    const layer: RenderLayer<undefined> = {
      id: 's', label: 's', space: 'screen', draw: () => cmds, effects: fx,
    };
    const out = drawOneLayer(layer, undefined, VIEW, DIMS);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'group', effects: fx });
    // No view transform: a screen-space layer's commands are already placed.
    expect((out[0] as { transform?: unknown }).transform).toBeUndefined();
  });

  it('leaves a screen-space layer unwrapped when the list is empty', () => {
    const layer: RenderLayer<undefined> = {
      id: 's', label: 's', space: 'screen', draw: () => cmds, effects: [],
    };
    expect(drawOneLayer(layer, undefined, VIEW, DIMS)).toEqual(cmds);
  });

  it('sets no `effects` key at all on a world layer that declares none', () => {
    const layer: RenderLayer<undefined> = { id: 'w', label: 'w', draw: () => cmds };
    const out = drawOneLayer(layer, undefined, VIEW, DIMS)[0] as unknown as Record<string, unknown>;
    expect('effects' in out).toBe(false);
  });
});
