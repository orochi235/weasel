import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/types';
import { Lab } from './Lab';
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

function mountLab(props: Partial<Parameters<typeof Lab>[0]> = {}) {
  labRef = null;
  return render(
    <Lab instruments={[stub, stubB]} defaultInstrument="Stub" {...props}>
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
});
