import { getOwn } from '@weasel-js/registry';
import {
  checkFilterType, checkNoiseColor, checkWave,
  createCompressorNode, createFileSourceNode, createGainNode, createMixNode, createNoiseNode, createOscillatorNode,
  createPanNode, createDelayNode, createFilterNode, createReverbNode, type GraphNodeDef,
} from '@weasel-js/audio';
import { AUDIO_STAGE_TYPES } from './stageTypes';

/** What a run supplies to its source stages. */
export interface AudioSources { audio?: AudioBuffer }

/** How one stage type becomes a graph node: its settings, its levels, and the node it builds. */
export interface AudioStageNode {
  /** The stage's discrete settings, from its param values and the run's sources. Throws to fail the stage. */
  settings(params: Readonly<Record<string, unknown>>, sources: AudioSources): Readonly<Record<string, unknown>>;
  /** The ids of its numeric params, each a `params` key of the def `build` returns. */
  levels: readonly string[];
  build(ctx: BaseAudioContext, settings: Readonly<Record<string, unknown>>, levels: Readonly<Record<string, number>>): GraphNodeDef;
}
/** The graph node of each stage type, by `type`. */
export type AudioStageNodes = Readonly<Record<string, AudioStageNode>>;

/** The value `type`'s param `id` starts at. */
const defaultOf = (type: string, id: string): unknown =>
  AUDIO_STAGE_TYPES.find((t) => t.type === type)?.params?.find((p) => p.id === id)?.control?.value;

/**
 * A node whose settings are the named param values, each its stage type's default when missing and
 * held to its check, so a value the factory would refuse fails the stage in `settings`. The factory
 * takes the settings with the levels as one options bag.
 */
const node = (
  type: string, settingIds: Readonly<Record<string, ((value: never) => void) | null>>, levels: readonly string[],
  make: (ctx: BaseAudioContext, opts: never) => GraphNodeDef,
): AudioStageNode => ({
  settings: (params) => Object.fromEntries(Object.entries(settingIds).flatMap(([id, check]) => {
    const value = getOwn(params, id) ?? defaultOf(type, id);
    if (value === undefined) return [];
    check?.(value as never);
    return [[id, value]];
  })),
  levels,
  build: (ctx, settings, levels) => make(ctx, { ...settings, ...levels } as never),
});

/** The graph node each stage type builds; `audio.output` has none. */
export const audioStageNodes: AudioStageNodes = {
  'audio.file': {
    settings: (_params, sources) => {
      if (!sources.audio) throw new Error('no source audio');
      return { buffer: sources.audio };
    },
    levels: [],
    build: (ctx, settings) => createFileSourceNode(ctx, { buffer: settings.buffer as AudioBuffer, loop: true }),
  },
  'audio.oscillator': node('audio.oscillator', { wave: checkWave }, ['frequency'], createOscillatorNode),
  'audio.noise': node('audio.noise', { color: checkNoiseColor }, [], createNoiseNode),
  'audio.gain': node('audio.gain', {}, ['gain'], createGainNode),
  'audio.pan': node('audio.pan', {}, ['pan'], createPanNode),
  'audio.filter': node('audio.filter', { type: checkFilterType }, ['frequency', 'Q'], createFilterNode),
  'audio.delay': node('audio.delay', {}, ['time', 'feedback', 'mix'], createDelayNode),
  'audio.reverb': node('audio.reverb', { seconds: null }, ['mix'], createReverbNode),
  'audio.compressor': node('audio.compressor', {}, ['threshold', 'ratio'], createCompressorNode),
  'audio.mix': {
    settings: () => ({}),
    levels: ['a', 'b'],
    build: (ctx, _settings, levels) => {
      const def = createMixNode(ctx, { inputs: ['a', 'b'] });
      for (const id of ['a', 'b'] as const) if (levels[id] !== undefined) def.params[id]!(levels[id], 0);
      return def;
    },
  },
};
