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
  it('renders one workspace by default', () => {
    mountLab();
    expect(screen.getAllByRole('region', { name: /workspace/i })).toHaveLength(1);
  });

  it('addWorkspace adds a second workspace', () => {
    mountLab();
    act(() => labRef?.addWorkspace('Stub'));
    expect(screen.getAllByRole('region', { name: /workspace/i })).toHaveLength(2);
  });

  it('closeWorkspace removes one when more than one exists', () => {
    mountLab();
    act(() => labRef?.addWorkspace('Stub'));
    const first = labRef?.workspaces[0];
    act(() => labRef?.closeWorkspace(first?.id ?? ''));
    expect(screen.getAllByRole('region', { name: /workspace/i })).toHaveLength(1);
  });

  it('closeWorkspace is a no-op on the last workspace', () => {
    mountLab();
    const only = labRef?.workspaces[0];
    act(() => labRef?.closeWorkspace(only?.id ?? ''));
    expect(screen.getAllByRole('region', { name: /workspace/i })).toHaveLength(1);
  });

  it('cloneWorkspace inserts immediately after source', () => {
    mountLab();
    act(() => labRef?.addWorkspace('StubB'));
    const ws0 = labRef?.workspaces[0];
    const ws1 = labRef?.workspaces[1];
    act(() => labRef?.cloneWorkspace(ws0?.id ?? ''));
    const ids = labRef?.workspaces.map((w) => w.id) ?? [];
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe(ws0?.id);
    expect(ids[2]).toBe(ws1?.id);
  });

  it('resetWorkspace restores defaults', () => {
    mountLab();
    const ws = labRef?.workspaces[0];
    if (!ws) throw new Error('no workspace');
    act(() => labRef?.resetWorkspace(ws.id));
    const reset = labRef?.workspaces[0];
    expect(reset?.config).toEqual({ count: 0 });
    expect(reset?.state).toEqual({ value: 0 });
  });

  it('theme="light" applies lk-theme-light class', () => {
    const { container } = mountLab({ theme: 'light' });
    expect(container.querySelector('.lk-lab')?.className).toMatch(/lk-theme-light/);
  });

  it('theme="interstellar" applies lk-theme-interstellar class', () => {
    const { container } = mountLab({ theme: 'interstellar' });
    expect(container.querySelector('.lk-lab')?.className).toMatch(/lk-theme-interstellar/);
  });

  it('theme="auto" applies neither class', () => {
    const { container } = mountLab({ theme: 'auto' });
    const cls = container.querySelector('.lk-lab')?.className ?? '';
    expect(cls).not.toMatch(/lk-theme-light/);
    expect(cls).not.toMatch(/lk-theme-interstellar/);
  });

  it('setTheme updates class at runtime', () => {
    const { container } = mountLab({ theme: 'auto' });
    act(() => labRef?.setTheme('light'));
    expect(container.querySelector('.lk-lab')?.className).toMatch(/lk-theme-light/);
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
