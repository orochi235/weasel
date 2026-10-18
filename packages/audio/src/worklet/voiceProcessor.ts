/**
 * The voice processor's entry point. It runs in an `AudioWorkletGlobalScope`,
 * which cannot import the package, so `scripts/gen-worklet.mjs` bundles this
 * file and what it imports into `voiceProcessor.gen.ts` as source text.
 */
import type { FromProcessor, ToProcessor } from './protocol';
import { VOICE_PROCESSOR } from './protocol';
import { createVoiceMixer } from './voiceMixer';

declare const sampleRate: number;
declare const currentFrame: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void;

class VoiceProcessor extends AudioWorkletProcessor {
  private readonly mixer = createVoiceMixer(sampleRate);
  private disposed = false;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<ToProcessor>) => {
      if (e.data.kind === 'dispose') this.disposed = true;
      this.mixer.receive(e.data, currentFrame);
    };
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    if (this.disposed) return false;
    const [left, right] = outputs[0];
    for (const id of this.mixer.render(left, right ?? new Float32Array(left.length), currentFrame)) {
      this.port.postMessage({ kind: 'ended', id } satisfies FromProcessor);
    }
    return true;
  }
}

// A second engine on the same context loads the module again, and a name can
// be registered once per scope.
try {
  registerProcessor(VOICE_PROCESSOR, VoiceProcessor);
} catch { /* already registered */ }
