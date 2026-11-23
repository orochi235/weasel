import { fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import { LabContext, type LabContextValue } from '../lab/LabContext';
import { LabStoreContext } from '../state/context';
import { createLabStore } from '../state/store';
import { Trial } from './Trial';

function renderTrial(id: string, closeTrial: (id: string) => void, others = 1) {
  const store = createLabStore();
  for (let i = 0; i < others; i++) {
    store.getState().addTrial({
      id: `other-${i}`,
      instrumentName: 'Renamed',
      config: {},
      state: {},
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
  }
  store.getState().addTrial({
    id: 'gone',
    instrumentName: 'Renamed',
    config: {},
    state: {},
    view: { zoom: 1, pan: { x: 0, y: 0 } },
  });
  const lab = { instruments: [], trials: [], closeTrial } as unknown as LabContextValue;
  return renderSettled(
    <LabStoreContext.Provider value={{ store }}>
      <LabContext.Provider value={lab}>
        <Trial id={id} />
      </LabContext.Provider>
    </LabStoreContext.Provider>,
    { wrapper: withIcons },
  );
}

describe('a trial with nothing to mount', () => {
  it('closes a trial whose instrument is gone', async () => {
    const closeTrial = vi.fn();
    await renderTrial('gone', closeTrial);
    expect(screen.getByText('Unknown instrument: Renamed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close trial' }));
    expect(closeTrial).toHaveBeenCalledWith('gone');
  });

  it("disables Close when the trial whose instrument is gone is the lab's only one", async () => {
    const closeTrial = vi.fn();
    await renderTrial('gone', closeTrial, 0);
    const close = screen.getByRole('button', { name: 'Close trial' });
    expect(close.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(close);
    expect(closeTrial).not.toHaveBeenCalled();
  });

  it('offers no working Close for a trial whose record is gone, since the lab holds nothing to close', async () => {
    const closeTrial = vi.fn();
    await renderTrial('missing', closeTrial);
    const close = screen.getByRole('button', { name: 'Close trial' });
    expect(close.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(close);
    expect(closeTrial).not.toHaveBeenCalled();
  });
});
