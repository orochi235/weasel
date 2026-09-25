import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { type ReactNode, useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/types';
import { createMemoryAdapter } from '../state/adapters';
import { Lab, type LabProps } from './Lab';
import { LabContext, type LabContextValue } from './LabContext';

const stub: Instrument = {
  name: 'Stub',
  defaultConfig: () => ({ count: 0 }),
  initialState: (config) => ({ value: (config as { count: number }).count }),
  render: () => <div data-testid="stub-content">stub</div>,
};

const stubB: Instrument = {
  ...stub,
  name: 'StubB',
  render: () => <div data-testid="stub-b-content">b</div>,
};

let labRef: LabContextValue | null = null;

function CaptureLab({ children }: { children?: ReactNode }) {
  return (
    <LabContext.Consumer>
      {(value) => {
        if (value) labRef = value;
        return children ?? null;
      }}
    </LabContext.Consumer>
  );
}

function mountLab(props: Partial<Record<keyof LabProps, unknown>> = {}) {
  labRef = null;
  return render(
    <Lab {...({ instruments: [stub, stubB], defaultInstrument: 'Stub', ...props } as LabProps)}>
      <CaptureLab />
    </Lab>,
  );
}

describe('<Lab>', () => {
  it('renders one trial by default', () => {
    mountLab();
    expect(screen.getAllByRole('region', { name: /trial/i })).toHaveLength(1);
  });

  it('addTrial adds a second trial', () => {
    mountLab();
    act(() => labRef?.addTrial('Stub'));
    expect(screen.getAllByRole('region', { name: /trial/i })).toHaveLength(2);
  });

  it('addTrial opens each trial on the config it was given', () => {
    mountLab();
    act(() => labRef?.addTrial('Stub', { config: { count: 7 } }));
    expect(labRef?.trials.map((t) => (t.config as { count: number }).count)).toEqual([0, 7]);
    expect(labRef?.trials.map((t) => (t.state as { value: number }).value)).toEqual([0, 7]);
  });

  it('closeTrial removes one when more than one exists', () => {
    mountLab();
    act(() => labRef?.addTrial('Stub'));
    const first = labRef?.trials[0];
    act(() => labRef?.closeTrial(first?.id ?? ''));
    expect(screen.getAllByRole('region', { name: /trial/i })).toHaveLength(1);
  });

  it('closeTrial is a no-op on the last trial', () => {
    mountLab();
    const only = labRef?.trials[0];
    act(() => labRef?.closeTrial(only?.id ?? ''));
    expect(screen.getAllByRole('region', { name: /trial/i })).toHaveLength(1);
  });

  it('cloneTrial inserts immediately after source', () => {
    mountLab();
    act(() => labRef?.addTrial('StubB'));
    const ws0 = labRef?.trials[0];
    const ws1 = labRef?.trials[1];
    act(() => labRef?.cloneTrial(ws0?.id ?? ''));
    const ids = labRef?.trials.map((w) => w.id) ?? [];
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe(ws0?.id);
    expect(ids[2]).toBe(ws1?.id);
  });

  it('resetTrial restores defaults', () => {
    mountLab();
    const ws = labRef?.trials[0];
    if (!ws) throw new Error('no trial');
    act(() => labRef?.resetTrial(ws.id));
    const reset = labRef?.trials[0];
    expect(reset?.config).toEqual({ count: 0 });
    expect(reset?.state).toEqual({ value: 0 });
  });

  it('mode="light" stamps light on the lab root', () => {
    const { container } = mountLab({ mode: 'light' });
    expect(container.querySelector('.lk-lab')?.getAttribute('data-wzl-mode')).toBe('light');
  });

  it('mode="dark" stamps dark on the lab root', () => {
    const { container } = mountLab({ mode: 'dark' });
    expect(container.querySelector('.lk-lab')?.getAttribute('data-wzl-mode')).toBe('dark');
  });

  it('mode="auto" resolves to a concrete mode', () => {
    const { container } = mountLab({ mode: 'auto' });
    expect(container.querySelector('.lk-lab')?.getAttribute('data-wzl-mode')).toMatch(
      /^(light|dark)$/,
    );
  });

  it('applies the interstellar theme in every mode', () => {
    const { container } = mountLab({ mode: 'light' });
    expect(container.querySelector('.lk-lab')?.getAttribute('data-wzl-theme')).toBe('interstellar');
  });

  it('setMode updates the stamped mode at runtime', () => {
    const { container } = mountLab({ mode: 'auto' });
    act(() => labRef?.setMode('light'));
    expect(container.querySelector('.lk-lab')?.getAttribute('data-wzl-mode')).toBe('light');
  });

  it('throws when instruments is empty', () => {
    expect(() => render(<Lab instruments={[]} defaultInstrument="Stub" />)).toThrow(
      /requires a non-empty `instruments` array/,
    );
  });

  it('throws when defaultInstrument does not match any instrument', () => {
    expect(() => render(<Lab instruments={[stub]} defaultInstrument="Missing" />)).toThrow(
      /Unknown instrument/,
    );
  });

  // The store reads its serializers while it is being built, so `<Lab>` is
  // the only thing positioned to collect them off the instruments. They went
  // uncollected for months, and an instrument holding anything JSON drops
  // lost it with no error.
  it('gives the store the serializers its instruments declare', async () => {
    const backing = new Map<string, unknown>();
    const mapped: Instrument = {
      ...stub,
      name: 'Mapped',
      initialState: () => ({ seen: new Set(['a']) }),
      serialize: (state) => ({ seen: [...(state as { seen: Set<string> }).seen] }),
      deserialize: (data) => ({ seen: new Set((data as { seen: string[] }).seen) }),
    };
    const storage = () => createMemoryAdapter(backing);

    const first = render(
      <Lab instruments={[mapped]} defaultInstrument="Mapped" storage={storage()} storageKey="s" />,
    );
    await waitFor(() => expect(JSON.stringify([...backing.values()])).toContain('"seen":["a"]'));
    first.unmount();

    mountLab({
      instruments: [mapped],
      defaultInstrument: 'Mapped',
      storage: storage(),
      storageKey: 's',
    });
    await waitFor(() => expect(labRef?.trials[0]).toBeDefined());
    expect((labRef?.trials[0]?.state as { seen: Set<string> } | undefined)?.seen).toEqual(
      new Set(['a']),
    );
  });
});

describe('instruments that change while mounted', () => {
  it('fills an open trial’s config before its replaced instrument renders', () => {
    const v1: Instrument = {
      name: 'Grow',
      defaultConfig: () => ({ size: 1 }),
      initialState: () => ({}),
      render: () => null,
    };
    const seenByV2: Array<{ color?: string }> = [];
    const v2: Instrument = {
      ...v1,
      defaultConfig: () => ({ size: 1, color: 'red' }),
      render: ({ config }) => {
        seenByV2.push(config as { color?: string });
        return null;
      },
    };
    const view = render(
      <Lab instruments={[v1]} defaultInstrument="Grow">
        <CaptureLab />
      </Lab>,
    );
    view.rerender(
      <Lab instruments={[v2]} defaultInstrument="Grow">
        <CaptureLab />
      </Lab>,
    );
    expect(labRef?.trials[0]?.config).toEqual({ size: 1, color: 'red' });
    expect(seenByV2.length).toBeGreaterThan(0);
    expect(seenByV2.every((c) => c.color === 'red')).toBe(true);
  });

  it('opens a trial of an instrument added after mount', () => {
    const later: Instrument = { ...stub, name: 'Later' };
    const view = render(
      <Lab instruments={[stub]} defaultInstrument="Stub">
        <CaptureLab />
      </Lab>,
    );
    view.rerender(
      <Lab instruments={[stub, later]} defaultInstrument="Stub">
        <CaptureLab />
      </Lab>,
    );
    act(() => labRef?.addTrial('Later'));
    expect(labRef?.trials.map((t) => t.instrumentName)).toEqual(['Stub', 'Later']);
    expect(screen.queryByText(/Unknown instrument/)).toBeNull();
  });

  it('keeps a trial’s content mounted across an instrument swap', () => {
    let mounts = 0;
    function Probe() {
      useEffect(() => {
        mounts += 1;
      }, []);
      return <p>probe</p>;
    }
    const v1: Instrument = {
      name: 'Keep',
      defaultConfig: () => ({}),
      initialState: () => ({}),
      render: () => <Probe />,
    };
    const v2: Instrument = { ...v1, defaultConfig: () => ({ extra: 1 }) };
    const view = render(<Lab instruments={[v1]} defaultInstrument="Keep" />);
    view.rerender(<Lab instruments={[v2]} defaultInstrument="Keep" />);
    expect(mounts).toBe(1);
  });
});

describe('focused trial', () => {
  const regions = () => screen.getAllByRole('region', { name: /trial/i });
  const framed: Instrument = {
    ...stub,
    name: 'Framed',
    render: () => <iframe title="story frame" />,
  };

  it('is the only trial until another opens, then the one that opened', () => {
    mountLab();
    expect(labRef?.focusedTrialId).toBe(labRef?.trials[0]?.id);
    act(() => labRef?.addTrial('StubB'));
    expect(labRef?.focusedTrialId).toBe(labRef?.trials[1]?.id);
    act(() => labRef?.cloneTrial(labRef?.trials[0]?.id ?? ''));
    expect(labRef?.focusedTrialId).toBe(labRef?.trials[1]?.id);
    expect(labRef?.trials.map((t) => t.instrumentName)).toEqual(['Stub', 'Stub', 'StubB']);
  });

  it('moves to a trial a pointer goes down in', () => {
    mountLab();
    act(() => labRef?.addTrial('StubB'));
    fireEvent.pointerDown(within(regions()[0] as HTMLElement).getByTestId('stub-content'));
    expect(labRef?.focusedTrialId).toBe(labRef?.trials[0]?.id);
  });

  it('moves to a trial focus moves into', () => {
    mountLab();
    act(() => labRef?.addTrial('StubB'));
    act(() => (regions()[0] as HTMLElement).focus());
    expect(labRef?.focusedTrialId).toBe(labRef?.trials[0]?.id);
  });

  it('moves to a trial whose frame takes focus, which fires nothing in the lab’s document', async () => {
    mountLab({ instruments: [framed, stubB], defaultInstrument: 'Framed' });
    act(() => labRef?.addTrial('StubB'));
    act(() => screen.getByTitle('story frame').focus());
    fireEvent.blur(window);
    await waitFor(() => expect(labRef?.focusedTrialId).toBe(labRef?.trials[0]?.id));
  });

  it('falls back to the first trial when the focused one closes', () => {
    mountLab();
    act(() => labRef?.addTrial('StubB'));
    act(() => labRef?.closeTrial(labRef?.trials[1]?.id ?? ''));
    expect(labRef?.focusedTrialId).toBe(labRef?.trials[0]?.id);
  });

  it('is marked on its trial only when there is more than one', () => {
    mountLab();
    expect(regions()[0]).not.toHaveAttribute('data-focused');
    act(() => labRef?.addTrial('StubB'));
    expect(regions()[1]).toHaveAttribute('data-focused', 'true');
    expect(regions()[0]).not.toHaveAttribute('data-focused');
  });
});

describe('swapTrial', () => {
  it('runs another instrument in the trial’s place, and keeps focus on that place', () => {
    mountLab();
    act(() => labRef?.addTrial('Stub'));
    const second = labRef?.trials[1]?.id;
    act(() => labRef?.focusTrial(labRef?.trials[0]?.id ?? ''));
    act(() => labRef?.swapTrial(labRef?.trials[0]?.id ?? '', 'StubB'));
    expect(labRef?.trials.map((t) => t.instrumentName)).toEqual(['StubB', 'Stub']);
    expect(labRef?.trials[1]?.id).toBe(second);
    expect(labRef?.focusedTrialId).toBe(labRef?.trials[0]?.id);
    expect(screen.getByTestId('stub-b-content')).toBeInTheDocument();
  });

  it('leaves focus where it was when the swapped trial did not have it', () => {
    mountLab();
    act(() => labRef?.addTrial('Stub'));
    const focused = labRef?.focusedTrialId;
    act(() => labRef?.swapTrial(labRef?.trials[0]?.id ?? '', 'StubB'));
    expect(labRef?.focusedTrialId).toBe(focused);
  });
});
