import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFakeOffscreenCanvas, uninstallFakeOffscreenCanvas } from './fakeOffscreenCanvas';

describe('uninstallFakeOffscreenCanvas', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('leaves the environment OffscreenCanvas alone once every install is undone', () => {
    const real = class {};
    vi.stubGlobal('OffscreenCanvas', real);
    installFakeOffscreenCanvas();
    uninstallFakeOffscreenCanvas();
    uninstallFakeOffscreenCanvas();
    expect(globalThis.OffscreenCanvas).toBe(real);
  });
});
