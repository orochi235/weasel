import { describe, expect, it } from 'vitest';
import {
  createCompressorEffect, createDelayEffect, createFilterEffect, createReverbEffect,
} from './effects';
import {
  createFakeAudioContext,
  type FakeBiquad, type FakeCompressor, type FakeConvolver, type FakeDelay, type FakeGain,
  type FakeNode,
} from './testing/fakeAudioContext';
import { allPaths } from './testing/graphWalk';

const setup = () => {
  const ctx = createFakeAudioContext();
  ctx.state = 'running';
  return ctx;
};
const fake = (n: unknown) => n as FakeNode;

describe('createFilterEffect', () => {
  it('is one biquad, configured from its options', () => {
    const ctx = setup();
    const fx = createFilterEffect(ctx as never, { type: 'highpass', frequency: 900, Q: 2, gain: 3 });
    const f = fx.filter as never as FakeBiquad;
    expect(fx.input).toBe(fx.filter);
    expect(fx.output).toBe(fx.filter);
    expect([f.type, f.frequency.value, f.Q.value, f.gain.value]).toEqual(['highpass', 900, 2, 3]);
  });

  it('keeps the node defaults for what it is not told', () => {
    const ctx = setup();
    const f = createFilterEffect(ctx as never).filter as never as FakeBiquad;
    expect([f.type, f.frequency.value]).toEqual(['lowpass', 350]);
  });
});

describe('createReverbEffect', () => {
  it('convolves the impulse on a wet route beside a dry one', () => {
    const ctx = setup();
    const impulse = ctx.createBuffer(2, 480, 48000);
    const fx = createReverbEffect(ctx as never, { impulse: impulse as never });
    const conv = fx.convolver as never as FakeConvolver;
    expect(conv.buffer).toBe(impulse);
    const routes = allPaths(fake(fx.input), fake(fx.output));
    expect(routes.map((p) => p.some((n) => n === conv))).toEqual([false, true]);
  });

  it('splits the mix between wet and dry, and ramps a change', () => {
    const ctx = setup();
    const fx = createReverbEffect(ctx as never, {
      impulse: ctx.createBuffer(1, 1, 48000) as never, mix: 0.25,
    });
    const [dry, wetRoute] = allPaths(fake(fx.input), fake(fx.output));
    const dryGain = dry[1] as FakeGain;
    const wetGain = wetRoute[2] as FakeGain;
    expect([dryGain.gain.value, wetGain.gain.value, fx.mix()]).toEqual([0.75, 0.25, 0.25]);
    fx.setMix(1, 50);
    expect(wetGain.gain.ramps.at(-1)).toEqual({ value: 1, at: 0.05 });
    expect(dryGain.gain.ramps.at(-1)).toEqual({ value: 0, at: 0.05 });
  });

  it('passes normalize through', () => {
    const ctx = setup();
    const fx = createReverbEffect(ctx as never, {
      impulse: ctx.createBuffer(1, 1, 48000) as never, normalize: false,
    });
    expect((fx.convolver as never as FakeConvolver).normalize).toBe(false);
  });

  it('rejects a mix outside 0..1', () => {
    const ctx = setup();
    const impulse = ctx.createBuffer(1, 1, 48000) as never;
    expect(() => createReverbEffect(ctx as never, { impulse, mix: 1.5 })).toThrow(RangeError);
  });
});

describe('createDelayEffect', () => {
  it('feeds the delay back into itself through a feedback gain', () => {
    const ctx = setup();
    const fx = createDelayEffect(ctx as never, { time: 250, feedback: 0.4, mix: 0.5 });
    const d = fx.delay as never as FakeDelay;
    expect(d.delayTime.value).toBe(0.25);
    const fb = d.connectedTo.find((n) => n.connectedTo.includes(d)) as FakeGain;
    expect(fb.gain.value).toBe(0.4);
    expect(fx.feedback()).toBe(0.4);
  });

  it('sizes the delay line to hold the longest time it may be set to', () => {
    const ctx = setup();
    expect((createDelayEffect(ctx as never, { time: 250 }).delay as never as FakeDelay).maxDelayTime)
      .toBe(1);
    expect((createDelayEffect(ctx as never, { time: 250, maxTime: 3000 }).delay as never as FakeDelay)
      .maxDelayTime).toBe(3);
  });

  it('ramps time and feedback', () => {
    const ctx = setup();
    const fx = createDelayEffect(ctx as never, { time: 100 });
    fx.setTime(300, 40);
    fx.setFeedback(0.6, 40);
    const d = fx.delay as never as FakeDelay;
    expect(d.delayTime.ramps.at(-1)).toEqual({ value: 0.3, at: 0.04 });
    const fb = d.connectedTo.find((n) => n.connectedTo.includes(d)) as FakeGain;
    expect(fb.gain.ramps.at(-1)).toEqual({ value: 0.6, at: 0.04 });
  });

  it('refuses feedback that would grow without bound, and a time past the line', () => {
    const ctx = setup();
    expect(() => createDelayEffect(ctx as never, { feedback: 1 })).toThrow(RangeError);
    const fx = createDelayEffect(ctx as never, { time: 100 });
    expect(() => fx.setFeedback(-1.2)).toThrow(RangeError);
    expect(() => fx.setTime(5000)).toThrow(RangeError);
  });

  it('breaks its feedback loop on dispose', () => {
    const ctx = setup();
    const fx = createDelayEffect(ctx as never);
    const d = fx.delay as never as FakeDelay;
    fx.dispose();
    expect(d.connectedTo).toEqual([]);
  });
});

describe('createCompressorEffect', () => {
  it('compresses into a makeup gain', () => {
    const ctx = setup();
    const fx = createCompressorEffect(ctx as never, {
      threshold: -30, knee: 6, ratio: 4, attack: 5, release: 120, makeup: 1.5,
    });
    const c = fx.compressor as never as FakeCompressor;
    expect(fx.input).toBe(fx.compressor);
    expect(c.connectedTo).toEqual([fx.makeup]);
    expect(fx.output).toBe(fx.makeup);
    expect([c.threshold.value, c.knee.value, c.ratio.value, c.attack.value, c.release.value])
      .toEqual([-30, 6, 4, 0.005, 0.12]);
    expect((fx.makeup as never as FakeGain).gain.value).toBe(1.5);
  });
});
