/**
 * A trial whose instrument keeps its own history saves it in the trial's
 * record, beside its marks', so Undo takes back the same steps in the same
 * order after a reload.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { createHistory, createScene, type Scene } from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { createMemoryAdapter } from '@weasel-js/storage';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useAnnotations } from '../annotations/AnnotationsContext';
import type { AnnotationsApi } from '../annotations/types';
import { f } from '../config/builder';
import { defineInstrument } from '../instrument/defineInstrument';
import type { InstrumentList, RenderContext } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { labPrefix } from '../state/labRecords';
import { type TrialHistorySource, useTrialHistory } from '../trial/trialHistory';
import { TrialSceneCanvas } from './TrialSceneCanvas';
import { type SceneTrialState, useTrialScene } from './useTrialScene';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

type Pose = { x: number; y: number; width: number; height: number };
type State = SceneTrialState<{ kind: 'rect' }, 'main', Pose>;
type Config = { grid: boolean };

const create = () =>
  createScene<{ kind: 'rect' }, 'main', Pose>({
    systemLayers: [{ id: 'main' }],
    initial: [
      {
        kind: 'mark',
        layer: 'main',
        data: { kind: 'rect' },
        pose: { x: 0, y: 0, width: 10, height: 10 },
      },
    ],
  });

let scene: Scene<{ kind: 'rect' }, 'main', Pose> | null = null;
let marks: AnnotationsApi | null = null;

function Body({ ctx }: { ctx: RenderContext<State, Config> }) {
  const live = useTrialScene(ctx, create);
  scene = live;
  marks = useAnnotations();
  return <TrialSceneCanvas scene={live} trial={ctx.trial} />;
}

const TARGET = { id: 'pane', ref: { current: null }, content: { w: 200, h: 100 } };

const drawing = defineInstrument<State, Config>({
  name: 'Drawing',
  config: f.schema({ grid: f.boolean(true).label('Show grid') }),
  initialState: () => ({ scene: null }),
  undo: {},
  annotations: { targets: () => [TARGET] },
  render: (ctx) => <Body ctx={ctx} />,
});

/** A history that cannot be saved, as a consumer's own might be. */
function Unsaved() {
  const [source] = useState((): TrialHistorySource => {
    const h = createHistory(null);
    return {
      canUndo: () => h.canUndo(),
      canRedo: () => h.canRedo(),
      undo: () => h.undo(),
      redo: () => h.redo(),
      subscribe: (listener) => h.subscribe(listener),
      record: (op, label) => h.recordEntry([op], label),
    };
  });
  useTrialHistory(source);
  return null;
}

const unsaved = defineInstrument<Record<string, never>, Config>({
  name: 'Unsaved',
  config: f.schema({ grid: f.boolean(true).label('Show grid') }),
  initialState: () => ({}),
  undo: {},
  render: () => <Unsaved />,
});

const KEY = 'scene-undo-persist-test';

async function mount(backing: Map<string, unknown>, which: InstrumentList[number] = drawing) {
  scene = null;
  marks = null;
  return renderSettled(
    <Lab instruments={[which]} storage={createMemoryAdapter(backing)} storageKey={KEY} />,
    { wrapper: withIcons },
  );
}

function stored(backing: Map<string, unknown>): Record<string, unknown> | undefined {
  const prefix = `${labPrefix(KEY)}trial:`;
  return [...backing].find(([key]) => key.startsWith(prefix))?.[1] as
    | Record<string, unknown>
    | undefined;
}

const grid = () => screen.getByRole('checkbox', { name: 'Show grid' });
const press = (name: 'Undo' | 'Redo') => fireEvent.click(screen.getByRole('button', { name }));
const undoButton = () => screen.getByRole('button', { name: 'Undo' });
const nodes = () => scene?.nodes.size ?? -1;
const marked = () => marks?.query().length ?? -1;

describe('a scene trial reloaded', () => {
  it('takes back the mark, then the setting, then the scene edit, in the order they were made', async () => {
    const backing = new Map<string, unknown>();
    const first = await mount(backing);
    act(() => {
      scene?.add({
        kind: 'mark',
        layer: 'main',
        data: { kind: 'rect' },
        pose: { x: 20, y: 20, width: 10, height: 10 },
      });
    });
    fireEvent.click(grid());
    act(() => {
      marks?.add({ target: 'pane', kind: 'rect', frac: { x: 0.2, y: 0.3, w: 0.1, h: 0.1 } });
    });
    expect(nodes()).toBe(2);
    expect(grid()).not.toBeChecked();
    expect(marked()).toBe(1);
    first.unmount();
    await waitFor(() => expect(stored(backing)?.annotations).toBeDefined());
    expect(stored(backing)?.undo).toHaveProperty('own');

    await mount(backing);
    await waitFor(() => expect(marked()).toBe(1));
    expect(nodes()).toBe(2);
    expect(grid()).not.toBeChecked();
    await waitFor(() => expect(undoButton()).toBeEnabled());
    press('Undo');
    expect(marked()).toBe(0);
    expect(grid()).not.toBeChecked();
    press('Undo');
    expect(grid()).toBeChecked();
    expect(nodes()).toBe(2);
    press('Undo');
    expect(nodes()).toBe(1);
    press('Redo');
    expect(nodes()).toBe(2);
    press('Redo');
    expect(grid()).not.toBeChecked();
    press('Redo');
    expect(marked()).toBe(1);
  });
});

describe('an instrument history that cannot be saved', () => {
  it('starts empty after a reload, and still takes the steps made after it', async () => {
    const backing = new Map<string, unknown>();
    const first = await mount(backing, unsaved);
    fireEvent.click(grid());
    first.unmount();
    await waitFor(() => expect(stored(backing)?.config).toEqual({ grid: false }));
    expect(stored(backing)).not.toHaveProperty('undo');

    await mount(backing, unsaved);
    expect(undoButton()).toBeDisabled();
    fireEvent.click(grid());
    expect(grid()).toBeChecked();
    press('Undo');
    expect(grid()).not.toBeChecked();
  });
});
