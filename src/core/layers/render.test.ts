import { describe, expect, it, vi } from 'vitest';
import { type RenderLayer, drawLayers } from './render';
import type { DrawCommand } from '../../renderer';

describe('drawLayers', () => {
  it('returns concatenated DrawCommands from each visible layer in order', () => {
    const aCmd: DrawCommand = { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, fill: { fill: 'solid', color: '#fff' } };
    const bCmd: DrawCommand = { kind: 'path', path: { kind: 'rect', x: 1, y: 1, width: 1, height: 1 }, fill: { fill: 'solid', color: '#000' } };
    const a: RenderLayer<unknown> = {
      id: 'a', label: 'A',
      draw: () => [aCmd],
    };
    const b: RenderLayer<unknown> = {
      id: 'b', label: 'B',
      draw: () => [bCmd],
    };
    const out = drawLayers([a, b], null, {}, undefined, undefined, { width: 10, height: 10 });
    expect(out).toEqual([aCmd, bCmd]);
  });

  it('honors the order array', () => {
    const a: RenderLayer<unknown> = { id: 'a', label: 'A', draw: () => [{ kind: 'group', children: [] }] };
    const b: RenderLayer<unknown> = { id: 'b', label: 'B', draw: () => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, fill: { fill: 'solid', color: '#fff' } }] };
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
    const a: RenderLayer<unknown> = { id: 'a', label: 'A', alwaysOn: true, draw: () => [cmd] };
    const out = drawLayers([a], null, { a: false }, undefined, undefined, { width: 10, height: 10 });
    expect(out).toEqual([cmd]);
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
