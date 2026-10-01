/**
 * Declaring `annotations` is what provides the drawing palette and the hook —
 * the same "a capability provides the chrome" rule the other capabilities
 * follow. The overlay's own geometry is covered in
 * `annotations/Annotations.overlay.test.tsx`.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useAnnotations, useAnnotationsOptional } from '../annotations/AnnotationsContext';
import type { AnnotationsApi } from '../annotations/types';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';
import { LabContext, type LabContextValue } from '../lab/LabContext';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

let api: AnnotationsApi | null = null;

function Pane({ tool }: { tool: string | null }) {
  api = useAnnotations();
  return <div data-testid="pane" data-marks={api.query().length} data-tool={tool ?? ''} />;
}

function marks(): AnnotationsApi {
  if (!api) throw new Error('no annotations api');
  return api;
}

const annotating = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Annotating',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: (ctx) => <Pane tool={ctx.trial.activeToolId} />,
  annotations: {
    targets: () => [{ id: 'pane', ref: { current: null }, content: { w: 200, h: 100 } }],
  },
});

function PlainPane() {
  const api = useAnnotationsOptional();
  return <div data-testid="plain" data-has-api={String(api !== null)} />;
}

const plain = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Plain',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <PlainPane />,
});

describe('an instrument that declares annotations', () => {
  it('gets a drawing palette', async () => {
    await renderSettled(<Lab instruments={[annotating]} defaultInstrument="Annotating" />);
    for (const label of [
      'Interact',
      'Select',
      'Freehand',
      'Line',
      'Arrow',
      'Rectangle',
      'Ellipse',
      'Text',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
  });

  it('gets only the tools it names', async () => {
    const narrow = defineInstrument<Record<string, never>, Record<string, never>>({
      ...annotating,
      name: 'Narrow',
      annotations: {
        targets: () => [{ id: 'pane', ref: { current: null }, content: { w: 200, h: 100 } }],
        tools: ['pointer', 'select'],
      },
    });
    await renderSettled(<Lab instruments={[narrow]} defaultInstrument="Narrow" />);
    expect(screen.getByRole('button', { name: 'Interact' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Select' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Freehand' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rectangle' })).toBeNull();
  });

  it('puts the store in reach of its own render', async () => {
    await renderSettled(<Lab instruments={[annotating]} defaultInstrument="Annotating" />);
    expect(screen.getByTestId('pane').dataset.marks).toBe('0');
  });

  it('starts in interact, so a first click reaches the instrument', async () => {
    await renderSettled(<Lab instruments={[annotating]} defaultInstrument="Annotating" />);
    expect(screen.getByRole('button', { name: 'Interact' }).getAttribute('aria-current')).toBe(
      'true',
    );
  });
});

let labRef: LabContextValue | null = null;

function CaptureLab() {
  return (
    <LabContext.Consumer>
      {(value) => {
        if (value) labRef = value;
        return null;
      }}
    </LabContext.Consumer>
  );
}

describe('the annotation tool', () => {
  it("is offered in the lab's rail, not in a trial's", async () => {
    await renderSettled(<Lab instruments={[annotating]} defaultInstrument="Annotating" />);
    expect(screen.getAllByRole('button', { name: 'Rectangle' })).toHaveLength(1);
    const trial = screen.getByRole('region', { name: /trial/i });
    expect(within(trial).queryByRole('button', { name: 'Rectangle' })).toBeNull();
  });

  it('is one tool across every trial', async () => {
    // A tool is what the hand is holding, not a property of a picture: picking
    // Rectangle once has to arm it wherever the next mark is drawn.
    labRef = null;
    await renderSettled(
      <Lab instruments={[annotating]} defaultInstrument="Annotating">
        <CaptureLab />
      </Lab>,
    );
    await act(async () => labRef?.addTrial('Annotating'));
    const panes = screen.getAllByTestId('pane');
    expect(panes).toHaveLength(2);
    for (const p of panes) expect(p.dataset.tool).toBe('pointer');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Rectangle' }));
    });
    for (const p of screen.getAllByTestId('pane')) expect(p.dataset.tool).toBe('rect');
  });
});

describe('the trial undo chrome over marks', () => {
  it('gets undo and redo without the instrument declaring `undo`', async () => {
    // Weasel history is the authority for marks, so the capability that
    // creates them is what earns the buttons.
    await renderSettled(<Lab instruments={[annotating]} defaultInstrument="Annotating" />);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeTruthy();
  });

  it('takes back a mark, and puts it back', async () => {
    await renderSettled(<Lab instruments={[annotating]} defaultInstrument="Annotating" />);
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo.getAttribute('aria-disabled') ?? undo.getAttribute('disabled')).not.toBeNull();

    await act(async () => {
      marks().add({ target: 'pane', kind: 'rect', frac: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } });
    });
    expect(screen.getByTestId('pane').dataset.marks).toBe('1');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });
    expect(screen.getByTestId('pane').dataset.marks).toBe('0');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    });
    expect(screen.getByTestId('pane').dataset.marks).toBe('1');
  });

  it('lists the marks in a sidebar panel', async () => {
    await renderSettled(<Lab instruments={[annotating]} defaultInstrument="Annotating" />);
    expect(screen.getByText('Marks')).toBeTruthy();
    await act(async () => {
      marks().add({ target: 'pane', kind: 'line', frac: { x: 0, y: 0, w: 0.5, h: 0 } });
    });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});

function GrowingPane({ n, grow }: { n: number; grow: () => void }) {
  const api = useAnnotations();
  return (
    <button type="button" data-testid="growing" data-targets={api.targets().length} onClick={grow}>
      {n}
    </button>
  );
}

describe('targets that follow the trial state', () => {
  it('reach a reader of the store once the change commits', async () => {
    // The store reads the committed state, so a reader rendering in the same
    // pass as the change sees the one before; the trial tells it to read again.
    const growing = defineInstrument<{ n: number }, Record<string, never>>({
      name: 'Growing',
      defaultConfig: () => ({}),
      initialState: () => ({ n: 1 }),
      render: (ctx) => (
        <GrowingPane n={ctx.state.n} grow={() => ctx.setState((s) => ({ n: s.n + 1 }))} />
      ),
      annotations: {
        targets: (state) =>
          Array.from({ length: state.n }, (_, i) => ({
            id: `t${i}`,
            ref: { current: null },
            content: { w: 10, h: 10 },
          })),
      },
    });
    await renderSettled(<Lab instruments={[growing]} defaultInstrument="Growing" />);
    expect(screen.getByTestId('growing').dataset.targets).toBe('1');
    await act(async () => {
      fireEvent.click(screen.getByTestId('growing'));
    });
    expect(screen.getByTestId('growing').textContent).toBe('2');
    expect(screen.getByTestId('growing').dataset.targets).toBe('2');
  });
});

describe("the capability's selection mode", () => {
  const twoTargets = (selection?: 'per-target') =>
    defineInstrument<Record<string, never>, Record<string, never>>({
      ...annotating,
      name: 'Two',
      annotations: {
        targets: () => [
          { id: 'a', ref: { current: null }, content: { w: 200, h: 100 } },
          { id: 'b', ref: { current: null }, content: { w: 200, h: 100 } },
        ],
        ...(selection ? { selection } : {}),
      },
    });
  const selectBoth = async (): Promise<readonly string[]> => {
    let both: [string, string] = ['', ''];
    await act(async () => {
      const onA = marks().add({ target: 'a', kind: 'rect', frac: { x: 0, y: 0, w: 0.1, h: 0.1 } });
      const onB = marks().add({ target: 'b', kind: 'rect', frac: { x: 0, y: 0, w: 0.1, h: 0.1 } });
      marks().setSelection([onA, onB]);
      both = [onA, onB];
    });
    return both;
  };

  it('keeps the selection to one target by default', async () => {
    await renderSettled(<Lab instruments={[twoTargets()]} defaultInstrument="Two" />);
    const [onA] = await selectBoth();
    expect(marks().selection()).toEqual([onA]);
  });

  it("reaches the trial's store when the instrument asks for per-target", async () => {
    await renderSettled(<Lab instruments={[twoTargets('per-target')]} defaultInstrument="Two" />);
    expect(marks().selection()).toEqual([]);
    const both = await selectBoth();
    expect(marks().selection()).toEqual(both);
  });
});

describe('an instrument that declares none', () => {
  it('gets no store and no palette', async () => {
    await renderSettled(<Lab instruments={[plain]} defaultInstrument="Plain" />);
    expect(screen.getByTestId('plain').dataset.hasApi).toBe('false');
    expect(screen.queryByRole('button', { name: 'Rectangle' })).toBeNull();
  });
});
