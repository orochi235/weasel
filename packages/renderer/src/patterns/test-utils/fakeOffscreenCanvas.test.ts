import { afterEach, describe, expect, it } from 'vitest';
import { installFakeOffscreenCanvas, uninstallFakeOffscreenCanvas } from './fakeOffscreenCanvas';

const g = globalThis as unknown as { OffscreenCanvas?: unknown };

describe('uninstallFakeOffscreenCanvas', () => {
  afterEach(() => { delete g.OffscreenCanvas; });

  it('puts back an OffscreenCanvas that was there before the fake', () => {
    const real = class {};
    g.OffscreenCanvas = real;
    installFakeOffscreenCanvas();
    expect(g.OffscreenCanvas).not.toBe(real);
    uninstallFakeOffscreenCanvas();
    expect(g.OffscreenCanvas).toBe(real);
  });

  it('leaves none where there was none', () => {
    installFakeOffscreenCanvas();
    uninstallFakeOffscreenCanvas();
    expect('OffscreenCanvas' in g).toBe(false);
  });
});
