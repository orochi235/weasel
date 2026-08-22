import { describe, expect, it } from 'vitest';
import { createVoicePool } from './voicePool';

describe('createVoicePool', () => {
  it('allocates distinct slots while under the limit', () => {
    const pool = createVoicePool({ limit: 3 });
    const a = pool.acquire({ startedAt: 0, gain: 1 });
    const b = pool.acquire({ startedAt: 1, gain: 1 });
    expect(a.slot).not.toBe(b.slot);
    expect(a.stolen).toBe(null);
    expect(b.stolen).toBe(null);
  });

  it('reuses a released slot instead of growing', () => {
    const pool = createVoicePool({ limit: 2 });
    const a = pool.acquire({ startedAt: 0, gain: 1 });
    pool.release(a.slot);
    const b = pool.acquire({ startedAt: 1, gain: 1 });
    expect(b.slot).toBe(a.slot);
    expect(b.stolen).toBe(null);
  });

  it('steals the oldest voice when full', () => {
    const pool = createVoicePool({ limit: 2, steal: 'oldest' });
    const a = pool.acquire({ startedAt: 10, gain: 1 });
    pool.acquire({ startedAt: 20, gain: 1 });
    const c = pool.acquire({ startedAt: 30, gain: 1 });
    expect(c.stolen).toBe(a.slot);
    expect(c.slot).toBe(a.slot);
  });

  it('steals the quietest voice under the quietest policy', () => {
    const pool = createVoicePool({ limit: 2, steal: 'quietest' });
    pool.acquire({ startedAt: 10, gain: 0.9 });
    const b = pool.acquire({ startedAt: 20, gain: 0.1 });
    const c = pool.acquire({ startedAt: 30, gain: 1 });
    expect(c.stolen).toBe(b.slot);
  });

  it('reports how many voices are live', () => {
    const pool = createVoicePool({ limit: 4 });
    pool.acquire({ startedAt: 0, gain: 1 });
    pool.acquire({ startedAt: 1, gain: 1 });
    expect(pool.active()).toBe(2);
  });

  it('drops the count when a voice is released', () => {
    const pool = createVoicePool({ limit: 4 });
    const a = pool.acquire({ startedAt: 0, gain: 1 });
    pool.release(a.slot);
    expect(pool.active()).toBe(0);
  });

  it('ignores a release for a slot that is not live', () => {
    const pool = createVoicePool({ limit: 2 });
    expect(() => pool.release(99)).not.toThrow();
    expect(pool.active()).toBe(0);
  });

  it('tracks a gain change so stealing sees the current value', () => {
    const pool = createVoicePool({ limit: 2, steal: 'quietest' });
    const a = pool.acquire({ startedAt: 10, gain: 1 });
    pool.acquire({ startedAt: 20, gain: 0.5 });
    pool.setGain(a.slot, 0.01);
    const c = pool.acquire({ startedAt: 30, gain: 1 });
    expect(c.stolen).toBe(a.slot);
  });
});
