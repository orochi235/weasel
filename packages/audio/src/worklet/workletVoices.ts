import type { Booking, LiveVoice, SourceLike, Starter } from '../liveVoice';
import { resolveNote } from '../synthVoice';
import type { NoiseOptions, NoteOptions } from '../types';
import type { VoiceOut } from '../voiceChains';
import { loadVoiceProcessor } from './loadVoiceProcessor';
import { VOICE_PROCESSOR, type FromProcessor, type ToProcessor } from './protocol';

/** Synth voices rendered by the voice processor, one processor per bus. */
export interface WorkletVoices {
  /** True once the processor has loaded into the context. */
  ready(): boolean;
  /** Settles once the processor has loaded, or has failed to. */
  loaded: Promise<void>;
  note(note: NoteOptions): Starter;
  noise(noise: NoiseOptions): Starter;
  dispose(): void;
}

/** What a voice's events are sent to, and the sources waiting on its `ended`. */
interface Bus {
  node: AudioWorkletNode;
  sources: Map<number, WorkletSource>;
}

type WorkletSource = SourceLike & { end(): void };

/** A booked voice as a source: `stop` posts the stop, and the processor's
 *  `ended` is its `onended`, however early that comes. */
function workletSource(post: (event: ToProcessor) => void, id: number): WorkletSource {
  let onended: SourceLike['onended'] = null;
  let ended = false;
  const fire = (): void => { (onended as (() => void) | null)?.(); };
  return {
    get onended() { return onended; },
    set onended(fn) {
      onended = fn;
      if (ended) queueMicrotask(fire);
    },
    stop(when?: number) { post({ kind: 'stop', id, at: when ?? 0 }); },
    disconnect() {},
    end() {
      if (ended) return;
      ended = true;
      fire();
    },
  };
}

/** The voice's level and pan, sent to the processor rather than set on a node. */
function workletOut(ctx: BaseAudioContext, post: (event: ToProcessor) => void, id: number): VoiceOut {
  return {
    input: null,
    level(value, rampMs) {
      post({ kind: 'level', id, value, end: rampMs && rampMs > 0 ? ctx.currentTime + rampMs / 1000 : 0 });
    },
    pan(value) { post({ kind: 'pan', id, value }); },
    free() {},
    abandon() {},
  };
}

export function createWorkletVoices(
  ctx: BaseAudioContext,
  busInput: (bus: string) => AudioNode,
  random: () => number,
): WorkletVoices {
  let ready = false;
  const loaded = loadVoiceProcessor(ctx).then(
    () => { ready = true; },
    (err: unknown) => {
      console.warn(`@weasel-js/audio: the voice worklet did not load, so synth voices stay on nodes — ${String(err)}`);
    },
  );
  const buses = new Map<string, Bus>();

  const busFor = (name: string): Bus => {
    let bus = buses.get(name);
    if (!bus) {
      const node = new AudioWorkletNode(ctx, VOICE_PROCESSOR, {
        numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
      });
      const sources = new Map<number, WorkletSource>();
      node.port.onmessage = (e: MessageEvent<FromProcessor>) => {
        const source = sources.get(e.data.id);
        sources.delete(e.data.id);
        source?.end();
      };
      node.connect(busInput(name));
      bus = { node, sources };
      buses.set(name, bus);
    }
    return bus;
  };

  /** A starter that posts the voice when it is played and hands over its
   *  source when the scheduler fires. */
  const starter = (
    event: (voice: LiveVoice, at: number, level: number, pan: number) => ToProcessor,
  ): Starter => {
    let source: WorkletSource | null = null;
    let post: (e: ToProcessor) => void = () => {};
    return {
      ready: () => true,
      book(voice, at): Booking {
        const bus = busFor(at.bus);
        post = (e) => { bus.node.port.postMessage(e); };
        post(event(voice, at.when / 1000, at.level, at.pan));
        source = workletSource(post, voice.id);
        bus.sources.set(voice.id, source);
        voice.retune = () => { post({ kind: 'retune', id: voice.id, rate: voice.rate, detune: voice.detune }); };
        return {
          out: workletOut(ctx, post, voice.id),
          cancel: () => { post({ kind: 'stop', id: voice.id, at: 0 }); },
        };
      },
      start(voice) {
        voice.release = () => { post({ kind: 'release', id: voice.id }); };
        return source!;
      },
    };
  };

  return {
    ready: () => ready,
    loaded,
    note(note) {
      resolveNote(note);
      const patch = {
        pitch: note.pitch, wave: note.wave, envelope: note.envelope, glide: note.glide,
        filter: note.filter, duration: note.duration,
      };
      return starter((voice, at, level, pan) => ({
        kind: 'note', id: voice.id, at, level, pan, rate: voice.rate, detune: voice.detune, patch,
      }));
    },
    noise(noise) {
      const patch = { noise: noise.noise, envelope: noise.envelope, filter: noise.filter, duration: noise.duration };
      return starter((voice, at, level, pan) => ({
        kind: 'noise', id: voice.id, at, level, pan, rate: voice.rate, detune: voice.detune, patch,
        // A random point in the loop, so two hits in a row are not the same hit.
        seed: random(),
      }));
    },
    dispose() {
      for (const bus of buses.values()) {
        bus.node.port.postMessage({ kind: 'dispose' } satisfies ToProcessor);
        bus.node.port.onmessage = null;
        bus.node.disconnect();
      }
      buses.clear();
    },
  };
}
