import { periodicWave } from '../periodicWave';
import { initParam, writeParam } from '../param';
import { noiseBuffer } from '../synthVoice';
import type { Inharmonic, NoiseColor, Waveform } from '../types';
import type { GraphNodeDef } from './types';

/** The waves an oscillator node takes: any `Waveform` except an inharmonic one. */
export type OscillatorWave = Exclude<Waveform, Inharmonic>;

type Scheduled = AudioBufferSourceNode | OscillatorNode;

/** A source's stable output gain and the one live, single-use node behind it. */
function sourceShell<N extends Scheduled>(ctx: BaseAudioContext, make: () => N) {
  const output = ctx.createGain();
  let live: N | null = null;
  return {
    output,
    live: (): N | null => live,
    /** `onEnd` runs if the node ends while it is still the live one: it played out. */
    begin(when: number, setup: (node: N) => void, offset?: number, onEnd?: () => void): N {
      const node = make();
      setup(node);
      node.connect(output);
      node.onended = () => {
        if (live !== node) return;
        live = null;
        node.disconnect();
        onEnd?.();
      };
      if (offset === undefined) node.start(when);
      else (node as AudioBufferSourceNode).start(when, offset);
      live = node;
      return node;
    },
    end(when: number): void {
      if (!live) return;
      const node = live;
      live = null;
      node.onended = () => node.disconnect();
      node.stop(when);
    },
    dispose(): void {
      if (live) {
        live.stop();
        live.disconnect();
        live = null;
      }
      output.disconnect();
    },
    level: (value: number, rampMs: number): void => writeParam(ctx, output.gain, value, rampMs),
  };
}

/** Options for `createFileSourceNode`: the buffer to play and whether it loops. */
export interface FileSourceNodeOptions {
  buffer: AudioBuffer;
  /** Default true. */
  loop?: boolean;
}

/** Plays a buffer, picking up where `stop` left it. Params: `rate`, `level`. */
export function createFileSourceNode(ctx: BaseAudioContext, opts: FileSourceNodeOptions): GraphNodeDef {
  const { buffer } = opts;
  const loop = opts.loop ?? true;
  let rate = 1;
  let offset = 0;
  let startedAt = 0;
  const shell = sourceShell(ctx, () => ctx.createBufferSource());

  const advance = (to: number): void => {
    const next = offset + Math.max(0, to - startedAt) * rate;
    offset = loop ? next % buffer.duration : Math.min(next, buffer.duration);
    startedAt = to;
  };

  return {
    inputs: {},
    output: shell.output,
    params: {
      rate(value, rampMs) {
        const src = shell.live();
        if (src) {
          advance(ctx.currentTime);
          writeParam(ctx, src.playbackRate, value, rampMs);
        }
        rate = value;
      },
      level: shell.level,
    },
    start(when) {
      if (shell.live()) return;
      startedAt = when;
      shell.begin(when, (s) => {
        s.buffer = buffer;
        s.loop = loop;
        initParam(ctx, s.playbackRate, rate);
      }, offset, () => {
        offset = 0;
      });
    },
    stop(when) {
      if (!shell.live()) return;
      advance(when);
      shell.end(when);
    },
    dispose: shell.dispose,
  };
}

/** Options for `createOscillatorNode`: the wave shape and starting frequency. */
export interface OscillatorNodeOptions {
  /** Default 'sine'. An array is the amplitude of each whole-number partial. */
  wave?: OscillatorWave;
  /** Hz. Default 440. */
  frequency?: number;
}

/** A tone. Params: `frequency`, `detune`, `level`. */
export function createOscillatorNode(ctx: BaseAudioContext, opts: OscillatorNodeOptions): GraphNodeDef {
  const wave = opts.wave ?? 'sine';
  let frequency = opts.frequency ?? 440;
  let detune = 0;
  const shell = sourceShell(ctx, () => ctx.createOscillator());

  return {
    inputs: {},
    output: shell.output,
    params: {
      frequency(value, rampMs) {
        const osc = shell.live();
        if (osc) writeParam(ctx, osc.frequency, value, rampMs);
        frequency = value;
      },
      detune(value, rampMs) {
        const osc = shell.live();
        if (osc) writeParam(ctx, osc.detune, value, rampMs);
        detune = value;
      },
      level: shell.level,
    },
    start(when) {
      if (shell.live()) return;
      shell.begin(when, (osc) => {
        if (typeof wave === 'string') osc.type = wave;
        else osc.setPeriodicWave(periodicWave(ctx, wave));
        initParam(ctx, osc.frequency, frequency);
        initParam(ctx, osc.detune, detune);
      });
    },
    stop: shell.end,
    dispose: shell.dispose,
  };
}

/** Options for `createNoiseNode`: the noise color whose shared buffer it loops. */
export interface NoiseNodeOptions {
  color: NoiseColor;
}

/** A loop of the shared noise buffer for its color. Param: `level`. */
export function createNoiseNode(ctx: BaseAudioContext, opts: NoiseNodeOptions): GraphNodeDef {
  const shell = sourceShell(ctx, () => ctx.createBufferSource());
  return {
    inputs: {},
    output: shell.output,
    params: { level: shell.level },
    start(when) {
      if (shell.live()) return;
      shell.begin(when, (src) => {
        src.buffer = noiseBuffer(ctx, opts.color);
        src.loop = true;
      });
    },
    stop: shell.end,
    dispose: shell.dispose,
  };
}
