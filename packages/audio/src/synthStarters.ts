import { resolveEnvelope, type Envelope } from './envelope';
import { sourceGroup, type LiveVoice, type SourceLike, type Starter } from './liveVoice';
import {
  envelopeOnParam, noiseBuffer, resolveNote, voiceFilter, type ResolvedNote,
} from './synthVoice';
import type { Inharmonic, NoiseOptions, NoteOptions, VoiceFilter, Waveform } from './types';

/** How `playNote` and `playNoise` make their nodes. */
export interface SynthStarters {
  /** Throws on a bad pitch or partial, at the call rather than when it comes due. */
  note(note: NoteOptions): Starter;
  noise(noise: NoiseOptions): Starter;
}

/**
 * What every synth voice shares once its sources exist: sources → optional
 * filter → envelope gain → the voice's chain, the envelopes on both, the stop
 * at the end of the release, and the note-off. `make` builds and starts the
 * sources at `t0`, connected into the node it is handed.
 */
function synthStart(
  ctx: BaseAudioContext,
  voice: LiveVoice,
  whenMs: number,
  patch: { envelope?: Envelope; filter?: VoiceFilter; duration?: number },
  make: (t0: number, into: AudioNode) => { nodes: AudioScheduledSourceNode[]; retune: () => void },
): SourceLike {
  const t0 = whenMs / 1000;
  const env = resolveEnvelope(patch.envelope);
  const gate = patch.duration;
  // Its own gain, not the chain's: `setGain` and a fade cancel whatever is
  // scheduled on the chain's gain, and would take the envelope with it.
  const shaper = ctx.createGain();
  const amp = envelopeOnParam(shaper.gain, env, gate, t0, (v) => v);
  const filter = patch.filter ? voiceFilter(ctx, patch.filter, gate, t0) : null;
  filter?.node.connect(shaper);
  shaper.connect(voice.out!.input!);
  voice.env = shaper;

  const { nodes, retune } = make(t0, filter?.node ?? shaper);
  voice.retune = retune;
  retune();
  const stopAll = (at: number): void => { for (const n of nodes) n.stop(at); };
  voice.release = () => {
    const at = ctx.currentTime;
    // Already past its gate: the release is running and the stop is booked.
    if (gate !== undefined && at * 1000 - whenMs >= gate) return;
    amp.release(at);
    filter?.release(at);
    stopAll(at + env.release / 1000);
  };
  if (gate !== undefined) stopAll(t0 + (gate + env.release) / 1000);
  return nodes.length === 1 ? nodes[0] : sourceGroup(nodes);
}

/** A note's oscillators, started at `t0` into `into`: one with the note's
 *  wave, or one sine per partial of an inharmonic wave. */
function noteOscillators(
  ctx: BaseAudioContext,
  note: NoteOptions,
  { from, glideTo, partials }: ResolvedNote,
  applyWave: (osc: OscillatorNode, wave: Exclude<Waveform, Inharmonic>) => void,
  t0: number,
  into: AudioNode,
): OscillatorNode[] {
  const wave = note.wave ?? 'sine';
  const tone = (ratio: number): OscillatorNode => {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(from * ratio, t0);
    if (glideTo !== undefined) {
      const end = t0 + (note.glide!.ms ?? note.duration ?? 100) / 1000;
      if (note.glide!.curve === 'linear') osc.frequency.linearRampToValueAtTime(glideTo * ratio, end);
      else osc.frequency.exponentialRampToValueAtTime(glideTo * ratio, end);
    }
    return osc;
  };
  let oscs: OscillatorNode[];
  if (partials) {
    // Sines summed by hand: a PeriodicWave can only hold whole-number partials.
    oscs = partials.map((p) => {
      const osc = tone(p.ratio);
      const level = ctx.createGain();
      level.gain.setValueAtTime(p.gain, t0);
      if (p.decay !== undefined) level.gain.setTargetAtTime(0, t0, p.decay / 1000);
      osc.connect(level);
      level.connect(into);
      return osc;
    });
  } else {
    const osc = tone(1);
    applyWave(osc, wave as Exclude<Waveform, Inharmonic>);
    osc.connect(into);
    oscs = [osc];
  }
  for (const osc of oscs) osc.start(t0);
  return oscs;
}

export function createSynthStarters(ctx: BaseAudioContext, random: () => number): SynthStarters {
  const waves = new Map<string, PeriodicWave>();
  const applyWave = (osc: OscillatorNode, wave: Exclude<Waveform, Inharmonic>): void => {
    if (typeof wave === 'string') {
      osc.type = wave;
      return;
    }
    const key = wave.join(',');
    let periodic = waves.get(key);
    if (!periodic) {
      // Sine terms only: partial k sits at imag[k], and index 0 is the DC term.
      const imag = new Float32Array(wave.length + 1);
      imag.set(wave, 1);
      periodic = ctx.createPeriodicWave(new Float32Array(wave.length + 1), imag);
      waves.set(key, periodic);
    }
    osc.setPeriodicWave(periodic);
  };

  return {
    note(note) {
      const resolved = resolveNote(note);
      return {
        ready: () => true,
        start: (voice, whenMs) => synthStart(ctx, voice, whenMs, note, (t0, into) => {
          const oscs = noteOscillators(ctx, note, resolved, applyWave, t0, into);
          return {
            nodes: oscs,
            retune: () => {
              for (const osc of oscs) osc.detune.value = voice.detune + 1200 * Math.log2(voice.rate);
            },
          };
        }),
      };
    },

    noise(noise) {
      return {
        ready: () => true,
        start: (voice, whenMs) => synthStart(ctx, voice, whenMs, noise, (t0, into) => {
          const source = ctx.createBufferSource();
          source.buffer = noiseBuffer(ctx, noise.noise);
          source.loop = true;
          source.connect(into);
          // A random point in the loop, so two hits in a row are not the same hit.
          source.start(t0, random() * source.buffer.duration);
          return {
            nodes: [source],
            retune: () => {
              source.playbackRate.value = voice.rate;
              source.detune.value = voice.detune;
            },
          };
        }),
      };
    },
  };
}
