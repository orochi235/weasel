import * as audio from '@weasel-js/audio';
import { createFakeAudioContext } from '@weasel-js/audio/testing/fakeAudioContext';
import { describe, expect, it, vi } from 'vitest';
import { audioStageNodes, type AudioSources } from './nodes';
import { AUDIO_STAGE_TYPES } from './stageTypes';

vi.mock('@weasel-js/audio', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@weasel-js/audio')>();
  return { ...actual, reverbNode: vi.fn(actual.reverbNode) };
});

const setup = () => createFakeAudioContext() as never as BaseAudioContext & ReturnType<typeof createFakeAudioContext>;

const defaults = (type: string): Record<string, unknown> =>
  Object.fromEntries(
    (AUDIO_STAGE_TYPES.find((t) => t.type === type)?.params ?? []).map((p) => [p.id, p.control?.value]),
  );

describe('audio stage types', () => {
  it('names every type audio.* and has a node for each but the output', () => {
    for (const t of AUDIO_STAGE_TYPES) {
      expect(t.type.startsWith('audio.')).toBe(true);
      expect(t.type in audioStageNodes).toBe(t.type !== 'audio.output');
    }
  });

  it('gives every param an id, and every port type audio', () => {
    for (const t of AUDIO_STAGE_TYPES) {
      for (const p of t.params ?? []) expect(p.id).toBeTruthy();
      for (const p of [...(t.inputs ?? []), ...(t.outputs ?? [])]) expect(p.type).toBe('audio');
    }
  });

  it('exposes every level as a param of the def build returns', () => {
    const ctx = setup();
    const sources: AudioSources = { audio: ctx.createBuffer(1, 8, 8000) as never };
    for (const [type, node] of Object.entries(audioStageNodes)) {
      const values = defaults(type);
      const settings = node.settings(values, sources);
      const levels = Object.fromEntries(node.levels.map((id) => [id, values[id] as number]));
      const def = node.build(ctx, settings, levels);
      for (const id of node.levels) expect(Object.keys(def.params), `${type} ${id}`).toContain(id);
    }
  });
});

describe('settings', () => {
  it('keeps the oscillator wave and leaves frequency to its level', () => {
    expect(audioStageNodes['audio.oscillator']!.settings({ wave: 'square', frequency: 220 }, {})).toEqual({ wave: 'square' });
  });

  it('fails a file stage that has no source audio', () => {
    expect(() => audioStageNodes['audio.file']!.settings({}, {})).toThrow(/no source audio/);
  });

  it('returns the file buffer as a setting', () => {
    const buffer = setup().createBuffer(1, 8, 8000) as never as AudioBuffer;
    expect(audioStageNodes['audio.file']!.settings({}, { audio: buffer })).toEqual({ buffer });
  });

  it('keeps reverb seconds as a setting and hands reverbNode seconds and mix', () => {
    const node = audioStageNodes['audio.reverb']!;
    expect(node.settings({ seconds: 3, mix: 0.3 }, {})).toEqual({ seconds: 3 });
    const ctx = setup();
    node.build(ctx, { seconds: 3 }, { mix: 0.3 });
    expect(audio.reverbNode).toHaveBeenCalledWith(ctx, { seconds: 3, mix: 0.3 });
  });
});
