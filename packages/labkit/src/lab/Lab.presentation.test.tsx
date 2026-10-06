import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Instrument } from '../instrument/types';
import { createMemoryAdapter } from '../state/adapters';
import { labPrefix } from '../state/labRecords';
import { Lab, type LabProps } from './Lab';
import { LabContext, type LabContextValue } from './LabContext';
import { type Presentation, usePresentation } from './presentation';

const stub: Instrument = {
  name: 'Stub',
  defaultConfig: () => ({ count: 0 }),
  initialState: (config) => ({ value: (config as { count: number }).count }),
  render: ({ state }) => (
    <div data-testid="stub-content">{(state as { value: number }).value}</div>
  ),
};

let presentation: Presentation | null = null;
let lab: LabContextValue | null = null;
function Capture() {
  presentation = usePresentation();
  return (
    <LabContext.Consumer>
      {(value) => {
        lab = value;
        return null;
      }}
    </LabContext.Consumer>
  );
}

function mountLab(props: Partial<LabProps> = {}) {
  return renderSettled(
    <Lab {...({ instruments: [stub], defaultInstrument: 'Stub', ...props } as LabProps)}>
      <Capture />
    </Lab>,
  );
}

const root = (container: HTMLElement) => container.querySelector('.lk-lab') as HTMLElement;
const presented = (container: HTMLElement) =>
  container.querySelectorAll<HTMLElement>('.lk-trial[data-lk-presented]');

afterEach(() => {
  presentation = null;
  lab = null;
  history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

describe('<Lab present>', () => {
  it('presents one trial opened on the seed', async () => {
    const { container, getByTestId } = await mountLab({ present: true, seed: { config: { count: 4 } } });
    expect(root(container).classList.contains('lk-lab--present')).toBe(true);
    expect(presented(container)).toHaveLength(1);
    expect(presented(container)[0]?.querySelector('.lk-trial__stage')).not.toBeNull();
    expect(getByTestId('stub-content').textContent).toBe('4');
    expect(presentation?.active).toBe(true);
  });

  it('presents from `?present` in the URL', async () => {
    history.replaceState(null, '', '/?present');
    const { container } = await mountLab();
    expect(presented(container)).toHaveLength(1);
  });

  it('keeps a stored lab presenting under its own key', async () => {
    const storage = createMemoryAdapter();
    const { unmount } = await mountLab({ present: true, storageKey: 'lab', storage });
    await waitFor(async () =>
      expect((await storage.list(labPrefix('lab:present'))).length).toBeGreaterThan(0),
    );
    unmount();
    expect(await storage.list(labPrefix('lab'))).toEqual([]);
  });

  it('does not leave on Escape, having nowhere to go back to', async () => {
    const { container } = await mountLab({ present: true });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(presented(container)).toHaveLength(1);
  });

  it('warns that a seed is ignored when the lab does not start presenting', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await mountLab({ seed: { config: { count: 4 } } });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`seed`'));
  });
});

describe('usePresentation', () => {
  it('presents the focused trial and returns on Escape', async () => {
    const { container } = await mountLab();
    await act(async () => lab?.addTrial('Stub', { config: { count: 2 } }));
    await act(async () => lab?.focusTrial(lab.trials[1]?.id as string));
    expect(presented(container)).toHaveLength(0);

    await act(async () => presentation?.enter());
    expect(presented(container)).toHaveLength(1);
    expect(presented(container)[0]?.dataset.trialId).toBe(lab?.trials[1]?.id);

    await act(async () => fireEvent.keyDown(document, { key: 'Escape' }));
    expect(presented(container)).toHaveLength(0);
    expect(root(container).classList.contains('lk-lab--present')).toBe(false);
  });

  it('throws outside <Lab>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Capture />)).toThrow(/inside <Lab>/);
  });
});
