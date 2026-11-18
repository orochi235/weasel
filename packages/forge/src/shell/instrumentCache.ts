import type { Instrument, InstrumentList } from '@weasel-js/labkit';
import { sameList } from '@weasel-js/registry';
import type { FrameSetup } from '../frame/FrameController';
import { stableStringify } from '../protocol/messages';
import type { IndexEntry } from '../story/types';
import { type AnswerBook, createAnswerBook } from './answers';
import { documentInstrument, type Loaded, pendingInstrument } from './documentInstrument';
import type { GlobalDeclarations } from './globals';
import type { FrameReady } from './readyKey';
import type { StoryHosts } from './storyHosts';
import { storyInstrument } from './storyInstrument';

/** One entry's instrument, with everything it was built from, so an unchanged entry keeps it. */
interface Built {
  entryKey: string;
  ready: FrameReady | undefined;
  loaded: Loaded | undefined;
  fault: Error | undefined;
  frameUrl: string;
  globals: GlobalDeclarations;
  setup: FrameSetup | undefined;
  inDocument: boolean;
  generation: number;
  revision: number;
  instrument: Instrument<unknown, unknown>;
}

/** Each entry's built instrument and answer book, and the list the lab is handed. */
export interface InstrumentCache {
  built: ReadonlyMap<string, Built>;
  books: ReadonlyMap<string, AnswerBook>;
  list: InstrumentList;
}

export const EMPTY_CACHE: InstrumentCache = { built: new Map(), books: new Map(), list: [] };

/** What is known of each entry so far, by entry id; `generations` is by file. */
export interface EntryStates {
  readies: ReadonlyMap<string, FrameReady>;
  loaded: ReadonlyMap<string, Loaded>;
  faults: ReadonlyMap<string, Error>;
  generations: ReadonlyMap<string, number>;
  revisions: ReadonlyMap<string, number>;
}

/** What every entry's instrument is built with. */
export interface InstrumentInputs {
  frameUrl: string;
  globals: GlobalDeclarations;
  setup: FrameSetup;
  hosts: StoryHosts | undefined;
  /** Given, an entry without `isolate` renders in the workshop document. */
  inDocument: boolean;
  onReady: (entry: IndexEntry, ready: FrameReady) => void;
  request: (entry: IndexEntry) => void;
}

/** `entry`'s instrument as `held` built it if nothing it was built from has changed, otherwise built anew. */
function buildEntry(entry: IndexEntry, held: Built | undefined, answers: AnswerBook, states: EntryStates, inputs: InstrumentInputs): Built {
  const { frameUrl, globals, setup, hosts, onReady, request } = inputs;
  const ready = states.readies.get(entry.id);
  const inDocument = inputs.inDocument && entry.isolate === undefined;
  const had = states.loaded.get(entry.id);
  const fault = states.faults.get(entry.id);
  const generation = states.generations.get(entry.file) ?? 0;
  const revision = states.revisions.get(entry.id) ?? 0;
  const entryKey = stableStringify(entry);
  return held &&
    held.entryKey === entryKey &&
    held.ready === ready &&
    held.loaded === had &&
    held.fault === fault &&
    held.frameUrl === frameUrl &&
    held.globals === globals &&
    held.setup === setup &&
    held.inDocument === inDocument &&
    held.generation === generation &&
    held.revision === revision
    ? held
    : {
        entryKey,
        ready,
        loaded: had,
        fault,
        frameUrl,
        globals,
        setup,
        inDocument,
        generation,
        revision,
        instrument: !inDocument
          ? storyInstrument({ entry, ready, answers, frameUrl, onReady, globals, setup })
          : had
            ? documentInstrument({ entry, loaded: had, setup, globals, ...(hosts ? { hosts } : {}) })
            : pendingInstrument({ entry, globals, load: request, generation, ...(fault ? { fault } : {}) }),
      };
}

/**
 * The cache for `index`, keeping from `previous` each instrument nothing has changed under, each answer book, and
 * the list itself when every instrument in it is the same.
 */
export function buildInstruments(
  previous: InstrumentCache,
  index: readonly IndexEntry[],
  states: EntryStates,
  inputs: InstrumentInputs,
): InstrumentCache {
  const built = new Map<string, Built>();
  const books = new Map<string, AnswerBook>();
  const list = index.map((entry) => {
    const answers = previous.books.get(entry.id) ?? createAnswerBook();
    books.set(entry.id, answers);
    const kept = buildEntry(entry, previous.built.get(entry.id), answers, states, inputs);
    built.set(entry.id, kept);
    return kept.instrument;
  });
  const unchanged = sameList(list, previous.list);
  return { built, books, list: unchanged ? previous.list : list };
}
