import { describe, it, expect, vi } from 'vitest';
import { createParallaxLayer } from './createParallaxLayer';
import type { RenderLayer } from '../../core/layers/render';
import type { View } from '../../core/viewport/view';

const outer: View = { x: 100, y: 50, scale: { x: 2, y: 2 } };
const dims = { width: 400, height: 300 };

function makeSpyLayer(): { layer: RenderLayer<unknown>; draw: ReturnType<typeof vi.fn> } {
  const draw = vi.fn(() => []);
  return {
    draw,
    layer: { id: 'src', label: 'src', space: 'world', draw },
  };
}

describe('createParallaxLayer', () => {
  it('declares space: screen', () => {
    const l = createParallaxLayer({
      id: 'p', label: 'P', source: [], pan: 0.5,
    });
    expect(l.space).toBe('screen');
  });

  it('returns [] when source is empty', () => {
    const l = createParallaxLayer({
      id: 'p', label: 'P', source: [], pan: 0.5,
    });
    expect(l.draw(undefined, outer, dims)).toEqual([]);
  });

  it('passes the derived view to source layers', () => {
    const { layer, draw } = makeSpyLayer();
    const l = createParallaxLayer({
      id: 'p', label: 'P', source: [layer], pan: 0.5,
    });
    l.draw(undefined, outer, dims);
    expect(draw).toHaveBeenCalledOnce();
    const passedView = draw.mock.calls[0]![1] as View;
    expect(passedView.x).toBe(50);
    expect(passedView.y).toBe(25);
    expect(passedView.scale).toEqual({ x: 2, y: 2 });
  });

  it('identity wrapper passes outer view through unchanged', () => {
    const { layer, draw } = makeSpyLayer();
    const l = createParallaxLayer({
      id: 'p', label: 'P', source: [layer], pan: 1, zoom: 1,
    });
    l.draw(undefined, outer, dims);
    const passedView = draw.mock.calls[0]![1] as View;
    expect(passedView).toEqual(outer);
  });

  it('concatenates draw commands from multiple source layers in order', () => {
    const a: RenderLayer<unknown> = {
      id: 'a', label: 'a', space: 'world',
      draw: () => [{ kind: 'path', path: { kind: 'rect', x: 1, y: 1, width: 1, height: 1 } }],
    };
    const b: RenderLayer<unknown> = {
      id: 'b', label: 'b', space: 'world',
      draw: () => [{ kind: 'path', path: { kind: 'rect', x: 2, y: 2, width: 2, height: 2 } }],
    };
    const l = createParallaxLayer({ id: 'p', label: 'P', source: [a, b], pan: 1 });
    const out = l.draw(undefined, outer, dims);
    expect(out).toHaveLength(2);
    expect((out[0]! as { path: { x: number } }).path.x).toBe(1);
    expect((out[1]! as { path: { x: number } }).path.x).toBe(2);
  });

  it('forwards dims to source layers', () => {
    const { layer, draw } = makeSpyLayer();
    const l = createParallaxLayer({
      id: 'p', label: 'P', source: [layer], pan: 0.5,
    });
    l.draw(undefined, outer, dims);
    expect(draw.mock.calls[0]![2]).toEqual(dims);
  });
});
