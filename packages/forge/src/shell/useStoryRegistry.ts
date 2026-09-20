import type { Instrument, InstrumentList } from '@weasel-js/labkit';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { stableStringify } from '../protocol/messages';
import type { IndexEntry } from '../story/types';
import { type AnswerBook, createAnswerBook } from './answers';
import type { GlobalDeclarations } from './globals';
import { type Ready, readyKey } from './readyKey';
import { storyInstrument } from './storyInstrument';
import type { TrialFrames } from './trialFrames';

export interface StoryRegistry {
  instruments: InstrumentList;
  /** Called by FrameView. Replaces the story's instrument only when `ready.schema`, layout or viewport differ from what it holds. */
  onReady: (entry: IndexEntry, ready: Ready) => void;
}

interface Built {
  entryKey: string;
  ready: Ready | undefined;
  frameUrl: string;
  globals: GlobalDeclarations;
  frames: TrialFrames | undefined;
  revision: number;
  instrument: Instrument<unknown, unknown>;
}

interface Cache {
  built: ReadonlyMap<string, Built>;
  books: ReadonlyMap<string, AnswerBook>;
  list: InstrumentList;
}

const NO_GLOBALS: GlobalDeclarations = {};

const pruned = <V>(map: ReadonlyMap<string, V>, ids: Set<string>): ReadonlyMap<string, V> =>
  [...map.keys()].every((id) => ids.has(id)) ? map : new Map([...map].filter(([id]) => ids.has(id)));

/**
 * One instrument per story in `index`, each schema holding a `$globals` group for `globals`. The lab's global values
 * reach the frames through `StoryGlobalsContext`, not through here.
 */
export function useStoryRegistry(
  index: readonly IndexEntry[],
  options: { frameUrl: string; globals?: GlobalDeclarations; frames?: TrialFrames },
): StoryRegistry {
  const { frameUrl, globals = NO_GLOBALS, frames } = options;
  const [readies, setReadies] = useState<ReadonlyMap<string, Ready>>(() => new Map());
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
    setRevisions((prev) => pruned(prev, ids));
  }, [index]);

  const committed = useRef<Cache>({ built: new Map(), books: new Map(), list: [] });

  const cache = useMemo<Cache>(() => {
    const previous = committed.current;
    const built = new Map<string, Built>();
    const books = new Map<string, AnswerBook>();
    const list = index.map((entry) => {
      const ready = readies.get(entry.id);
      const revision = revisions.get(entry.id) ?? 0;
      const entryKey = stableStringify(entry);
      const answers = previous.books.get(entry.id) ?? createAnswerBook();
      books.set(entry.id, answers);
      const held = previous.built.get(entry.id);
      const kept =
        held &&
        held.entryKey === entryKey &&
        held.ready === ready &&
        held.frameUrl === frameUrl &&
        held.globals === globals &&
        held.frames === frames &&
        held.revision === revision
          ? held
          : {
              entryKey,
              ready,
              frameUrl,
              globals,
              frames,
              revision,
              instrument: storyInstrument({ entry, ready, answers, frameUrl, onReady, globals, ...(frames ? { frames } : {}) }),
            };
      built.set(entry.id, kept);
      return kept.instrument;
    });
    const unchanged = list.length === previous.list.length && list.every((i, n) => i === previous.list[n]);
    return { built, books, list: unchanged ? previous.list : list };
  }, [index, readies, revisions, frameUrl, globals, frames, onReady]);

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

  return { instruments: cache.list, onReady };
}
