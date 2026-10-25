import { crumbTitle } from './Crumbs';
import type { Instrument } from '@weasel-js/labkit';
import { type ConfigSchema, f } from '@weasel-js/labkit/config';
import type { FrameSetup } from '../frame/FrameController';
import { schemaFromDescription } from '../protocol/schema';
import type { IndexEntry } from '../story/types';
import type { AnswerBook } from './answers';
import { FrameView } from './FrameView';
import { CaptureInputs } from './loupe/CaptureInputs';
import { type GlobalDeclarations, withGlobals } from './globals';
import { type Ready, readyKey } from './readyKey';

export interface StoryInstrumentOptions {
  entry: IndexEntry;
  /** The frame's `ready`, once one arrived; absent, the instrument is provisional. */
  ready?: Ready;
  answers: AnswerBook;
  frameUrl: string;
  onReady: (entry: IndexEntry, ready: Ready) => void;
  /** Declared globals, which the schema gains as a `$globals` group of per-trial pins. */
  globals?: GlobalDeclarations;
  /** The workshop's frame setup, which applies the globals to a lens copy's host. */
  setup?: FrameSetup;
}

/** A story as a lab instrument. Its frame reads the lab's globals from the surrounding `StoryGlobalsContext`. */
export function storyInstrument(options: StoryInstrumentOptions): Instrument<unknown, unknown> {
  const { entry, ready, answers, frameUrl, onReady, globals = {}, setup } = options;
  const config = withGlobals(
    ready ? schemaFromDescription(ready.schema, answers) : (f.schema({}) as ConfigSchema<unknown>),
    globals,
  );
  const descriptionKey = ready ? readyKey(ready) : null;
  const viewport = ready ? ready.viewport : entry.viewport;
  return {
    name: entry.id,
    ...crumbTitle(entry),
    config,
    defaultConfig: () => config.defaults(),
    initialState: () => null,
    render: (ctx) => (
      <>
        <FrameView
          entry={entry}
          frameUrl={frameUrl}
          answers={answers}
          onReady={onReady}
          descriptionKey={descriptionKey}
          ctx={ctx}
          {...(setup ? { setup } : {})}
        />
        <CaptureInputs entry={entry} layout={ready?.layout ?? 'centered'} config={ctx.config} state={ctx.state} />
      </>
    ),
    // Taken from the index until the frame reports, so the trial does not move the frame into a stage and reload it.
    ...(viewport ? { stage: { size: { width: viewport.width, height: viewport.height } } } : {}),
  };
}
