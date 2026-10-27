import type { Instrument } from '@weasel-js/labkit';
import { type ConfigSchema, f } from '@weasel-js/labkit/config';
import { useEffect } from 'react';
import type { FrameSetup } from '../frame/FrameController';
import type { IndexEntry } from '../story/types';
import { TrialTransport } from '../timeline/TransportBar';
import { crumbTitle } from './Crumbs';
import { type GlobalDeclarations, PLAYHEAD_KEY, withGlobals } from './globals';
import { IndexTrial } from './IndexTrial';
import type { Loaded } from '../story/indexBundle';
import { CaptureInputs } from './loupe/CaptureInputs';
import type { StoryHosts } from './storyHosts';
import { storyMarks } from './storyMarks';
import { StoryTrial } from './StoryTrial';

export type { Loaded };

export interface DocumentInstrumentOptions {
  entry: IndexEntry;
  loaded: Loaded;
  setup: FrameSetup;
  globals?: GlobalDeclarations;
  /** The workshop's story hosts. Without them the instrument takes no marks. */
  hosts?: StoryHosts;
}

/** `schema` with a hidden leaf for the paused playhead, which labkit then persists and snapshots with the trial. */
function withPlayhead(schema: ConfigSchema<unknown>): ConfigSchema<unknown> {
  return f.schema({ ...schema.nodes, [PLAYHEAD_KEY]: f.custom<number | null>('forge-playhead', null).hidden() }) as ConfigSchema<unknown>;
}

/** A loaded story, or index page, as a lab instrument rendering in the workshop document. */
export function documentInstrument(options: DocumentInstrumentOptions): Instrument<unknown, unknown> {
  const { entry, loaded, setup, globals = {}, hosts } = options;
  const schema = loaded.kind === 'story' ? loaded.story.config : (f.schema({}) as ConfigSchema<unknown>);
  const timed = loaded.kind === 'story' && loaded.story.timeline !== null;
  const config = withGlobals(timed ? withPlayhead(schema) : schema, globals);
  const initialState = loaded.kind === 'story' ? loaded.story.initialState : null;
  return {
    name: entry.id,
    ...crumbTitle(entry),
    config,
    defaultConfig: () => config.defaults(),
    initialState: (c) => initialState?.(c) ?? null,
    render: (ctx) => (
      <>
        {loaded.kind === 'story' ? (
          <StoryTrial key={loaded.story.id} story={loaded.story} setup={setup} ctx={ctx} />
        ) : (
          <IndexTrial bundle={loaded.bundle} setup={setup} config={ctx.config} />
        )}
        <CaptureInputs
          entry={entry}
          layout={loaded.kind === 'story' ? loaded.story.layout : 'fullscreen'}
          config={ctx.config}
          state={ctx.state}
        />
      </>
    ),
    ...(hosts ? { annotations: storyMarks(hosts) } : {}),
    ...(loaded.kind === 'story' && loaded.story.viewport
      ? { stage: { size: { width: loaded.story.viewport.width, height: loaded.story.viewport.height } } }
      : {}),
    ...(timed
      ? { chrome: [{ id: 'fg-transport', region: 'status', render: (c) => <TrialTransport trialId={c.trialId} /> }] }
      : {}),
  };
}

export interface PendingInstrumentOptions {
  entry: IndexEntry;
  globals?: GlobalDeclarations;
  /** Asked for the entry's module the first time a trial renders it. */
  load: (entry: IndexEntry) => void;
  /** Why the module could not load, when it could not. */
  fault?: Error;
  /** Bumped by a reload, so a face already mounted asks again. */
  generation?: number;
}

/** Why a trial has no story to show, drawn over its whole stage. */
function Fault({ phase, message }: { phase: string; message: string }) {
  return (
    <div className="fg-fault" role="alert">
      <span className="fg-fault__phase">{phase}</span>
      <p className="fg-fault__message">{message}</p>
    </div>
  );
}

/** The instrument's face while its module loads, and the fault when the load fails. */
function StoryLoad({ entry, load, fault }: PendingInstrumentOptions) {
  useEffect(() => {
    if (!fault) load(entry);
  }, [entry, load, fault]);
  return (
    <div className="fg-story fg-story--loading" data-fg-layout="fullscreen">
      {fault ? <Fault phase="import" message={fault.message} /> : null}
    </div>
  );
}

/** An entry's instrument before its module has loaded: an empty schema, and a render that asks for the load. */
export function pendingInstrument(options: PendingInstrumentOptions): Instrument<unknown, unknown> {
  const { entry, globals = {} } = options;
  const config = withGlobals(f.schema({}) as ConfigSchema<unknown>, globals);
  return {
    name: entry.id,
    ...crumbTitle(entry),
    config,
    defaultConfig: () => config.defaults(),
    initialState: () => null,
    render: () => <StoryLoad key={options.generation ?? 0} {...options} />,
  };
}

/** The instrument a trial runs when the URL names `id` and no story has it, so the stage says so. */
export function missingInstrument(id: string, globals: GlobalDeclarations = {}): Instrument<unknown, unknown> {
  const config = withGlobals(f.schema({}) as ConfigSchema<unknown>, globals);
  return {
    name: id,
    title: `No story ${id}`,
    config,
    defaultConfig: () => config.defaults(),
    initialState: () => null,
    render: () => (
      <div className="fg-story fg-story--loading" data-fg-layout="fullscreen">
        <Fault phase="route" message={`No story ${id}`} />
      </div>
    ),
  };
}
