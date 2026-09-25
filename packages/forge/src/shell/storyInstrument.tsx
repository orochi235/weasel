import { breadcrumb } from './breadcrumb';
import type { AnnotationsCapability, Instrument } from '@weasel-js/labkit';
import { type ConfigSchema, f } from '@weasel-js/labkit/config';
import { schemaFromDescription } from '../protocol/schema';
import type { IndexEntry } from '../story/types';
import type { AnswerBook } from './answers';
import { FrameView } from './FrameView';
import { type GlobalDeclarations, withGlobals } from './globals';
import { type Ready, readyKey } from './readyKey';
import type { TrialFrames } from './trialFrames';

export interface StoryInstrumentOptions {
  entry: IndexEntry;
  /** The frame's `ready`, once one arrived; absent, the instrument is provisional. */
  ready?: Ready;
  answers: AnswerBook;
  frameUrl: string;
  onReady: (entry: IndexEntry, ready: Ready) => void;
  /** Declared globals, which the schema gains as a `$globals` group of per-trial pins. */
  globals?: GlobalDeclarations;
  /** The workshop's frame registry. Without it the instrument takes no marks: an annotation target's
   *  picture is the frame's to draw, and its box is the frame's to measure. */
  frames?: TrialFrames;
}

/** The story itself, as the one region of the trial that takes marks. */
function annotationsOn(frames: TrialFrames): AnnotationsCapability<unknown, unknown> {
  return {
    targets: (_state, _config, trial) => {
      const ref = frames.hostRef(trial.id);
      const frame = frames.get(trial.id);
      const box = frame.size ?? { width: ref.current?.clientWidth ?? 0, height: ref.current?.clientHeight ?? 0 };
      const capture = frame.capture;
      return [
        {
          id: 'story',
          ref,
          content: { w: Math.max(1, box.width), h: Math.max(1, box.height) },
          ...(capture ? { base: () => capture() } : {}),
        },
      ];
    },
  };
}

/** A story as a lab instrument. Its frame reads the lab's globals from the surrounding `StoryGlobalsContext`. */
export function storyInstrument(options: StoryInstrumentOptions): Instrument<unknown, unknown> {
  const { entry, ready, answers, frameUrl, onReady, globals = {}, frames } = options;
  const config = withGlobals(
    ready ? schemaFromDescription(ready.schema, answers) : (f.schema({}) as ConfigSchema<unknown>),
    globals,
  );
  const descriptionKey = ready ? readyKey(ready) : null;
  return {
    name: entry.id,
    title: breadcrumb(entry.title, entry.name),
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
    ...(frames ? { annotations: annotationsOn(frames) } : {}),
    ...(ready?.viewport ? { stage: { size: { width: ready.viewport.width, height: ready.viewport.height } } } : {}),
  };
}
