import type { InsertEffect } from './inserts';
import { writeParam } from './param';

// Built-in insert effects. Each exposes its Web Audio nodes for anything its
// options do not cover; times are ms, as everywhere else in the package.

export interface FilterEffectOptions {
  /** Default 'lowpass'. */
  type?: BiquadFilterType;
  /** Hz. Default 350, the node's own. */
  frequency?: number;
  Q?: number;
  /** dB, for the shelf and peaking types. */
  gain?: number;
}

export interface FilterEffect extends InsertEffect {
  readonly filter: BiquadFilterNode;
}

/** A `BiquadFilterNode`. Write its params through `filter` to sweep it. */
export function createFilterEffect(ctx: BaseAudioContext, opts: FilterEffectOptions = {}): FilterEffect {
  const filter = ctx.createBiquadFilter();
  filter.type = opts.type ?? 'lowpass';
  if (opts.frequency !== undefined) writeParam(ctx, filter.frequency, opts.frequency);
  if (opts.Q !== undefined) writeParam(ctx, filter.Q, opts.Q);
  if (opts.gain !== undefined) writeParam(ctx, filter.gain, opts.gain);
  return { input: filter, output: filter, filter };
}

/** A wet/dry mix around an effect, for the effects whose output replaces
 *  rather than colors the signal. */
export interface WetDryMix {
  /** 0 is all dry, 1 all wet. */
  mix(): number;
  setMix(mix: number, rampMs?: number): void;
}

const checkMix = (mix: number): number => {
  if (!(mix >= 0 && mix <= 1)) throw new RangeError(`@weasel-js/audio: mix ${mix} is outside 0..1`);
  return mix;
};

/** `input → dry → output` beside `input → wetIn … wetOut → wet → output`.
 *  The dry route is wired first. */
function wetDry(
  ctx: BaseAudioContext,
  wetIn: AudioNode,
  wetOut: AudioNode,
  initial: number,
): WetDryMix & { input: GainNode; output: GainNode } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  input.connect(dry);
  dry.connect(output);
  input.connect(wetIn);
  wetOut.connect(wet);
  wet.connect(output);
  let mix = checkMix(initial);
  const write = (rampMs?: number): void => {
    writeParam(ctx, dry.gain, 1 - mix, rampMs);
    writeParam(ctx, wet.gain, mix, rampMs);
  };
  write();
  return {
    input, output,
    mix: () => mix,
    setMix(value, rampMs) {
      mix = checkMix(value);
      write(rampMs);
    },
  };
}

export interface ReverbEffectOptions {
  /** The room: an impulse response, loaded or synthesized like any buffer. */
  impulse: AudioBuffer;
  /** Default 0.3. */
  mix?: number;
  /** Scale the impulse to a consistent level. Default true, the node's own. */
  normalize?: boolean;
}

export interface ReverbEffect extends InsertEffect, WetDryMix {
  readonly convolver: ConvolverNode;
}

/** Convolution reverb from an impulse buffer, with a wet/dry mix. */
export function createReverbEffect(ctx: BaseAudioContext, opts: ReverbEffectOptions): ReverbEffect {
  const convolver = ctx.createConvolver();
  // Before the buffer: the node reads `normalize` when the buffer is set.
  convolver.normalize = opts.normalize ?? true;
  convolver.buffer = opts.impulse;
  const m = wetDry(ctx, convolver, convolver, opts.mix ?? 0.3);
  return { input: m.input, output: m.output, convolver, mix: m.mix, setMix: m.setMix };
}

export interface DelayEffectOptions {
  /** ms. Default 250. */
  time?: number;
  /** How much of each repeat feeds the next, -1..1 exclusive. Default 0.35. */
  feedback?: number;
  /** Default 0.35. */
  mix?: number;
  /** The longest `time` the line can be set to later, ms. Default the larger
   *  of 1000 and `time`. */
  maxTime?: number;
}

export interface DelayEffect extends InsertEffect, WetDryMix {
  readonly delay: DelayNode;
  setTime(ms: number, rampMs?: number): void;
  feedback(): number;
  setFeedback(value: number, rampMs?: number): void;
  /** Break the feedback loop. Called for you when the slot is removed. */
  dispose(): void;
}

const checkFeedback = (value: number): number => {
  if (!(value > -1 && value < 1)) {
    throw new RangeError(`@weasel-js/audio: feedback ${value} must be inside -1..1, or the repeats grow`);
  }
  return value;
};

/** A feedback delay with a wet/dry mix. Ramping `setTime` bends the pitch of
 *  the repeats while it moves, as a tape delay does. */
export function createDelayEffect(ctx: BaseAudioContext, opts: DelayEffectOptions = {}): DelayEffect {
  const time = opts.time ?? 250;
  const maxTime = opts.maxTime ?? Math.max(1000, time);
  let fb = checkFeedback(opts.feedback ?? 0.35);
  const delay = ctx.createDelay(maxTime / 1000);
  const loop = ctx.createGain();
  const m = wetDry(ctx, delay, delay, opts.mix ?? 0.35);
  delay.connect(loop);
  loop.connect(delay);
  writeParam(ctx, delay.delayTime, time / 1000);
  writeParam(ctx, loop.gain, fb);
  return {
    input: m.input, output: m.output, delay, mix: m.mix, setMix: m.setMix,
    setTime(ms, rampMs) {
      if (!(ms >= 0 && ms <= maxTime)) {
        throw new RangeError(`@weasel-js/audio: delay time ${ms} is outside 0..${maxTime} ms`);
      }
      writeParam(ctx, delay.delayTime, ms / 1000, rampMs);
    },
    feedback: () => fb,
    setFeedback(value, rampMs) {
      fb = checkFeedback(value);
      writeParam(ctx, loop.gain, fb, rampMs);
    },
    dispose() {
      delay.disconnect();
      loop.disconnect();
    },
  };
}

export interface CompressorEffectOptions {
  /** dB. */
  threshold?: number;
  /** dB. */
  knee?: number;
  ratio?: number;
  /** ms. */
  attack?: number;
  /** ms. */
  release?: number;
  /** Linear gain after the compressor, to win back the level it takes. Default 1. */
  makeup?: number;
}

export interface CompressorEffect extends InsertEffect {
  readonly compressor: DynamicsCompressorNode;
  readonly makeup: GainNode;
}

/** A `DynamicsCompressorNode` into a makeup gain. Unset options keep the
 *  node's defaults. */
export function createCompressorEffect(
  ctx: BaseAudioContext,
  opts: CompressorEffectOptions = {},
): CompressorEffect {
  const compressor = ctx.createDynamicsCompressor();
  const makeup = ctx.createGain();
  compressor.connect(makeup);
  const set = (param: AudioParam, value: number | undefined): void => {
    if (value !== undefined) writeParam(ctx, param, value);
  };
  set(compressor.threshold, opts.threshold);
  set(compressor.knee, opts.knee);
  set(compressor.ratio, opts.ratio);
  set(compressor.attack, opts.attack === undefined ? undefined : opts.attack / 1000);
  set(compressor.release, opts.release === undefined ? undefined : opts.release / 1000);
  set(makeup.gain, opts.makeup ?? 1);
  return { input: compressor, output: makeup, compressor, makeup };
}
