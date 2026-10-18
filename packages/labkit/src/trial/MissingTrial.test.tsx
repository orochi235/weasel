import { fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import { LabContext, type LabContextValue } from '../lab/LabContext';
import { LabStoreContext } from '../state/context';
import { createLabStore } from '../state/store';
import { Trial } from './Trial';

function renderTrial(id: string, closeTrial: (id: string) => void) {
  const store = createLabStore();
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

  it('closes a trial whose record is gone', async () => {
    const closeTrial = vi.fn();
    await renderTrial('missing', closeTrial);
    fireEvent.click(screen.getByRole('button', { name: 'Close trial' }));
    expect(closeTrial).toHaveBeenCalledWith('missing');
  });
});
