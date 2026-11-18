import { useLatest } from '@weasel-js/core';
import { getOwn } from '@weasel-js/registry';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FrameSetup } from '../frame/FrameController';
import type { FrameImporters } from '../frame/mountFrame';
import { loadIndexBundle } from '../story/indexBundle';
import { indexId, isIndexId } from '../story/indexPages';
import type { Libraries } from '../story/library';
import type { IndexEntry, LoadedStory } from '../story/types';
import type { Loaded } from './documentInstrument';

/** A map less every key `ids` does not hold; the same map when there is none. */
export const pruned = <V>(map: ReadonlyMap<string, V>, ids: Set<string>): ReadonlyMap<string, V> =>
  [...map.keys()].every((id) => ids.has(id)) ? map : new Map([...map].filter(([id]) => ids.has(id)));

const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

type Imports = Map<string, Promise<Record<string, unknown>>>;

/**
 * `importOf`, noting each import it hands out, and whether each is still its file's in `current`: a reload drops a
 * file's import for a newer one, whose answer a load that read the old one must not overwrite when it lands late.
 */
function trackedImports(importOf: (file: string) => Promise<Record<string, unknown>>, current: Imports) {
  const read: Imports = new Map();
  return {
    importOf: (file: string) => {
      const loading = importOf(file);
      read.set(file, loading);
      return loading;
    },
    latest: () => [...read].every(([file, loading]) => current.get(file) === loading),
  };
}

/** What stories load from: read at the time of each load, so a load asked for earlier sees the newest. */
export interface StoryLoadSource {
  index: readonly IndexEntry[];
  importers: FrameImporters | undefined;
  setup: FrameSetup;
  load: (mod: Record<string, unknown>, title: string, parameters?: Record<string, unknown>) => LoadedStory[];
  libraries: Libraries;
}

/** The stories loaded into the workshop document so far, and the calls that load them. */
export interface StoryLoads {
  /** Each entry's loaded story or index page, by id. */
  loaded: ReadonlyMap<string, Loaded>;
  /** Each entry whose load failed, by id. */
  faults: ReadonlyMap<string, Error>;
  /** Per file, how many reloads it has had. */
  generations: ReadonlyMap<string, number>;
  /** Load `entry`, with every story its file holds. */
  request: (entry: IndexEntry) => void;
  /** Drops what was loaded from `file`, so the entries that had it load again. */
  reload: (file: string) => void;
  /** Forget every entry `ids` does not hold. Called while rendering, as the index changes. */
  prune: (ids: Set<string>) => void;
}

/** Loads story modules and index pages on request, one import per file shared by every entry it holds. */
export function useStoryLoads(source: StoryLoadSource): StoryLoads {
  const [loaded, setLoaded] = useState<ReadonlyMap<string, Loaded>>(() => new Map());
  const [faults, setFaults] = useState<ReadonlyMap<string, Error>>(() => new Map());
  // Per file, how many reloads it has had: a pending face keyed by it asks again after one.
  const [generations, setGenerations] = useState<ReadonlyMap<string, number>>(() => new Map());

  // One import per file, shared by every entry it holds; a reload drops the file's promise and asks again.
  const imports = useRef<Imports>(new Map());
  const liveRef = useLatest(source);
  // Files asked for before the importers held them: a story file added while the workshop runs lists first.
  const missing = useRef(new Set<string>());

  const importOf = useCallback((file: string): Promise<Record<string, unknown>> => {
    let loading = imports.current.get(file);
    if (!loading) {
      const importer = getOwn(liveRef.current.importers ?? {}, file);
      if (!importer) missing.current.add(file);
      loading = importer ? importer() : Promise.reject(new Error(`No importer for ${file}`));
      imports.current.set(file, loading);
    }
    return loading;
  }, [liveRef]);

  const request = useCallback(
    (entry: IndexEntry): void => {
      const { setup: current, load: loadModule } = liveRef.current;
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
        setFaults((prev) => new Map([...prev, ...ids.map((id): [string, Error] => [id, fault])]));
      };
      const reads = trackedImports(importOf, imports.current);
      if (isIndexId(entry.id)) {
        const { index: entries, libraries } = liveRef.current;
        const source = { index: entries, importOf: reads.importOf, load: loadModule, parameters: current.parameters, prepare: current.prepare, libraries };
        void loadIndexBundle(entry.id, source)
          .then((bundle) => { if (reads.latest()) settle([entry.id], new Map<string, Loaded>([[entry.id, { kind: 'index', bundle }]])); })
          .catch((error: unknown) => { if (reads.latest()) fail([entry.id], error); });
        return;
      }
      const siblings = liveRef.current.index.filter((e) => e.file === entry.file && !isIndexId(e.id));
      const ids = siblings.map((e) => e.id);
      void reads.importOf(entry.file)
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
          if (reads.latest()) settle(ids, result);
        })
        .catch((error: unknown) => { if (reads.latest()) fail(ids, error); });
    },
    [importOf, liveRef],
  );

  const reload = useCallback(
    (file: string) => {
      imports.current.delete(file);
      const affected = liveRef.current.index.filter((e) => e.file === file || (isIndexId(e.id) && liveRef.current.index.some((s) => s.file === file && indexId(s.title) === e.id)));
      const ids = new Set(affected.map((e) => e.id));
      setLoaded((prev) => pruned(prev, new Set([...prev.keys()].filter((id) => !ids.has(id)))));
      setFaults((prev) => pruned(prev, new Set([...prev.keys()].filter((id) => !ids.has(id)))));
      setGenerations((prev) => new Map(prev).set(file, (prev.get(file) ?? 0) + 1));
    },
    [liveRef],
  );

  const { importers } = source;
  useEffect(() => {
    for (const file of [...missing.current]) {
      if (!importers || !getOwn(importers, file)) continue;
      missing.current.delete(file);
      reload(file);
    }
  }, [importers, reload]);

  const prune = (ids: Set<string>) => {
    setLoaded((prev) => pruned(prev, ids));
    setFaults((prev) => pruned(prev, ids));
  };

  return { loaded, faults, generations, request, reload, prune };
}
