import {
  type CompressorEffectOptions, createCompressorEffect, createDelayEffect, createFilterEffect,
  createReverbEffect, type DelayEffectOptions, type FilterEffectOptions, type ReverbEffectOptions,
} from '../effects';
import { impulseResponse } from '../impulse';
import type { InsertEffect } from '../inserts';
import { initParam, writeParam } from '../param';
import type { GraphNodeDef } from './types';

/** A graph node that multiplies its input by a gain: port `in`; param `gain`. */
export function createGainNode(ctx: BaseAudioContext, opts: { gain?: number } = {}): GraphNodeDef {
  const node = ctx.createGain();
  initParam(ctx, node.gain, opts.gain ?? 1);
  return {
    inputs: { in: node },
    output: node,
    params: { gain: (value, rampMs) => writeParam(ctx, node.gain, value, rampMs) },
  };
}

/** A graph node that pans its input in stereo: port `in`; param `pan`. */
export function createPanNode(ctx: BaseAudioContext, opts: { pan?: number } = {}): GraphNodeDef {
  const node = ctx.createStereoPanner();
  initParam(ctx, node.pan, opts.pan ?? 0);
  return {
    inputs: { in: node },
    output: node,
    params: { pan: (value, rampMs) => writeParam(ctx, node.pan, value, rampMs) },
  };
}

/** One port and one level param per name in `inputs`, summed into `output`. */
export function createMixNode(ctx: BaseAudioContext, opts: { inputs: readonly string[] }): GraphNodeDef {
  if (opts.inputs.length === 0) throw new RangeError('@weasel-js/audio: a mix needs at least one input');
  const output = ctx.createGain();
  const inputs: Record<string, AudioNode> = {};
  const params: Record<string, (value: number, rampMs: number) => void> = {};
  for (const name of opts.inputs) {
    if (Object.prototype.hasOwnProperty.call(inputs, name)) {
      throw new RangeError(`@weasel-js/audio: a mix has two inputs named "${name}"`);
    }
    const level = ctx.createGain();
    level.connect(output);
    inputs[name] = level;
    params[name] = (value, rampMs) => writeParam(ctx, level.gain, value, rampMs);
  }
  return { inputs, output, params };
}

/** Wrap an insert effect as a node with one port, `in`. */
export function insertNode(effect: InsertEffect, params: GraphNodeDef['params']): GraphNodeDef {
  return {
    inputs: { in: effect.input },
    output: effect.output,
    params,
    ...(effect.dispose ? { dispose: () => effect.dispose!() } : {}),
  };
}

/** A graph node over a filter insert: port `in`; params `frequency`, `Q`, `gain`. */
export function filterNode(ctx: BaseAudioContext, opts: FilterEffectOptions = {}): GraphNodeDef {
  const { filter } = createFilterEffect(ctx, opts);
  const write = (p: AudioParam) => (value: number, rampMs: number) => writeParam(ctx, p, value, rampMs);
  return insertNode({ input: filter, output: filter }, {
    frequency: write(filter.frequency),
    Q: write(filter.Q),
    gain: write(filter.gain),
  });
}

/** A graph node over a delay insert: port `in`; params `time` (ms), `feedback`, `mix`. */
export function delayNode(ctx: BaseAudioContext, opts: DelayEffectOptions = {}): GraphNodeDef {
  const fx = createDelayEffect(ctx, { ...opts, maxTime: opts.maxTime ?? Math.max(2000, opts.time ?? 0) });
  return insertNode(fx, {
    time: (value, rampMs) => fx.setTime(value, rampMs),
    feedback: (value, rampMs) => fx.setFeedback(value, rampMs),
    mix: (value, rampMs) => fx.setMix(value, rampMs),
  });
}

/** Options for `reverbNode`: the reverb effect's options, plus an `impulse` or the `seconds` of a synthesized one. */
export type ReverbNodeOptions = Omit<ReverbEffectOptions, 'impulse'> & {
  impulse?: AudioBuffer;
  /** Length of the synthesized impulse when none is given. Default 2. */
  seconds?: number;
};

/** A graph node over a reverb insert: port `in`; param `mix`. */
export function reverbNode(ctx: BaseAudioContext, opts: ReverbNodeOptions = {}): GraphNodeDef {
  const { seconds, impulse, ...rest } = opts;
  const fx = createReverbEffect(ctx, { ...rest, impulse: impulse ?? impulseResponse(ctx, seconds ?? 2) });
  return insertNode(fx, { mix: (value, rampMs) => fx.setMix(value, rampMs) });
}

/** A graph node over a compressor insert: port `in`; params `threshold`, `knee`, `ratio`, `attack` (ms), `release` (ms), `makeup`. */
export function compressorNode(ctx: BaseAudioContext, opts: CompressorEffectOptions = {}): GraphNodeDef {
  const fx = createCompressorEffect(ctx, opts);
  const { compressor, makeup } = fx;
  const write = (p: AudioParam, scale = 1) => (value: number, rampMs: number) =>
    writeParam(ctx, p, value * scale, rampMs);
  return insertNode(fx, {
    threshold: write(compressor.threshold),
    knee: write(compressor.knee),
    ratio: write(compressor.ratio),
    attack: write(compressor.attack, 0.001),
    release: write(compressor.release, 0.001),
    makeup: write(makeup.gain),
  });
}
