import type { Instrument, InstrumentList } from '@weasel-js/labkit';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FrameSetup } from '../frame/FrameController';
import type { FrameImporters } from '../frame/mountFrame';
import { stableStringify } from '../protocol/messages';
import { indexId, isIndexId } from '../story/indexPages';
import { indexRenderOf, loadStories } from '../story/load';
import type { IndexEntry, LoadedStory } from '../story/types';
import { type AnswerBook, createAnswerBook } from './answers';
import { documentInstrument, type Loaded, pendingInstrument } from './documentInstrument';
import type { GlobalDeclarations } from './globals';
import { type Ready, readyKey } from './readyKey';
import { storyInstrument } from './storyInstrument';
import type { TrialFrames } from './trialFrames';

export interface StoryRegistry {
  instruments: InstrumentList;
  /** Whether a story's schema is known: its module has loaded, or its frame has reported. An instrument is built
   *  either way, and before that its schema is empty — which reads as "no args" to anything that cannot tell the
   *  two apart. */
  isReady: (id: string) => boolean;
  /** Called by FrameView. Replaces the story's instrument only when `ready.schema`, layout or viewport differ from what it holds. */
  onReady: (entry: IndexEntry, ready: Ready) => void;
  /** Drops what was loaded from `file` and loads it again for every entry that had it, as after an edit. */
  reload: (file: string) => void;
}

export interface StoryRegistryOptions {
  frameUrl: string;
  globals?: GlobalDeclarations;
  frames?: TrialFrames;
  /** Story modules by file. Given, every entry without `isolate` renders in the workshop document; absent, every
   *  entry renders in a frame. */
  importers?: FrameImporters;
  /** The frame config, applied to each story host in the document. */
  setup?: FrameSetup;
  load?: (mod: Record<string, unknown>, autoTitle: string, parameters?: Record<string, unknown>) => LoadedStory[];
}

interface Built {
  entryKey: string;
  ready: Ready | undefined;
  loaded: Loaded | undefined;
  fault: Error | undefined;
  frameUrl: string;
  globals: GlobalDeclarations;
  frames: TrialFrames | undefined;
  setup: FrameSetup | undefined;
  inDocument: boolean;
  generation: number;
  revision: number;
  instrument: Instrument<unknown, unknown>;
}

interface Cache {
  built: ReadonlyMap<string, Built>;
  books: ReadonlyMap<string, AnswerBook>;
  list: InstrumentList;
}

const NO_GLOBALS: GlobalDeclarations = {};
const NO_SETUP: FrameSetup = {};

const pruned = <V>(map: ReadonlyMap<string, V>, ids: Set<string>): ReadonlyMap<string, V> =>
  [...map.keys()].every((id) => ids.has(id)) ? map : new Map([...map].filter(([id]) => ids.has(id)));

const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

/**
 * One instrument per story in `index`, each schema holding a `$globals` group for `globals`. The lab's global values
 * reach the stories through `StoryGlobalsContext`, not through here.
 */
