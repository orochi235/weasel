import { describe, it, expect, vi } from 'vitest';
import {
  subscribeGlyphReady, glyphGeneration, notifyGlyphReady,
} from './glyphReady';

describe('glyphGeneration', () => {
  it('advances on every notification', () => {
    // The pull-based companion to `subscribeGlyphReady`, for caches that
    // cannot hold a subscription. A module-level `subscribeGlyphReady(...)`
    // is a load-time side effect that reaches into another package: it makes
    // importing the renderer require the font package's whole surface, so any
    // consumer partially mocking `@weasel-js/font` fails at import rather
    // than at use. Reading a counter has no lifecycle and no import-order
    // hazard.
    const before = glyphGeneration();
    notifyGlyphReady();
    expect(glyphGeneration()).toBeGreaterThan(before);
  });

  it('advances whether or not anyone is subscribed', () => {
    // The whole point: a cache that only polls must still see the change.
    const start = glyphGeneration();
    notifyGlyphReady();
    notifyGlyphReady();
    expect(glyphGeneration()).toBe(start + 2);
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
