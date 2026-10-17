/**
 * Marks another tab drew. Its write replaces this tab's trial record, and the
 * trial's mark store, built once from the record, has to follow.
 */
import { act, waitFor } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { createMemoryAdapter } from '@weasel-js/storage';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnnotations } from '../annotations/AnnotationsContext';
import type { AnnotationsApi } from '../annotations/types';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';
import { labPrefix } from '../state/labRecords';

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

function marks(): AnnotationsApi {
  if (!api) throw new Error('no annotations api — did the instrument render?');
  return api;
}

const inspector = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Inspector',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <Pane />,
  annotations: {
    targets: () => [{ id: 'pane', ref: { current: null }, content: { w: 200, h: 100 } }],
  },
});

async function mount(backing: Map<string, unknown>) {
  api = null;
  const view = await renderSettled(
    <Lab
      instruments={[inspector]}
      defaultInstrument="Inspector"
      storage={createMemoryAdapter(backing)}
      storageKey="remote-test"
    />,
    { wrapper: withIcons },
  );
  await waitFor(() => expect(api).not.toBeNull());
  return view;
}

const PREFIX = `${labPrefix('remote-test')}trial:`;
type Stored = [key: string, record: Record<string, unknown>];
const storedTrial = (backing: Map<string, unknown>): Stored | undefined =>
  [...backing].find(([key]) => key.startsWith(PREFIX)) as Stored | undefined;

/** The trial's record once storage holds its marks. */
async function storedWithMarks(backing: Map<string, unknown>): Promise<Stored> {
  await waitFor(() => expect(storedTrial(backing)?.[1].annotations).toBeDefined());
  return storedTrial(backing) as Stored;
}

/** Write the trial's record as another tab over the same storage would. */
async function writeAsOtherTab(backing: Map<string, unknown>, key: string, record: unknown) {
  await act(async () => {
    await createMemoryAdapter(backing).set(key, record);
    await new Promise((r) => setTimeout(r, 0));
  });
}

const at = (x: number) => ({
  target: 'pane',
  kind: 'rect' as const,
  frac: { x, y: 0.3, w: 0.1, h: 0.1 },
});

/** A mark document holding one mark, as a lab stores it. */
async function oneMarkDocument(): Promise<unknown> {
  const backing = new Map<string, unknown>();
  const view = await mount(backing);
  act(() => {
    marks().add(at(0.2));
  });
  view.unmount();
  const [, record] = await storedWithMarks(backing);
  return record.annotations;
}

describe("a trial whose record another tab's write replaces", () => {
  beforeEach(() => {
    api = null;
  });

  it('shows the marks that tab drew, and keeps them under its own next mark', async () => {
    const theirs = await oneMarkDocument();
    const backing = new Map<string, unknown>();
    const view = await mount(backing);
    // A mark of its own, then removed, so the record is in storage to replace.
    act(() => {
      marks().remove(marks().add(at(0.8)));
    });
    const [key, record] = await storedWithMarks(backing);
    expect(marks().query()).toHaveLength(0);

    await writeAsOtherTab(backing, key, { ...record, annotations: theirs });
    await waitFor(() => expect(marks().query()).toHaveLength(1));

    act(() => {
      marks().add(at(0.5));
    });
    view.unmount();
    await waitFor(() =>
      expect(JSON.stringify(storedTrial(backing)?.[1].annotations)).not.toBe(
        JSON.stringify(theirs),
      ),
    );
    await mount(backing);
    expect(marks().query()).toHaveLength(2);
  });

  it('drops a mark of its own not yet saved, as the write it lost to would have', async () => {
    const theirs = await oneMarkDocument();
    const backing = new Map<string, unknown>();
    await mount(backing);
    act(() => {
      marks().remove(marks().add(at(0.8)));
    });
    const [key, record] = await storedWithMarks(backing);

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      act(() => {
        marks().add(at(0.6));
      });
      const other = createMemoryAdapter(backing);
      await act(async () => {
        await other.set(key, { ...record, annotations: theirs });
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(
        marks()
          .query()
          .map((mark) => mark.frac),
      ).toEqual([at(0.2).frac]);
      await act(() => vi.advanceTimersByTimeAsync(3000));
      expect(storedTrial(backing)?.[1].annotations).toEqual(theirs);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps its mark history when the write changed no mark', async () => {
    const backing = new Map<string, unknown>();
    await mount(backing);
    act(() => {
      marks().add(at(0.2));
    });
    const [key, record] = await storedWithMarks(backing);
    const before = marks();
    expect(before.canUndo()).toBe(true);

    await writeAsOtherTab(backing, key, { ...record, title: 'renamed elsewhere' });
    expect(marks().canUndo()).toBe(true);
    expect(marks().query()).toHaveLength(1);
  });
});
