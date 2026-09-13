import type { Instrument, InstrumentList } from '@weasel-js/labkit';
import { useCallback, useMemo, useState } from 'react';
import { type FromFrame, type Globals, stableStringify } from '../protocol/messages';
import type { IndexEntry } from '../story/types';
import { type AnswerBook, createAnswerBook } from './answers';
import { storyInstrument } from './storyInstrument';

type Ready = Extract<FromFrame, { type: 'ready' }>;

export interface StoryRegistry {
  instruments: InstrumentList;
  /** Called by FrameView. Replaces the story's instrument only when `ready.schema`, layout or viewport differ from what it holds. */
  onReady: (entry: IndexEntry, ready: Ready) => void;
}

const description = (ready: Ready): string =>
  stableStringify({ schema: ready.schema, layout: ready.layout, viewport: ready.viewport });

interface Built {
  entryKey: string;
  ready: Ready | undefined;
  frameUrl: string;
  globals: Globals;
  instrument: Instrument<unknown, unknown>;
}

export function useStoryRegistry(
  index: readonly IndexEntry[],
  options: { frameUrl: string; globals: Globals },
): StoryRegistry {
  const { frameUrl, globals } = options;
  const [readies, setReadies] = useState<ReadonlyMap<string, Ready>>(() => new Map());
  const [books] = useState(() => new Map<string, AnswerBook>());

  const onReady = useCallback((entry: IndexEntry, ready: Ready) => {
    setReadies((prev) => {
      const held = prev.get(entry.id);
      if (held && description(held) === description(ready)) return prev;
      return new Map(prev).set(entry.id, ready);
    });
  }, []);

  const [built] = useState(() => new Map<string, Built>());

  const instruments = useMemo(
    () =>
      index.map((entry) => {
        const ready = readies.get(entry.id);
        const entryKey = stableStringify(entry);
        const held = built.get(entry.id);
        if (
          held &&
          held.entryKey === entryKey &&
          held.ready === ready &&
          held.frameUrl === frameUrl &&
          held.globals === globals
        ) {
          return held.instrument;
        }
        let answers = books.get(entry.id);
        if (!answers) {
          answers = createAnswerBook();
          books.set(entry.id, answers);
        }
        const instrument = storyInstrument({ entry, ready, answers, frameUrl, onReady, globals });
        built.set(entry.id, { entryKey, ready, frameUrl, globals, instrument });
        return instrument;
      }),
    [index, readies, built, books, frameUrl, globals, onReady],
  );

  return { instruments, onReady };
}
