/**
 * A trial that both annotates and records its settings has two undo
 * histories; its Undo takes back whichever change was made last.
 */
import { act, fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useAnnotations } from '../annotations/AnnotationsContext';
import type { AnnotationsApi } from '../annotations/types';
import { f } from '../config/builder';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';
import { trialUndoBindings } from './trialUndo';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

let api: AnnotationsApi | null = null;

function Pane() {
  api = useAnnotations();
  return null;
}

const instrument = defineInstrument({
  name: 'Both',
  config: f.schema({ grid: f.boolean(true).label('Show grid') }),
  initialState: () => ({}),
  render: () => <Pane />,
  annotations: {
    targets: () => [{ id: 'pane', ref: { current: null }, content: { w: 200, h: 100 } }],
  },
});

const MARK = { target: 'pane', kind: 'rect' as const, frac: { x: 0.2, y: 0.3, w: 0.1, h: 0.1 } };

const mount = () =>
  renderSettled(<Lab instruments={[instrument]} defaultInstrument="Both" />, {
    wrapper: withIcons,
  });
const grid = () => screen.getByRole('checkbox', { name: 'Show grid' });
const marked = () => api?.query().length ?? 0;
const addMark = () =>
  act(() => {
    api?.add(MARK);
  });
const flip = () => fireEvent.click(grid());
const press = (name: 'Undo' | 'Redo') => fireEvent.click(screen.getByRole('button', { name }));

describe("a trial's Undo over marks and settings", () => {
  it('takes back a setting changed after a mark first, and redoes the mark first', async () => {
    await mount();
    addMark();
    flip();
    press('Undo');
    expect(grid()).toBeChecked();
    expect(marked()).toBe(1);
    press('Undo');
    expect(marked()).toBe(0);
    press('Redo');
    expect(marked()).toBe(1);
    expect(grid()).toBeChecked();
    press('Redo');
    expect(grid()).not.toBeChecked();
  });

  it('takes back a mark made after a setting change first, and redoes the setting first', async () => {
    await mount();
    flip();
    addMark();
    press('Undo');
    expect(marked()).toBe(0);
    expect(grid()).not.toBeChecked();
    press('Undo');
    expect(grid()).toBeChecked();
    press('Redo');
    expect(grid()).not.toBeChecked();
    expect(marked()).toBe(0);
    press('Redo');
    expect(marked()).toBe(1);
  });
});

describe('trialUndoBindings', () => {
  it('steps marks first over an instrument history that cannot say when it recorded', () => {
    const marks = {
      moves: { undo: true, redo: false },
      store: {
        undo: vi.fn(() => true),
        redo: vi.fn(),
        undoStamp: () => 1,
        redoStamp: () => undefined,
      },
    };
    const own = {
      canUndo: () => true,
      canRedo: () => false,
      undo: vi.fn(),
      redo: vi.fn(),
      subscribe: () => () => {},
      record: vi.fn(),
    };
    trialUndoBindings({ declaresUndo: true, marks, own, snapshots: undefined })?.undo();
    expect(marks.store.undo).toHaveBeenCalledOnce();
    expect(own.undo).not.toHaveBeenCalled();
  });

  it('steps an instrument history whose last step is newer than the last mark', () => {
    const marks = {
      moves: { undo: true, redo: false },
      store: {
        undo: vi.fn(() => true),
        redo: vi.fn(),
        undoStamp: () => 1,
        redoStamp: () => undefined,
      },
    };
    const own = {
      canUndo: () => true,
      canRedo: () => false,
      undo: vi.fn(),
      redo: vi.fn(),
      undoStamp: () => 2,
      redoStamp: () => undefined,
      subscribe: () => () => {},
      record: vi.fn(),
    };
    trialUndoBindings({ declaresUndo: true, marks, own, snapshots: undefined })?.undo();
    expect(own.undo).toHaveBeenCalledOnce();
    expect(marks.store.undo).not.toHaveBeenCalled();
  });
});
