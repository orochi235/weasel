import {
  compressorNode, createFileSourceNode, createGainNode, createMixNode, createNoiseNode, createOscillatorNode,
  createPanNode, delayNode, filterNode, reverbNode, type GraphNodeDef,
} from '@weasel-js/audio';

/** What a run supplies to its source stages. */
export interface AudioSources { audio?: AudioBuffer }

type Values = Readonly<Record<string, unknown>>;

/** How one stage type becomes a graph node: its settings, its levels, and the node it builds. */
export interface AudioStageNode {
  /** The stage's discrete settings, from its param values and the run's sources. Throws to fail the stage. */
  settings(params: Values, sources: AudioSources): Values;
  /** The ids of its numeric params, each a `params` key of the def `build` returns. */
  levels: readonly string[];
  build(ctx: BaseAudioContext, settings: Values, levels: Readonly<Record<string, number>>): GraphNodeDef;
}
/** The graph node of each stage type, by `type`. */
export type AudioStageNodes = Readonly<Record<string, AudioStageNode>>;

/** A node whose settings are the named param values; the factory takes them with the levels as one options bag. */
const node = (
  settingIds: readonly string[], levels: readonly string[],
  make: (ctx: BaseAudioContext, opts: never) => GraphNodeDef,
): AudioStageNode => ({
  settings: (params) => Object.fromEntries(settingIds.filter((id) => params[id] !== undefined).map((id) => [id, params[id]])),
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
  'audio.oscillator': node(['wave'], ['frequency'], createOscillatorNode),
  'audio.noise': node(['color'], [], createNoiseNode),
  'audio.gain': node([], ['gain'], createGainNode),
  'audio.pan': node([], ['pan'], createPanNode),
  'audio.filter': node(['type'], ['frequency', 'Q'], filterNode),
  'audio.delay': node([], ['time', 'feedback', 'mix'], delayNode),
  'audio.reverb': node(['seconds'], ['mix'], reverbNode),
  'audio.compressor': node([], ['threshold', 'ratio'], compressorNode),
  'audio.mix': {
    settings: () => ({}),
    levels: ['a', 'b'],
    build: (ctx, _settings, levels) => {
      const def = createMixNode(ctx, { inputs: ['a', 'b'] });
      for (const id of ['a', 'b']) if (levels[id] !== undefined) def.params[id]!(levels[id], 0);
      return def;
    },
  },
};
