import { renderEngineStereo } from '@weasel-js/audio/testing/renderEngine';
import { rms } from '@weasel-js/audio/testing/spectrum';
import { describe, expect, it } from 'vitest';
import {
  AUDIO_STAGE_TYPES, audioStageNodes, createLiveAudioRunner,
  type AudioStageNodes,
} from '../../effect-audio.entry';
import type { EffectPipeline, EffectStage, EffectWire } from '../types';

const RATE = 48000;

const stage = (id: string, type: string, values: Record<string, unknown> = {}): EffectStage => {
  const t = AUDIO_STAGE_TYPES.find((x) => x.type === type)!;
  const params = (t.params ?? []).map((p) => (p.id !== undefined && p.id in values ? { ...p, control: { ...p.control!, value: values[p.id] } } : p));
  return { id, title: id, type, inputs: t.inputs, outputs: t.outputs, params: params as never };
};
const wire = (from: string, to: string): EffectWire => ({ from: { stage: from, port: 'out' }, to: { stage: to, port: 'in' } });

const pipeline = (gain: number, mix: number): EffectPipeline => ({
  stages: [
    stage('osc', 'audio.oscillator', { frequency: 452 }),
    stage('gain', 'audio.gain', { gain }),
    stage('delay', 'audio.delay', { time: 250, feedback: 0.6, mix }),
    stage('out', 'audio.output'),
  ],
  wires: [wire('osc', 'gain'), wire('gain', 'delay'), wire('delay', 'out')],
});

/** The delay's `mix` is a setting here, so changing it replaces the node, and its tail with it. */
const mixAsSetting: AudioStageNodes = {
  ...audioStageNodes,
  'audio.delay': {
    ...audioStageNodes['audio.delay']!,
    settings: (params) => ({ mix: params.mix }),
    levels: ['time', 'feedback'],
  },
};

async function renderEdit(nodes?: AudioStageNodes): Promise<Float32Array> {
  let runner: ReturnType<typeof createLiveAudioRunner> | undefined;
  const [left] = await renderEngineStereo(1, (engine) => {
    runner = createLiveAudioRunner({ engine, pipeline: pipeline(1, 0.5), ...(nodes ? { nodes } : {}) });
    void runner.play();
  }, RATE, {}, { at: 0.3, run: () => runner!.setPipeline(pipeline(0, 0.8)) });
  runner!.dispose();
  return left;
}

const tail = (x: Float32Array) => rms(x, Math.round(0.5 * RATE), Math.round(0.8 * RATE));

describe('live audio runner in a real engine', () => {
  it("a live edit keeps the delay's tail, and replacing the delay does not", async () => {
    const kept = tail(await renderEdit());
    const replaced = tail(await renderEdit(mixAsSetting));
    expect(kept).toBeGreaterThan(0.01);
    // A fresh delay still echoes the few milliseconds of signal it was fed while the gain ramped to 0.
    expect(replaced).toBeLessThan(kept / 10);
  });
});
