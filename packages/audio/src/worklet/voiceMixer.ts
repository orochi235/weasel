import { createNoiseKernel, createNoteKernel, type VoiceKernel } from '../voiceKernel';
import type { ToProcessor } from './protocol';

/**
 * Kernels mixed onto one stereo bus from posted events: the inside of the
 * voice processor, kept apart from `AudioWorkletProcessor` so it runs without
 * one. Each voice is panned the way a `StereoPannerNode` pans a mono source,
 * then scaled by its level — the order a node voice's chain applies them in.
 */
export interface VoiceMixer {
  /** Apply an event at `frame`, the first frame of the next block. */
  receive(event: ToProcessor, frame: number): void;
  /** Add every voice's samples for the block starting at `frame` into `left`
   *  and `right`. Returns the ids of voices that ended in it. */
  render(left: Float32Array, right: Float32Array, frame: number): number[];
  /** Voices started or waiting to start. */
  size(): number;
}

interface Voice {
  kernel: VoiceKernel;
  /** Frames, absolute. */
  start: number;
  stop: number;
  pan: number;
  from: number;
  to: number;
  rampStart: number;
  rampEnd: number;
}

const levelAt = (v: Voice, frame: number): number => {
  if (frame >= v.rampEnd) return v.to;
  if (frame <= v.rampStart) return v.from;
  return v.from + ((v.to - v.from) * (frame - v.rampStart)) / (v.rampEnd - v.rampStart);
};

export function createVoiceMixer(sampleRate: number): VoiceMixer {
  const voices = new Map<number, Voice>();
  let scratch = new Float32Array(128);
  const frameOf = (seconds: number): number => Math.round(seconds * sampleRate);

  const add = (id: number, kernel: VoiceKernel, at: number, level: number, pan: number): void => {
    voices.set(id, {
      kernel, start: frameOf(at), stop: Infinity, pan,
      from: level, to: level, rampStart: 0, rampEnd: 0,
    });
  };

  return {
    receive(event, frame) {
      if (event.kind === 'note' || event.kind === 'noise') {
        const kernel = event.kind === 'note'
          ? createNoteKernel(event.patch, sampleRate)
          : createNoiseKernel(event.patch, sampleRate, () => event.seed);
        kernel.retune(event.rate, event.detune);
        add(event.id, kernel, event.at, event.level, event.pan);
        return;
      }
      if (event.kind === 'dispose') {
        voices.clear();
        return;
      }
      const v = voices.get(event.id);
      if (!v) return;
      if (event.kind === 'level') {
        v.from = levelAt(v, frame);
        v.to = event.value;
        v.rampStart = frame;
        v.rampEnd = Math.max(frame, event.end > 0 ? frameOf(event.end) : frame);
      } else if (event.kind === 'pan') {
        v.pan = event.value;
      } else if (event.kind === 'retune') {
        v.kernel.retune(event.rate, event.detune);
      } else if (event.kind === 'release') {
        v.kernel.release();
      } else {
        v.stop = Math.min(v.stop, Math.max(frame, frameOf(event.at)));
      }
    },

    render(left, right, frame) {
      const n = left.length;
      if (scratch.length < n) scratch = new Float32Array(n);
      const ended: number[] = [];
      for (const [id, v] of voices) {
        const from = Math.max(0, v.start - frame);
        const to = Math.min(n, v.stop - frame);
        let alive = true;
        if (from < to) {
          scratch.fill(0, from, to);
          alive = v.kernel.render(scratch, from, to);
          // Equal power, as a StereoPannerNode pans one channel.
          const x = ((Math.min(1, Math.max(-1, v.pan)) + 1) * Math.PI) / 4;
          const gl = Math.cos(x);
          const gr = Math.sin(x);
          for (let i = from; i < to; i += 1) {
            const s = scratch[i] * levelAt(v, frame + i);
            left[i] += s * gl;
            right[i] += s * gr;
          }
        }
        if (!alive || v.stop <= frame + n) {
          voices.delete(id);
          ended.push(id);
        }
      }
      return ended;
    },

    size: () => voices.size,
  };
}