export function useStoryRegistry(index: readonly IndexEntry[], options: StoryRegistryOptions): StoryRegistry {
  const { frameUrl, globals = NO_GLOBALS, frames, importers, setup = NO_SETUP, load = loadStories } = options;
  const [readies, setReadies] = useState<ReadonlyMap<string, Ready>>(() => new Map());
  const [loaded, setLoaded] = useState<ReadonlyMap<string, Loaded>>(() => new Map());
  const [faults, setFaults] = useState<ReadonlyMap<string, Error>>(() => new Map());
  // Per file, how many reloads it has had: a pending face keyed by it asks again after one.
  const [generations, setGenerations] = useState<ReadonlyMap<string, number>>(() => new Map());
  // Bumped when a story's frame answers something new. labkit's panel re-reads the answer book only when
  // the trial's config changes, and replacing the instrument is what refills it.
  const [revisions, setRevisions] = useState<ReadonlyMap<string, number>>(() => new Map());

  const onReady = useCallback((entry: IndexEntry, ready: Ready) => {
    setReadies((prev) => {
      const held = prev.get(entry.id);
      if (held && readyKey(held) === readyKey(ready)) return prev;
      return new Map(prev).set(entry.id, ready);
    });
  }, []);

  useEffect(() => {
    const ids = new Set(index.map((entry) => entry.id));
    setReadies((prev) => pruned(prev, ids));
    setLoaded((prev) => pruned(prev, ids));
    setFaults((prev) => pruned(prev, ids));
    setRevisions((prev) => pruned(prev, ids));
  }, [index]);

  // One import per file, shared by every entry it holds; a reload drops the file's promise and asks again.
  const imports = useRef(new Map<string, Promise<Record<string, unknown>>>());
  const live = useRef({ index, importers, setup, load });
  live.current = { index, importers, setup, load };

  const importOf = useCallback((file: string): Promise<Record<string, unknown>> => {
    let loading = imports.current.get(file);
    if (!loading) {
      const importer = live.current.importers?.[file];
      loading = importer ? importer() : Promise.reject(new Error(`No importer for ${file}`));
      imports.current.set(file, loading);
    }
    return loading;
  }, []);

  const request = useCallback(
    (entry: IndexEntry): void => {
      const { setup: current, load: loadModule } = live.current;
      const settle = (ids: string[], result: Map<string, Loaded>) => {
        setLoaded((prev) => {
          const next = new Map(prev);
          for (const [id, value] of result) next.set(id, value);
          return next;
        });
        setFaults((prev) => (ids.some((id) => prev.has(id)) ? pruned(prev, new Set([...prev.keys()].filter((id) => !ids.includes(id)))) : prev));
      };
      const fail = (ids: string[], error: unknown) => {
        const fault = toError(error);
        setFaults((prev) => {
          const next = new Map(prev);
          for (const id of ids) next.set(id, fault);
          return next;
        });
      };
      if (isIndexId(entry.id)) {
        const entries = live.current.index.filter((e) => !isIndexId(e.id) && indexId(e.title) === entry.id);
        const files = [...new Set(entries.map((e) => e.file))];
        void Promise.all(files.map(importOf))
          .then(async (mods) => {
            const byFile = new Map(files.map((file, i) => [file, loadModule(mods[i] ?? {}, entry.title, current.parameters)]));
            const stories = entries.flatMap(
              (e) => byFile.get(e.file)?.find((s) => s.exportName === e.exportName) ?? [],
            );
            for (const story of stories) await current.prepare?.(story);
            const result = new Map<string, Loaded>();
            result.set(entry.id, {
              kind: 'index',
              bundle: {
                title: entry.title,
                ...(entry.componentDescription === undefined ? {} : { description: entry.componentDescription }),
                stories,
                descriptions: Object.fromEntries(entries.flatMap((e) => (e.description ? [[e.id, e.description]] : []))),
                render: mods.map(indexRenderOf).find((render) => render !== null) ?? null,
              },
            });
            settle([entry.id], result);
          })
          .catch((error: unknown) => fail([entry.id], error));
        return;
      }
      const siblings = live.current.index.filter((e) => e.file === entry.file && !isIndexId(e.id));
      const ids = siblings.map((e) => e.id);
      void importOf(entry.file)
        .then(async (mod) => {
          const stories = loadModule(mod, entry.title, current.parameters);
          const result = new Map<string, Loaded>();
          for (const sibling of siblings) {
            const story = stories.find((s) => s.exportName === sibling.exportName);
            if (!story) continue;
            await current.prepare?.(story);
            result.set(sibling.id, { kind: 'story', story });
          }
          if (!result.has(entry.id)) throw new Error(`${entry.file} has no story export "${entry.exportName}"`);
          settle(ids, result);
        })
        .catch((error: unknown) => fail(ids, error));
    },
    [importOf],
  );

  const reload = useCallback(
    (file: string) => {
      imports.current.delete(file);
      const affected = live.current.index.filter((e) => e.file === file || (isIndexId(e.id) && live.current.index.some((s) => s.file === file && indexId(s.title) === e.id)));
      const ids = new Set(affected.map((e) => e.id));
      setLoaded((prev) => pruned(prev, new Set([...prev.keys()].filter((id) => !ids.has(id)))));
      setFaults((prev) => pruned(prev, new Set([...prev.keys()].filter((id) => !ids.has(id)))));
      setGenerations((prev) => new Map(prev).set(file, (prev.get(file) ?? 0) + 1));
    },
    [],
  );

  const committed = useRef<Cache>({ built: new Map(), books: new Map(), list: [] });

  const cache = useMemo<Cache>(() => {
    const previous = committed.current;
    const built = new Map<string, Built>();
    const books = new Map<string, AnswerBook>();
    const list = index.map((entry) => {
      const ready = readies.get(entry.id);
      const inDocument = importers !== undefined && entry.isolate === undefined;
      const had = loaded.get(entry.id);
      const fault = faults.get(entry.id);
      const generation = generations.get(entry.file) ?? 0;
      const revision = revisions.get(entry.id) ?? 0;
      const entryKey = stableStringify(entry);
      const answers = previous.books.get(entry.id) ?? createAnswerBook();
      books.set(entry.id, answers);
      const held = previous.built.get(entry.id);
      const kept =
        held &&
        held.entryKey === entryKey &&
        held.ready === ready &&
        held.loaded === had &&
        held.fault === fault &&
        held.frameUrl === frameUrl &&
        held.globals === globals &&
        held.frames === frames &&
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
              frames,
              setup,
              inDocument,
              generation,
              revision,
              instrument: !inDocument
                ? storyInstrument({ entry, ready, answers, frameUrl, onReady, globals, ...(frames ? { frames } : {}) })
                : had
                  ? documentInstrument({ entry, loaded: had, setup, globals, ...(frames ? { frames } : {}) })
                  : pendingInstrument({ entry, globals, load: request, generation, ...(fault ? { fault } : {}) }),
            };
      built.set(entry.id, kept);
      return kept.instrument;
    });
    const unchanged = list.length === previous.list.length && list.every((i, n) => i === previous.list[n]);
    return { built, books, list: unchanged ? previous.list : list };
  }, [index, readies, loaded, faults, generations, revisions, frameUrl, globals, frames, setup, importers, onReady, request]);

  useLayoutEffect(() => {
    committed.current = cache;
  }, [cache]);

  useEffect(() => {
    const offs = [...cache.books].map(([id, book]) =>
      book.subscribe(() => setRevisions((prev) => new Map(prev).set(id, (prev.get(id) ?? 0) + 1))),
    );
    return () => {
      for (const off of offs) off();
    };
  }, [cache.books]);

  const isReady = useCallback((id: string) => readies.has(id) || loaded.has(id), [readies, loaded]);

  return { instruments: cache.list, isReady, onReady, reload };
}
