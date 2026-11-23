import { describe, expect, it, vi } from 'vitest';
import { createSoundCache } from './soundCache';
import { createFakeAudioContext } from './testing/fakeAudioContext';

const okFetch = () => vi.fn(async () => ({
  ok: true,
  arrayBuffer: async () => new ArrayBuffer(8),
})) as never;

describe('createSoundCache', () => {
  it('loads a url and returns an opaque handle', async () => {
    const ctx = createFakeAudioContext();
    const cache = createSoundCache(ctx as never, okFetch());
    const h = await cache.load('/a.wav');
    expect(typeof h.id).toBe('string');
  });

  it('answers no handle another cache made', () => {
    const ctx = createFakeAudioContext();
    const a = createSoundCache(ctx as never, okFetch());
    const b = createSoundCache(ctx as never, okFetch());
    const handle = a.register(ctx.createBuffer(1, 8, 48000) as never);
    b.register(ctx.createBuffer(1, 8, 48000) as never);
    expect(b.buffer(handle)).toBeNull();
  });

  it('returns the same handle for a repeat load', async () => {
    const ctx = createFakeAudioContext();
    const fetchFn = okFetch();
    const cache = createSoundCache(ctx as never, fetchFn);
    const a = await cache.load('/a.wav');
    const b = await cache.load('/a.wav');
    expect(b.id).toBe(a.id);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent loads of the same url', async () => {
    const ctx = createFakeAudioContext();
    const fetchFn = okFetch();
    const cache = createSoundCache(ctx as never, fetchFn);
    const [a, b] = await Promise.all([cache.load('/a.wav'), cache.load('/a.wav')]);
    expect(a.id).toBe(b.id);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('gives different urls different handles', async () => {
    const ctx = createFakeAudioContext();
    const cache = createSoundCache(ctx as never, okFetch());
    const a = await cache.load('/a.wav');
    const b = await cache.load('/b.wav');
    expect(a.id).not.toBe(b.id);
  });

  it('resolves a handle back to its decoded buffer', async () => {
    const ctx = createFakeAudioContext();
    const cache = createSoundCache(ctx as never, okFetch());
    const h = await cache.load('/a.wav');
    expect(cache.buffer(h)).toEqual({ duration: 1 });
  });

  it('throws with the url and status on a failed fetch', async () => {
    const ctx = createFakeAudioContext();
    const fetchFn = vi.fn(async () => ({ ok: false, status: 404 })) as never;
    const cache = createSoundCache(ctx as never, fetchFn);
    await expect(cache.load('/missing.wav')).rejects.toThrow(/missing\.wav.*404/);
  });

  it('does not cache a failed load, so a retry refetches', async () => {
    const ctx = createFakeAudioContext();
    let calls = 0;
    const fetchFn = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return { ok: false, status: 500 };
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
    }) as never;
    const cache = createSoundCache(ctx as never, fetchFn);
    await expect(cache.load('/x.wav')).rejects.toThrow();
    await expect(cache.load('/x.wav')).resolves.toBeDefined();
    expect(calls).toBe(2);
  });

  it('maps every name to its own url\'s handle', async () => {
    const ctx = createFakeAudioContext();
    const cache = createSoundCache(ctx as never, okFetch());
    const handles = await cache.loadAll({ jump: '/jump.wav', land: '/land.wav' });
    const direct = await cache.load('/land.wav');
    expect(Object.keys(handles)).toEqual(['jump', 'land']);
    expect(handles.land.id).toBe(direct.id);
    expect(handles.jump.id).not.toBe(handles.land.id);
  });

  it('decodes raw bytes without a url', async () => {
    const ctx = createFakeAudioContext();
    const cache = createSoundCache(ctx as never, okFetch());
    const h = await cache.decode(new ArrayBuffer(8));
    expect(cache.buffer(h)).toEqual({ duration: 1 });
  });
});

describe('createSoundCache.register', () => {
  it('registers a buffer the caller already holds', () => {
    const ctx = createFakeAudioContext();
    const cache = createSoundCache(ctx as never, okFetch());
    const buffer = { duration: 2.5 } as never;
    const h = cache.register(buffer);
    expect(cache.buffer(h)).toBe(buffer);
  });

  it('gives each registered buffer its own handle', () => {
    const ctx = createFakeAudioContext();
    const cache = createSoundCache(ctx as never, okFetch());
    const a = cache.register({ duration: 1 } as never);
    const b = cache.register({ duration: 1 } as never);
    expect(a.id).not.toBe(b.id);
  });

  it('loadAll returns a record with no prototype, so a misspelled key reads undefined', async () => {
    const ctx = createFakeAudioContext();
    const cache = createSoundCache(ctx as never, okFetch());
    const handles = await cache.loadAll({ hit: '/hit.wav', __proto__x: '/x.wav' });
    expect(Object.getPrototypeOf(handles)).toBe(null);
    expect(handles.constructor).toBeUndefined();
    expect(Object.keys(handles)).toEqual(['hit', '__proto__x']);
  });
});
