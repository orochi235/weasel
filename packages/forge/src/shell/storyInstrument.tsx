import type { Instrument } from '@weasel-js/labkit';
import { type ConfigSchema, f } from '@weasel-js/labkit/config';
import type { FromFrame, Globals } from '../protocol/messages';
import { schemaFromDescription } from '../protocol/schema';
import type { IndexEntry } from '../story/types';
import type { AnswerBook } from './answers';
import { FrameView } from './FrameView';

export interface StoryInstrumentOptions {
  entry: IndexEntry;
  /** The frame's `ready`, once one arrived; absent, the instrument is provisional. */
  ready?: Extract<FromFrame, { type: 'ready' }>;
  answers: AnswerBook;
  frameUrl: string;
  onReady: (entry: IndexEntry, ready: Extract<FromFrame, { type: 'ready' }>) => void;
  globals: Globals;
}

export function storyInstrument(options: StoryInstrumentOptions): Instrument<unknown, unknown> {
  const { entry, ready, answers, frameUrl, onReady, globals } = options;
  const config: ConfigSchema<unknown> = ready
    ? schemaFromDescription(ready.schema, answers)
    : (f.schema({}) as ConfigSchema<unknown>);
  return {
    name: entry.id,
    config,
    defaultConfig: () => config.defaults(),
    initialState: () => null,
    render: (ctx) => (
      <FrameView entry={entry} frameUrl={frameUrl} answers={answers} onReady={onReady} globals={globals} ctx={ctx} />
    ),
    ...(ready?.viewport ? { stage: { size: { width: ready.viewport.width, height: ready.viewport.height } } } : {}),
  };
}
