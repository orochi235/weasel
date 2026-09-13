import type { Instrument, InstrumentList } from '@weasel-js/labkit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { stableStringify } from '../protocol/messages';
import type { IndexEntry } from '../story/types';
import { type AnswerBook, createAnswerBook } from './answers';
import { type Ready, readyKey } from './readyKey';
import { storyInstrument } from './storyInstrument';

export interface StoryRegistry {
  instruments: InstrumentList;
  /** Called by FrameView. Replaces the story's instrument only when `ready.schema`, layout or viewport differ from what it holds. */
  onReady: (entry: IndexEntry, ready: Ready) => void;
}

interface Built {
  entryKey: string;
  ready: Ready | undefined;
  frameUrl: string;
  instrument: Instrument<unknown, unknown>;
}

interface Cache {
  built: ReadonlyMap<string, Built>;
  books: ReadonlyMap<string, AnswerBook>;
  list: InstrumentList;
}

/** One instrument per story in `index`. Globals reach the frames through `StoryGlobalsContext`, not through here. */
export function useStoryRegistry(index: readonly IndexEntry[], options: { frameUrl: string }): StoryRegistry {
  const { frameUrl } = options;
  const [readies, setReadies] = useState<ReadonlyMap<string, Ready>>(() => new Map());

  const onReady = useCallback((entry: IndexEntry, ready: Ready) => {
    setReadies((prev) => {
      const held = prev.get(entry.id);
      if (held && readyKey(held) === readyKey(ready)) return prev;
      return new Map(prev).set(entry.id, ready);
    });
  }, []);

  useEffect(() => {
    const ids = new Set(index.map((entry) => entry.id));
    setReadies((prev) =>
      [...prev.keys()].every((id) => ids.has(id)) ? prev : new Map([...prev].filter(([id]) => ids.has(id))),
    );
  }, [index]);

  const cache = useRef<Cache>({ built: new Map(), books: new Map(), list: [] });

  const instruments = useMemo(() => {
    const previous = cache.current;
    const built = new Map<string, Built>();
    const books = new Map<string, AnswerBook>();
    const list = index.map((entry) => {
      const ready = readies.get(entry.id);
      const entryKey = stableStringify(entry);
      const answers = previous.books.get(entry.id) ?? createAnswerBook();
      books.set(entry.id, answers);
      const held = previous.built.get(entry.id);
      const kept =
        held && held.entryKey === entryKey && held.ready === ready && held.frameUrl === frameUrl
          ? held
          : { entryKey, ready, frameUrl, instrument: storyInstrument({ entry, ready, answers, frameUrl, onReady }) };
      built.set(entry.id, kept);
      return kept.instrument;
    });
    const unchanged = list.length === previous.list.length && list.every((i, n) => i === previous.list[n]);
    cache.current = { built, books, list: unchanged ? previous.list : list };
    return cache.current.list;
  }, [index, readies, frameUrl, onReady]);

  return { instruments, onReady };
}
