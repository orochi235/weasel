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
});
