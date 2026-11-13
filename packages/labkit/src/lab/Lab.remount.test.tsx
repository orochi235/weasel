import { act, waitFor } from '@testing-library/react';
import { createMemoryAdapter } from '@weasel-js/storage';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/types';
import { Lab } from './Lab';
import { LabContext, type LabContextValue } from './LabContext';

const stub: Instrument = {
  name: 'Stub',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <div data-testid="stub-content">stub</div>,
};

let labRef: LabContextValue | null = null;
function CaptureLab() {
  return (
    <LabContext.Consumer>
      {(value) => {
        labRef = value;
        return null;
      }}
    </LabContext.Consumer>
  );
}

describe('a stored lab remounted in one commit', () => {
  it('opens on the edits the lab it replaced made', async () => {
    const storage = createMemoryAdapter();
    const lab = (key: string) => (
      <Lab key={key} instruments={[stub]} storageKey="re" storage={storage}>
        <CaptureLab />
      </Lab>
    );
    const { rerender } = renderWithIcons(lab('a'));
    await waitFor(() => expect(labRef?.trials).toHaveLength(1));
    act(() => labRef?.addTrial('Stub'));
    expect(labRef?.trials).toHaveLength(2);
    rerender(lab('b'));
    await waitFor(() => expect(labRef?.trials.length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 50));
    expect(labRef?.trials).toHaveLength(2);
  });
});
