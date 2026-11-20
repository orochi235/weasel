import { afterEach, describe, expect, it, vi } from 'vitest';
import { type SurfaceFrame, TiledSurface } from './tiledSurface';

function stubBox(el: HTMLElement, left: number, top: number, width: number, height: number): void {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect);
}

function div(): HTMLElement {
  const el = document.createElement('div');
  document.body.append(el);
  return el;
}

/** A surface over an 800 × 600 container holding tiles `a` and `b`, stepped until it settles. */
function settled(): { surface: TiledSurface; container: HTMLElement; frames: SurfaceFrame[] } {
  const surface = new TiledSurface();
  const container = div();
  stubBox(container, 0, 0, 800, 600);
  const a = div();
  const b = div();
  stubBox(a, 0, 0, 400, 600);
  stubBox(b, 400, 0, 400, 600);
  surface.setContainer(container);
  surface.placeTile('a', a);
  surface.placeTile('b', b);
  const frames: SurfaceFrame[] = [];
  const onFrame = (f: SurfaceFrame) => frames.push(f);
  while (surface.step(onFrame));
  surface.step(onFrame);
  return { surface, container, frames };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('TiledSurface', () => {
  it('retiles when the scope narrows to an element holding no tile', () => {
    const { surface, frames } = settled();
    frames.length = 0;
    const clear = vi.fn();
    surface.holdClear('c', clear);
    surface.setScope(div());
    surface.step((f) => frames.push(f));
    expect(frames).toHaveLength(1);
    expect(frames[0]?.retiled).toBe(true);
    expect(frames[0]?.rects.size).toBe(0);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('retiles and repaints every tile when the container is swapped for one at the same place', () => {
    const { surface, frames } = settled();
    frames.length = 0;
    const next = div();
    stubBox(next, 0, 0, 800, 600);
    surface.setContainer(next);
    surface.step((f) => frames.push(f));
    expect(frames).toHaveLength(1);
    expect(frames[0]?.retiled).toBe(true);
    expect([...(frames[0]?.dirty ?? [])].sort()).toEqual(['a', 'b']);
  });

  it('tells scope listeners when a tile is placed or dropped under a scope', () => {
    const surface = new TiledSurface();
    const scope = div();
    surface.setScope(scope);
    const heard = vi.fn();
    surface.subscribeScope(heard);
    const tile = document.createElement('div');
    scope.append(tile);
    expect(surface.inScope('t')).toBe(false);
    surface.placeTile('t', tile);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(surface.inScope('t')).toBe(true);
    surface.placeTile('t', null);
    expect(heard).toHaveBeenCalledTimes(2);
  });
});
