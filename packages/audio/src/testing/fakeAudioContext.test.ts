import { describe, expect, it, vi } from 'vitest';
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

  it('notifies statechange listeners, and stops once removed', async () => {
    const ctx = createFakeAudioContext();
    const seen: string[] = [];
    const fn = () => seen.push(ctx.state);
    ctx.addEventListener('statechange', fn);
    await ctx.resume();
    await ctx.suspend();
    ctx.removeEventListener('statechange', fn);
    await ctx.resume();
    expect(seen).toEqual(['running', 'suspended']);
  });

  it('records connections in both directions', () => {
    const ctx = createFakeAudioContext();
    const g = ctx.createGain();
    g.connect(ctx.destination);
    expect(g.connectedTo).toEqual([ctx.destination]);
    expect(ctx.destination.connectedFrom).toEqual([g]);
  });

  it('removes the edge on disconnect instead of only flagging it', () => {
    const ctx = createFakeAudioContext();
    const g = ctx.createGain();
    g.connect(ctx.destination);
    g.disconnect();
    expect(g.connectedTo).toEqual([]);
    expect(ctx.destination.connectedFrom).toEqual([]);
  });

  it('disconnects one target and leaves the others wired', () => {
    const ctx = createFakeAudioContext();
    const g = ctx.createGain();
    const a = ctx.createAnalyser();
    g.connect(ctx.destination);
    g.connect(a);
    g.disconnect(a);
    expect(g.connectedTo).toEqual([ctx.destination]);
    expect(a.connectedFrom).toEqual([]);
  });

  it('records source start times and collects every source', () => {
    const ctx = createFakeAudioContext();
    const s = ctx.createBufferSource();
    s.start(1.25);
    expect(s.started).toEqual([1.25]);
    expect(ctx._sources).toHaveLength(1);
  });

  it('throws on a second start, as the specification requires', () => {
    const ctx = createFakeAudioContext();
    const s = ctx.createBufferSource();
    s.start(0);
    expect(() => s.start(1)).toThrow(/InvalidStateError/);
  });

  it('throws on stop before start, as the specification requires', () => {
    const ctx = createFakeAudioContext();
    const s = ctx.createBufferSource();
    expect(() => s.stop()).toThrow(/InvalidStateError/);
  });

  it('fires onended when the clock passes the buffer duration', () => {
    const ctx = createFakeAudioContext();
    const s = ctx.createBufferSource();
    const done = vi.fn();
    s.buffer = { duration: 0.5 };
    s.onended = done;
    s.start(0);
    ctx._advance(400);
    expect(done).not.toHaveBeenCalled();
    ctx._advance(200);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('never ends a looping source on its own', () => {
    const ctx = createFakeAudioContext();
    const s = ctx.createBufferSource();
    const done = vi.fn();
    s.buffer = { duration: 0.5 };
    s.loop = true;
    s.onended = done;
    s.start(0);
    ctx._advance(10_000);
    expect(done).not.toHaveBeenCalled();
  });

  it('fires onended at a scheduled stop time, before the buffer runs out', () => {
    const ctx = createFakeAudioContext();
    const s = ctx.createBufferSource();
    const done = vi.fn();
    s.buffer = { duration: 10 };
    s.onended = done;
    s.start(0);
    s.stop(0.25);
    ctx._advance(100);
    expect(done).not.toHaveBeenCalled();
    ctx._advance(200);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('ends a source once only, and _end forces it', () => {
    const ctx = createFakeAudioContext();
    const s = ctx.createBufferSource();
    const done = vi.fn();
    s.buffer = { duration: 0.5 };
    s.onended = done;
    s.start(0);
    ctx._end(s);
    ctx._advance(10_000);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('records ramps, holds and cancels on a param', () => {
    const ctx = createFakeAudioContext();
    const g = ctx.createGain();
    g.gain.cancelScheduledValues(1);
    g.gain.setValueAtTime(0.5, 1);
    g.gain.linearRampToValueAtTime(0, 2);
    expect(g.gain.cancels).toEqual([1]);
    expect(g.gain.holds).toEqual([{ value: 0.5, at: 1 }]);
    expect(g.gain.ramps).toEqual([{ value: 0, at: 2 }]);
    // A ramp schedules a target; it does not jump the value to it.
    expect(g.gain.value).toBe(0.5);
  });

  it('derives frequencyBinCount from the assigned fftSize', () => {
    const ctx = createFakeAudioContext();
    const a = ctx.createAnalyser();
    expect(a.frequencyBinCount).toBe(1024);
    a.fftSize = 512;
    expect(a.frequencyBinCount).toBe(256);
  });

  it('writes index-dependent and length-dependent analyser data', () => {
    const ctx = createFakeAudioContext();
    const a = ctx.createAnalyser();
    const small = new Uint8Array(4);
    a.getByteFrequencyData(small);
    expect([...small]).toEqual([0, 64, 128, 191]);
    const big = new Uint8Array(8);
    a.getByteTimeDomainData(big);
    expect([...big]).toEqual([0, 32, 64, 96, 128, 159, 191, 223]);
  });

  it('fills a constant when told a number', () => {
    const ctx = createFakeAudioContext();
    ctx._analyserBytes = 200;
    const a = ctx.createAnalyser();
    const out = new Uint8Array(3);
    a.getByteFrequencyData(out);
    expect([...out]).toEqual([200, 200, 200]);
  });
});
