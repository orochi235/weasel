import { act, screen, waitFor } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { createMemoryAdapter } from '@weasel-js/storage';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';
import { LabContext, type LabContextValue } from '../lab/LabContext';
import { useAnnotations } from './AnnotationsContext';
import type { AnnotationsApi } from './types';

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

function theLab(): LabContextValue {
  if (!lab) throw new Error('no lab');
  return lab;
}

const annotating = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Annotating',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <Pane />,
  annotations: {
    targets: () => [{ id: 'pane', ref: { current: null }, content: { w: 200, h: 100 } }],
  },
});

const MARK = { target: 'pane', kind: 'rect' as const, frac: { x: 0.2, y: 0.3, w: 0.1, h: 0.1 } };

function shows(): boolean {
  const rail = screen.queryByRole('button', { name: 'Rectangle' }) !== null;
  const section = screen.queryByText('Marks') !== null;
  const undo = screen.queryByRole('button', { name: 'Undo' }) !== null;
  if (rail !== section || section !== undo) throw new Error(`rail ${rail}, section ${section}, undo ${undo}`);
  return rail;
}

describe("a lab's Marks switch", () => {
  beforeEach(() => {
    api = null;
    lab = null;
  });

  it('shows marks by default', async () => {
    await renderSettled(
      <Lab instruments={[annotating]} defaultInstrument="Annotating">
        <CaptureLab />
      </Lab>,
      { wrapper: withIcons },
    );
    expect(theLab().marks).toBe(true);
    expect(shows()).toBe(true);
  });

  it('starts hidden under marks={false}, keeping the marks and the api, and shows them when flipped', async () => {
    await renderSettled(
      <Lab instruments={[annotating]} defaultInstrument="Annotating" marks={false}>
        <CaptureLab />
      </Lab>,
      { wrapper: withIcons },
    );
    expect(shows()).toBe(false);
    if (!api) throw new Error('an instrument reading useAnnotations lost it while marks are hidden');
    const store = api;
    act(() => {
      store.add(MARK);
    });
    await act(async () => theLab().setMarks(true));
    expect(shows()).toBe(true);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('is kept by a stored lab over the prop', async () => {
    const backing = new Map<string, unknown>();
    const mount = () =>
      renderSettled(
        <Lab
          instruments={[annotating]}
          defaultInstrument="Annotating"
          marks={false}
          storage={createMemoryAdapter(backing)}
          storageKey="marks-test"
        >
          <CaptureLab />
        </Lab>,
        { wrapper: withIcons },
      );
    const first = await mount();
    await act(async () => theLab().setMarks(true));
    first.unmount();
    await waitFor(() => expect([...backing.values()]).toContain(true));

    await mount();
    expect(theLab().marks).toBe(true);
    expect(shows()).toBe(true);
  });
});
