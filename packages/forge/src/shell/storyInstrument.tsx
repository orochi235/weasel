import type { Instrument } from '@weasel-js/labkit';
import { type ConfigSchema, f } from '@weasel-js/labkit/config';
import { schemaFromDescription } from '../protocol/schema';
import type { IndexEntry } from '../story/types';
import type { AnswerBook } from './answers';
import { FrameView } from './FrameView';
import { type Ready, readyKey } from './readyKey';

export interface StoryInstrumentOptions {
  entry: IndexEntry;
  /** The frame's `ready`, once one arrived; absent, the instrument is provisional. */
  ready?: Ready;
  answers: AnswerBook;
  frameUrl: string;
  onReady: (entry: IndexEntry, ready: Ready) => void;
}

/** A story as a lab instrument. Its frame reads globals from the surrounding `StoryGlobalsContext`. */
export function storyInstrument(options: StoryInstrumentOptions): Instrument<unknown, unknown> {
  const { entry, ready, answers, frameUrl, onReady } = options;
  const config: ConfigSchema<unknown> = ready
    ? schemaFromDescription(ready.schema, answers)
    : (f.schema({}) as ConfigSchema<unknown>);
  const descriptionKey = ready ? readyKey(ready) : null;
  return {
    name: entry.id,
    title: `${entry.title} / ${entry.name}`,
    config,
    defaultConfig: () => config.defaults(),
    initialState: () => null,
    render: (ctx) => (
      <FrameView
        entry={entry}
        frameUrl={frameUrl}
        answers={answers}
        onReady={onReady}
        descriptionKey={descriptionKey}
        ctx={ctx}
      />
    ),
    ...(ready?.viewport ? { stage: { size: { width: ready.viewport.width, height: ready.viewport.height } } } : {}),
  };
}
