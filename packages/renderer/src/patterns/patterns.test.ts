import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTilePattern } from './';
import {
  getTexture,
  _resetTextureRegistryForTests,
} from '../textures/registerTexture';
import {
  installFakeOffscreenCanvas, uninstallFakeOffscreenCanvas, type FakeOffscreenState,
} from './test-utils/fakeOffscreenCanvas';

let fake: FakeOffscreenState;

beforeEach(() => {
  fake = installFakeOffscreenCanvas();
  _resetTextureRegistryForTests();
});

afterEach(uninstallFakeOffscreenCanvas);

describe('createTilePattern', () => {
  it('invokes the draw callback exactly once with a 2D ctx and the size', () => {
    const draw = vi.fn();
    createTilePattern({ size: 8, draw });
    expect(draw).toHaveBeenCalledTimes(1);
    expect(draw.mock.calls[0][1]).toBe(8);
    // First arg is the 2D ctx — sanity check it has the surface we need.
    const oc = draw.mock.calls[0][0] as CanvasRenderingContext2D;
    expect(typeof oc.beginPath).toBe('function');
  });

  it('creates the OffscreenCanvas at the requested size', () => {
    createTilePattern({ size: 8, draw: () => {} });
    expect(fake.last).toMatchObject({ width: 8, height: 8 });
  });

  it('returns a TextureHandle ({ id: string }) on success', () => {
    const handle = createTilePattern({ size: 4, draw: () => {} });
    expect(handle).not.toBeNull();
    expect(typeof handle!.id).toBe('string');
    expect(handle!.id.length).toBeGreaterThan(0);
  });

  it('registers the bitmap so getTexture returns the entry', () => {
    const handle = createTilePattern({ size: 4, draw: () => {} });
    const entry = getTexture(handle!.id);
    expect(entry).not.toBeNull();
    expect(entry!.source).toBeDefined();
  });

  it('returns null when neither OffscreenCanvas nor a usable canvas fallback is available', () => {
    uninstallFakeOffscreenCanvas();
    // jsdom's HTMLCanvasElement.getContext is not implemented; stub it to
    // return null so the fallback path observes "no 2D ctx" cleanly without
    // jsdom logging a not-implemented warning to stderr.
    const spy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => null);
    try {
      const handle = createTilePattern({ size: 4, draw: () => {} });
      expect(handle).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});
