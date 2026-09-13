/**
 * Marks survive a reload. The payload goes in a trial slot of labkit's own —
 * not in `record.state`, which is the instrument's and typed as such — and it
 * is written on a trailing debounce: a write per scene notification re-renders
 * every trial on every frame of a drag.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnnotations } from '../annotations/AnnotationsContext';
import type { AnnotationsApi, SerializedAnnotations } from '../annotations/types';
import { defineInstrument } from '../instrument/defineInstrument';
import type { InstrumentList } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { LabContext, type LabContextValue } from '../lab/LabContext';
import { createMemoryAdapter } from '../state/adapters';
import { labPrefix } from '../state/labRecords';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

let api: AnnotationsApi | null = null;
let lab: LabContextValue | null = null;

function Pane() {
  api = useAnnotations();
  return <div data-testid="pane" />;
}

function CaptureLab() {
  return (
    <LabContext.Consumer>
      {(value) => {
        lab = value;
        return null;
      }}
    </LabContext.Consumer>
  );
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
let loads = 0;
let gate: Promise<void> = Promise.resolve();
const selfStoring = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'SelfStoring',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <Pane />,
  annotations: {
    targets: () => [TARGET],
    storage: {
      load: async () => {
        loads++;
        await gate;
        return owned;
      },
      save: (doc) => {
        owned = doc;
      },
    },
  },
});

async function mount(backing: Map<string, unknown>, which: InstrumentList[number] = inspector) {
  api = null;
  const view = render(
    <Lab
      instruments={[which]}
      defaultInstrument={which.name}
      storage={createMemoryAdapter(backing)}
      storageKey="persist-test"
    >
      <CaptureLab />
    </Lab>,
  );
  await waitFor(() => expect(api).not.toBeNull());
  return view;
}

function storedTrial(backing: Map<string, unknown>): Record<string, unknown> | undefined {
  const prefix = `${labPrefix('persist-test')}trial:`;
  return [...backing].find(([key]) => key.startsWith(prefix))?.[1] as
    | Record<string, unknown>
    | undefined;
}

const MARK = { target: 'pane', kind: 'rect' as const, frac: { x: 0.2, y: 0.3, w: 0.1, h: 0.1 } };

describe('a trial that persists its marks', () => {
  beforeEach(() => {
    api = null;
    lab = null;
    owned = null;
    loads = 0;
    gate = Promise.resolve();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('brings them back on a remount from the same storage', async () => {
    const backing = new Map<string, unknown>();
    const first = await mount(backing);
    const id = marks().add(MARK, { angle: 12 });
    first.unmount();
    await waitFor(() => expect(storedTrial(backing)?.annotations).toBeDefined());

    await mount(backing);
    const back = marks().get(id);
    expect(back).toMatchObject({ id, target: 'pane', kind: 'rect', frac: MARK.frac });
    // The staleness snapshot has to survive too, or every restored mark reads
    // as fresh against whatever config it is opened under.
    expect(back?.seen).toEqual({ angle: 12 });
    if (!back) throw new Error('unreachable');
    expect(marks().isStale(back, { angle: 45 })).toBe(true);
  });

  it('keeps a mark out of storage until both debounces pass, while the lab stays open', async () => {
    const backing = new Map<string, unknown>();
    await mount(backing);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    marks().add(MARK);
    await act(() => vi.advanceTimersByTimeAsync(20));
    // Not a claim about either interval — a claim that a store write is not
    // synchronous with a scene notification.
    expect(storedTrial(backing)?.annotations).toBeUndefined();
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(storedTrial(backing)?.annotations).toBeDefined();
  });

  it('flushes on unmount, so the last mark before a close is not lost', async () => {
    const backing = new Map<string, unknown>();
    const first = await mount(backing);
    const id = marks().add(MARK);
    marks().add({ ...MARK, frac: { x: 0.6, y: 0.6, w: 0.1, h: 0.1 } });
    first.unmount();
    // Nothing was written before the unmount: neither debounce had elapsed.
    await waitFor(() => expect(storedTrial(backing)?.annotations).toBeDefined());

    await mount(backing);
    expect(marks().query()).toHaveLength(2);
    expect(marks().get(id)).toBeDefined();
  });

  it('leaves the slot alone when the instrument owns the storage', async () => {
    const backing = new Map<string, unknown>();
    const first = await mount(backing, selfStoring);
    marks().add(MARK);
    first.unmount();
    await waitFor(() => expect(owned?.version).toBe(1));
    await waitFor(() => expect(storedTrial(backing)).toBeDefined());
    expect(storedTrial(backing)).not.toHaveProperty('annotations');

    await mount(backing, selfStoring);
    expect(marks().query()).toHaveLength(1);
  });

  it('loads instrument-owned marks before the lab shows, and a later trial before its body', async () => {
    const backing = new Map<string, unknown>();
    let release = (): void => {};
    gate = new Promise((resolve) => {
      release = resolve;
    });
    render(
      <Lab
        instruments={[selfStoring]}
        defaultInstrument="SelfStoring"
        storage={createMemoryAdapter(backing)}
        storageKey="persist-test"
      >
        <CaptureLab />
      </Lab>,
    );
    await waitFor(() => expect(loads).toBe(1));
    expect(screen.queryByTestId('pane')).toBeNull();
    await act(async () => release());
    expect(await screen.findByTestId('pane')).toBeInTheDocument();

    gate = new Promise((resolve) => {
      release = resolve;
    });
    act(() => lab?.addTrial('SelfStoring'));
    expect(document.querySelectorAll('.lk-trial--loading')).toHaveLength(1);
    await act(async () => release());
    await waitFor(() => expect(screen.getAllByTestId('pane')).toHaveLength(2));
    expect(loads).toBe(2);
  });
});
