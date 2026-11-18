import type { InstrumentList } from '@weasel-js/labkit';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FrameSetup } from '../frame/FrameController';
import type { FrameImporters } from '../frame/mountFrame';
import { type Libraries, TITLE_LIBRARIES } from '../story/library';
import { loadStories } from '../story/load';
import type { IndexEntry, LoadedStory } from '../story/types';
import type { GlobalDeclarations } from './globals';
import { buildInstruments, EMPTY_CACHE, type InstrumentCache } from './instrumentCache';
import { type FrameReady, readyKey } from './readyKey';
import type { StoryHosts } from './storyHosts';
import { pruned, useStoryLoads } from './storyLoads';

/** The lab instruments `useStoryRegistry` builds, and the calls that keep them current. */
export interface StoryRegistry {
  instruments: InstrumentList;
  /** Whether a story's schema is known: its module has loaded, or its frame has reported. An instrument is built
   *  either way, and before that its schema is empty — which reads as "no args" to anything that cannot tell the
   *  two apart. */
  isReady: (id: string) => boolean;
  /** Called by FrameView. Replaces the story's instrument only when `ready.schema`, layout or viewport differ from what it holds. */
  onReady: (entry: IndexEntry, ready: FrameReady) => void;
  /** Drops what was loaded from `file` and loads it again for every entry that had it, as after an edit. */
  reload: (file: string) => void;
}

/** What `useStoryRegistry` loads stories from, and what it shows them with. */
export interface StoryRegistryOptions {
  frameUrl: string;
  globals?: GlobalDeclarations;
  /** Story modules by file. Given, every entry without `isolate` renders in the workshop document; absent, every
   *  entry renders in a frame. */
  importers?: FrameImporters;
  /** The frame config, applied to each story host in the document. */
  setup?: FrameSetup;
  /** Names the library an index page's component ships in. Default: its title's first segment. */
  libraries?: Libraries;
  /** The workshop's story hosts. Given, a story or index page rendered in the document takes marks. Keep it the
   *  same object: an instrument already built keeps the hosts it was built with. */
  hosts?: StoryHosts;
  load?: (mod: Record<string, unknown>, title: string, parameters?: Record<string, unknown>) => LoadedStory[];
}

const NO_GLOBALS: GlobalDeclarations = {};
const NO_SETUP: FrameSetup = {};

/**
 * One instrument per story in `index`, each schema holding a `$globals` group for `globals`. The lab's global values
 * reach the stories through `StoryGlobalsContext`, not through here.
 */
export function useStoryRegistry(index: readonly IndexEntry[], options: StoryRegistryOptions): StoryRegistry {
  const { frameUrl, globals = NO_GLOBALS, importers, setup = NO_SETUP, libraries = TITLE_LIBRARIES, load = loadStories, hosts } = options;
  const [readies, setReadies] = useState<ReadonlyMap<string, FrameReady>>(() => new Map());
  const { loaded, faults, generations, request, reload, prune } = useStoryLoads({ index, importers, setup, load, libraries });
  // Bumped when a story's frame answers something new. labkit's panel re-reads the answer book only when
  // the trial's config changes, and replacing the instrument is what refills it.
  const [revisions, setRevisions] = useState<ReadonlyMap<string, number>>(() => new Map());

  const onReady = useCallback((entry: IndexEntry, ready: FrameReady) => {
    setReadies((prev) => {
      const held = prev.get(entry.id);
      if (held && readyKey(held) === readyKey(ready)) return prev;
      return new Map(prev).set(entry.id, ready);
    });
  }, []);

  // Keyed by content: a caller may rebuild an equal index every render, and an identity key would loop.
  const indexIds = JSON.stringify(index.map((entry) => entry.id));
  const [prunedFor, setPrunedFor] = useState(indexIds);
  if (prunedFor !== indexIds) {
    setPrunedFor(indexIds);
    const ids = new Set(index.map((entry) => entry.id));
    setReadies((prev) => pruned(prev, ids));
    prune(ids);
    setRevisions((prev) => pruned(prev, ids));
  }

  const committed = useRef<InstrumentCache>(EMPTY_CACHE);

  const cache = useMemo<InstrumentCache>(
    () =>
      buildInstruments(
        committed.current,
        index,
        { readies, loaded, faults, generations, revisions },
        { frameUrl, globals, setup, hosts, inDocument: importers !== undefined, onReady, request },
      ),
    [index, readies, loaded, faults, generations, revisions, frameUrl, globals, setup, hosts, importers, onReady, request],
  );

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
