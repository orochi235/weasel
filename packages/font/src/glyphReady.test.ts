import { describe, it, expect, vi } from 'vitest';
import {
  subscribeGlyphReady, glyphGeneration, faceGeneration, notifyGlyphReady, notifyGlyphBaked,
} from './glyphReady';

describe('glyphGeneration', () => {
  it('advances whether or not anyone is subscribed', () => {
    // The pull-based companion to `subscribeGlyphReady`, for caches that
    // cannot hold a subscription. A module-level `subscribeGlyphReady(...)`
    // is a load-time side effect that reaches into another package: it makes
    // importing the renderer require the font package's whole surface, so any
    // consumer partially mocking `@weasel-js/font` fails at import rather
    // than at use. Reading a counter has no lifecycle and no import-order
    // hazard.
    const start = glyphGeneration();
    notifyGlyphReady();
    notifyGlyphReady();
    expect(glyphGeneration()).toBe(start + 2);
  });

  it('tells a bake landing from a change to the faces', () => {
    const cb = vi.fn();
    const unsubscribe = subscribeGlyphReady(cb);
    const [glyphs, faces] = [glyphGeneration(), faceGeneration()];
    notifyGlyphBaked();
    expect([glyphGeneration(), faceGeneration()]).toEqual([glyphs + 1, faces]);
    notifyGlyphReady();
    expect([glyphGeneration(), faceGeneration()]).toEqual([glyphs + 2, faces + 1]);
    expect(cb).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('still drives push subscribers', () => {
    const cb = vi.fn();
    const unsubscribe = subscribeGlyphReady(cb);
    try {
      notifyGlyphReady();
      expect(cb).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it('runs the subscribers after one that throws, and does not throw into the notifier', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const later = vi.fn();
    const stopFirst = subscribeGlyphReady(() => {
      throw new Error('boom');
    });
    const stopLater = subscribeGlyphReady(later);
    expect(() => notifyGlyphReady()).not.toThrow();
    expect(later).toHaveBeenCalledTimes(1);
    stopFirst();
    stopLater();
    error.mockRestore();
  });
});
