import type { Envelope } from './envelope';
import type { VoiceFilter, Waveform } from './types';

const fail = (message: string): never => {
  throw new RangeError(`@weasel-js/audio: ${message}`);
};

const finite = (what: string, value: number | undefined): void => {
  if (value !== undefined && !Number.isFinite(value)) fail(`a ${what} is finite, not ${value}`);
};

const WAVE_NAMES = new Set<string>(['sine', 'square', 'sawtooth', 'triangle']);

/** Throws on a named wave neither voice path could play. Harmonic levels and
 *  inharmonic partials are checked apart. */
export function checkWave(wave: Waveform): void {
  if (typeof wave === 'string' && !WAVE_NAMES.has(wave)) {
    fail(`"${wave}" is not a wave: one of sine, square, sawtooth, triangle`);
  }
}

export function checkEnvelope(what: string, env: Envelope | undefined): void {
  if (!env) return;
  finite(`${what} attack`, env.attack);
  finite(`${what} decay`, env.decay);
  finite(`${what} sustain`, env.sustain);
  finite(`${what} release`, env.release);
}

function checkFilter(filter: VoiceFilter | undefined): void {
  if (!filter) return;
  if (!Number.isFinite(filter.frequency)) fail(`a voice filter's frequency is finite, not ${filter.frequency}`);
  finite("voice filter's Q", filter.Q);
  finite("voice filter's gain", filter.gain);
  finite("voice filter's amount", filter.amount);
  checkEnvelope("voice filter's", filter.envelope);
}

/** Throws on what a synth voice's envelope, filter, and gate would read as `NaN` or never end on. */
export function checkShaping(patch: { envelope?: Envelope; filter?: VoiceFilter; duration?: number }): void {
  checkEnvelope('voice envelope', patch.envelope);
  checkFilter(patch.filter);
  const { duration } = patch;
  if (duration !== undefined && !(duration >= 0 && Number.isFinite(duration))) {
    fail(`a voice's duration is a finite number of ms, 0 or more, not ${duration}; omit it to hold the voice`);
  }
}

/** Throws on a glide time that is not a finite number of ms. */
export function checkGlideMs(ms: number | undefined): void {
  if (ms !== undefined && !(ms >= 0 && Number.isFinite(ms))) {
    fail(`a glide takes a finite number of ms, 0 or more, not ${ms}`);
  }
}
