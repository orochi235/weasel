import { act, fireEvent, screen } from '@testing-library/react';
import type { Op } from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/types';
import { useTrialLayerStack } from './useTrialLayerStack';

const instrument: Instrument = {
  name: 'Layered',
  initialState: () => ({}),
  render: () => null,
  canvas: { layers: [{ id: 'a', draw: () => {} }] },
  layers: { ids: [{ id: 'a', label: 'Alpha' }] },
};

function Stack({ steps }: { steps: Op[] }) {
  const { list, visibleLayers } = useTrialLayerStack({
    instrument,
    state: {},
    config: {},
    over: undefined,
    clock: undefined,
    snapshot: (_event, op) => steps.push(op),
  });
  return (
    <>
      {list}
      <output>{visibleLayers.join(',')}</output>
    </>
  );
}

describe('useTrialLayerStack', () => {
  it('records a layer toggle as a step whose undo shows the layer again, and whose redo hides it', async () => {
    const steps: Op[] = [];
    await renderSettled(<Stack steps={steps} />, { wrapper: withIcons });
    const shown = () => screen.getByRole('status').textContent;
    expect(shown()).toBe('a');
    fireEvent.click(screen.getByLabelText('Show Alpha'));
    expect(shown()).toBe('');
    expect(steps).toHaveLength(1);
    const undo = (steps[0] as Op).invert();
    act(() => void undo.apply(null));
    expect(shown()).toBe('a');
    act(() => void undo.invert().apply(null));
    expect(shown()).toBe('');
  });
});
