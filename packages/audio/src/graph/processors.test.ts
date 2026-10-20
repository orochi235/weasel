import { describe, expect, it } from 'vitest';
import {
  createFakeAudioContext, type FakeBiquad, type FakeCompressor, type FakeConvolver, type FakeDelay,
  type FakeGain, type FakeNode, type FakePanner,
} from '../testing/fakeAudioContext';
import { allPaths } from '../testing/graphWalk';
import {
  compressorNode, createGainNode, createMixNode, createPanNode, delayNode, filterNode, reverbNode,
} from './processors';

const FADE = 10;

const setup = () => {
  const ctx = createFakeAudioContext();
  ctx.state = 'running';
  return ctx as never as ReturnType<typeof createFakeAudioContext> & BaseAudioContext;
};

describe('gain and pan', () => {
  it('expose their one param', () => {
    const ctx = setup();
    const g = createGainNode(ctx, { gain: 0.5 });
    const gain = g.output as never as FakeGain;
    expect(gain.gain.value).toBe(0.5);
    expect(g.inputs.in).toBe(g.output);
    g.params.gain(1, FADE);
    expect(gain.gain.ramps).toEqual([{ value: 1, at: FADE / 1000 }]);

    const p = createPanNode(ctx, { pan: -0.5 });
    const pan = p.output as never as FakePanner;
    expect(pan.pan.value).toBe(-0.5);
    p.params.pan(0.5, FADE);
    expect(pan.pan.ramps).toEqual([{ value: 0.5, at: FADE / 1000 }]);
  });

  it('default to unity gain and center pan', () => {
    const ctx = setup();
    expect((createGainNode(ctx, {}).output as never as FakeGain).gain.value).toBe(1);
    expect((createPanNode(ctx, {}).output as never as FakePanner).pan.value).toBe(0);
  });

  it('retargets a ramp in flight from where it is (proxy: the fake does not evaluate ramps)', () => {
    const ctx = setup();
    const g = createGainNode(ctx, {});
    const param = (g.output as never as FakeGain).gain;
    g.params.gain(0.2, FADE);
    ctx._advance(5);
    const before = param.value;
    param.holds.length = 0;
    g.params.gain(0.8, FADE);
    expect(param.holds).toEqual([{ value: before, at: 0.005 }]);
    expect(param.ramps.at(-1)).toEqual({ value: 0.8, at: 0.015 });
    expect(param.cancels.at(-1)).toBe(0.005);
  });
});

describe('mix', () => {
  it('has one port and one level per input', () => {
    const ctx = setup();
    const m = createMixNode(ctx, { inputs: ['a', 'b'] });
    expect(Object.keys(m.inputs)).toEqual(['a', 'b']);
    expect(Object.keys(m.params)).toEqual(['a', 'b']);
    const a = m.inputs.a as never as FakeGain;
    const b = m.inputs.b as never as FakeGain;
    expect(a.gain.value).toBe(1);
    m.params.b(0.3, 0);
    expect(b.gain.value).toBe(0.3);
    expect(a.gain.holds).toEqual([]);
    expect(allPaths(a, m.output as never as FakeNode)).toHaveLength(1);
    expect(allPaths(b, m.output as never as FakeNode)).toHaveLength(1);
  });

  it('throws on no inputs', () => {
    expect(() => createMixNode(setup(), { inputs: [] })).toThrow(/@weasel-js\/audio: /);
  });
});

describe('the effect adapters', () => {
  it('map delay params onto the effect', () => {
    const ctx = setup();
    const d = delayNode(ctx, {});
    expect(Object.keys(d.inputs)).toEqual(['in']);
    const input = d.inputs.in as never as FakeNode;
    const dry = input.connectedTo[0] as never as FakeGain;
    const delay = input.connectedTo[1] as never as FakeDelay;
    const wet = delay.connectedTo[0] as never as FakeGain;
    const loop = delay.connectedTo[1] as never as FakeGain;

    d.params.time(500, 0);
    expect(delay.delayTime.value).toBe(0.5);
    d.params.feedback(0.5, 0);
    expect(loop.gain.value).toBe(0.5);
    d.params.mix(1, 0);
    expect(wet.gain.value).toBe(1);
    expect(dry.gain.value).toBe(0);
    expect(() => d.params.feedback(1, 0)).toThrow(RangeError);
  });

  it('map filter params onto the biquad', () => {
    const ctx = setup();
    const f = filterNode(ctx, { type: 'peaking' });
    const biquad = f.inputs.in as never as FakeBiquad;
    expect(f.output).toBe(f.inputs.in);
    f.params.frequency(1200, 0);
    f.params.Q(4, 0);
    f.params.gain(6, FADE);
    expect(biquad.frequency.value).toBe(1200);
    expect(biquad.Q.value).toBe(4);
    expect(biquad.gain.ramps).toEqual([{ value: 6, at: FADE / 1000 }]);
  });

  it('map compressor attack and release from ms to seconds', () => {
    const ctx = setup();
    const c = compressorNode(ctx, {});
    const comp = c.inputs.in as never as FakeCompressor;
    const makeup = c.output as never as FakeGain;
    c.params.attack(20, 0);
    c.params.release(250, 0);
    c.params.threshold(-30, 0);
    c.params.knee(10, 0);
    c.params.ratio(8, 0);
    c.params.makeup(2, 0);
    expect(comp.attack.value).toBeCloseTo(0.02);
    expect(comp.release.value).toBeCloseTo(0.25);
    expect(comp.threshold.value).toBe(-30);
    expect(comp.knee.value).toBe(10);
    expect(comp.ratio.value).toBe(8);
    expect(makeup.gain.value).toBe(2);
  });

  it('forwards dispose: a delay node disconnects its feedback loop', () => {
    const ctx = setup();
    const d = delayNode(ctx, {});
    const delay = (d.inputs.in as never as FakeNode).connectedTo[1] as never as FakeDelay;
    const loop = delay.connectedTo[1];
    expect(loop.connectedTo).toContain(delay);
    d.dispose!();
    expect(loop.connectedTo).toHaveLength(0);
  });

  it('leaves dispose unset for an effect without one', () => {
    expect(filterNode(setup(), {}).dispose).toBeUndefined();
  });
});

describe('reverbNode', () => {
  const convolverOf = (def: ReturnType<typeof reverbNode>) =>
    (def.inputs.in as never as FakeNode).connectedTo[1] as never as FakeConvolver;

  it('builds its impulse from seconds, defaulting to 2', () => {
    const ctx = setup();
    expect((convolverOf(reverbNode(ctx, { seconds: 1 })).buffer as { duration: number }).duration).toBe(1);
    expect((convolverOf(reverbNode(ctx, {})).buffer as { duration: number }).duration).toBe(2);
  });

  it('uses a given impulse as is, and maps mix', () => {
    const ctx = setup();
    const impulse = ctx.createBuffer(1, 100, 100);
    const r = reverbNode(ctx, { impulse: impulse as never, mix: 0 });
    expect(convolverOf(r).buffer).toBe(impulse);
    const input = r.inputs.in as never as FakeNode;
    r.params.mix(0.25, 0);
    expect((input.connectedTo[0] as never as FakeGain).gain.value).toBe(0.75);
  });
});
