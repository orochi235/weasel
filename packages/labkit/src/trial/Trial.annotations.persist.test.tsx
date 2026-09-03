/**
 * Marks survive a reload. The payload goes in a trial slot of labkit's own —
 * not in `record.state`, which is the instrument's and typed as such — and it
 * is written on a trailing debounce: a write per scene notification re-renders
 * every trial on every frame of a drag.
 */
import { act, render } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnnotations } from '../annotations/AnnotationsContext';
import type { AnnotationsApi, SerializedAnnotations } from '../annotations/types';
import { defineInstrument } from '../instrument/defineInstrument';
import type { InstrumentList } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { createMemoryAdapter } from '../state/adapters';
import type { StorageAdapter } from '../state/types';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

let api: AnnotationsApi | null = null;

function Pane() {
  api = useAnnotations();
  return <div data-testid="pane" />;
}

/** Read through a call, so TypeScript does not narrow the module-level `api`
 *  to `null` across the remounts these tests are about. */
function marks(): AnnotationsApi {
  if (!api) throw new Error('no annotations api — did the instrument render?');
  return api;
}

const TARGET = { id: 'pane', ref: { current: null }, content: { w: 200, h: 100 } };

const inspector = defineInstrument<Record<string, never>, { angle: number }>({
  name: 'Inspector',
  defaultConfig: () => ({ angle: 0 }),
  initialState: () => ({}),
  render: () => <Pane />,
  annotations: { targets: () => [{ ...TARGET, positionDependsOn: ['angle'] }] },
});

/** The instrument keeps its own marks, so labkit must not keep them too. */
let owned: SerializedAnnotations | null = null;
const selfStoring = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'SelfStoring',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <Pane />,
  annotations: {
    targets: () => [TARGET],
    storage: {
      load: () => owned,
      save: (doc) => {
        owned = doc;
      },
    },
  },
});

function mount(storage: StorageAdapter, which: InstrumentList[number] = inspector) {
  return render(
    <Lab
      instruments={[which]}
      defaultInstrument={which.name}
      storage={storage}
      storageKey="persist-test"
    />,
  );
}

const MARK = { target: 'pane', kind: 'rect' as const, frac: { x: 0.2, y: 0.3, w: 0.1, h: 0.1 } };

describe('a trial that persists its marks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    api = null;
    owned = null;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('brings them back on a remount from the same storage', () => {
    const storage = createMemoryAdapter();
    const first = mount(storage);
    const id = marks().add(MARK, { angle: 12 });

    // Past both debounces: labkit's write-back, then the document flush.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    first.unmount();

    api = null;
    mount(storage);
    const back = marks().get(id);
    expect(back).toMatchObject({ id, target: 'pane', kind: 'rect', frac: MARK.frac });
    // The staleness snapshot has to survive too, or every restored mark reads
    // as fresh against whatever config it is opened under.
    expect(back?.seen).toEqual({ angle: 12 });
    if (!back) throw new Error('unreachable');
    expect(marks().isStale(back, { angle: 45 })).toBe(true);
  });

  it('writes nothing before the debounce elapses', () => {
    const storage = createMemoryAdapter();
    const first = mount(storage);
    marks().add(MARK);
    act(() => {
      vi.advanceTimersByTime(20);
    });
    first.unmount();

    api = null;
    mount(storage);
    // Not a claim about the debounce interval — a claim that one exists, and
    // that a store write is not synchronous with a scene notification.
    //
    // It is also the no-migration claim: the document this remount reads was
    // written with trials and no `annotations` field, exactly as every
    // document from before this arc is, and the trial opens on an empty store
    // rather than failing to load.
    expect(marks().query()).toHaveLength(0);
  });

  it('flushes on unmount, so the last mark before a close is not lost', () => {
    const storage = createMemoryAdapter();
    const first = mount(storage);
    const id = marks().add(MARK);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    marks().add({ ...MARK, frac: { x: 0.6, y: 0.6, w: 0.1, h: 0.1 } });
    first.unmount();
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    api = null;
    mount(storage);
    expect(marks().query()).toHaveLength(2);
    expect(marks().get(id)).toBeDefined();
  });

  it('leaves the slot alone when the instrument owns the storage', () => {
    const storage = createMemoryAdapter();
    const first = mount(storage, selfStoring);
    marks().add(MARK);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    first.unmount();

    expect(owned?.version).toBe(1);
    expect(storage.read('lk:persist-test:doc')).not.toContain('"annotations"');

    api = null;
    mount(storage, selfStoring);
    expect(marks().query()).toHaveLength(1);
  });
});
