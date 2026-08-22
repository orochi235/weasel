import { describe, expect, it } from 'vitest';
import { createFakeAudioContext } from './fakeAudioContext';

describe('createFakeAudioContext', () => {
  it('starts suspended and resumes', async () => {
    const ctx = createFakeAudioContext();
    expect(ctx.state).toBe('suspended');
    await ctx.resume();
    expect(ctx.state).toBe('running');
  });

  it('advances the clock in seconds when told milliseconds', () => {
    const ctx = createFakeAudioContext();
    ctx._advance(500);
    expect(ctx.currentTime).toBe(0.5);
  });

  it('records connections', () => {
    const ctx = createFakeAudioContext();
    const g = ctx.createGain();
    g.connect(ctx.destination);
    expect(g.connectedTo).toEqual([ctx.destination]);
  });

  it('records source start times and collects every source', () => {
    const ctx = createFakeAudioContext();
    const s = ctx.createBufferSource();
    s.start(1.25);
    expect(s.started).toEqual([1.25]);
    expect(ctx._sources).toHaveLength(1);
  });
});
