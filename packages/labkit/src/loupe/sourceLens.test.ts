import { createCanvasSource } from '@weasel-js/loupe';
import { describe, expect, it } from 'vitest';
import { resolveLoupeSource, sourceBoxIn } from './sourceLens';

function canvas(width = 200, height = 100): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

describe('resolveLoupeSource', () => {
  it('passes a CanvasSource through', () => {
    const s = createCanvasSource(canvas());
    expect(resolveLoupeSource(s)).toBe(s);
  });

  it('makes one source per canvas, however often a getter returns it', () => {
    const c = canvas();
    const get = () => c;
    const a = resolveLoupeSource(get);
    expect(a?.canvas).toBe(c);
    expect(resolveLoupeSource(get)).toBe(a);
    expect(resolveLoupeSource(c)).toBe(a);
  });

  it('is null while a getter has nothing yet', () => {
    expect(resolveLoupeSource(() => null)).toBeNull();
    expect(resolveLoupeSource(undefined)).toBeNull();
  });
});

describe('sourceBoxIn', () => {
  it('prefers the box the source declares', () => {
    const box = { x: 4, y: 5, width: 6, height: 7 };
    expect(sourceBoxIn(createCanvasSource(canvas(), { box: () => box }), null)).toBe(box);
  });

  it('falls back to the whole host for a canvas that is not on the page', () => {
    const host = document.createElement('div');
    host.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 150 }) as DOMRect;
    expect(sourceBoxIn(createCanvasSource(canvas()), host)).toEqual({
      x: 0,
      y: 0,
      width: 300,
      height: 150,
    });
  });

  it('measures a laid-out canvas against the host', () => {
    const host = document.createElement('div');
    const c = canvas();
    host.append(c);
    document.body.append(host);
    host.getBoundingClientRect = () => ({ left: 100, top: 50, width: 300, height: 150 }) as DOMRect;
    c.getBoundingClientRect = () => ({ left: 120, top: 60, width: 100, height: 50 }) as DOMRect;
    expect(sourceBoxIn(createCanvasSource(c), host)).toEqual({
      x: 20,
      y: 10,
      width: 100,
      height: 50,
    });
    host.remove();
  });
});
