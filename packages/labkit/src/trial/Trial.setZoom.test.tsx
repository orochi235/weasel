import { act, fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

const staged = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Staged',
  initialState: () => ({}),
  render: ({ trial }) => (
    <>
      <output data-testid="zoom">{trial.zoom}</output>
      <button type="button" onClick={() => trial.setZoom(20)}>
        far
      </button>
    </>
  ),
  stage: {
    size: { width: 240, height: 160 },
    initialView: { zoom: 1, pan: { x: 0, y: 0 } },
    maxZoom: 1.5,
  },
});

describe('RenderContext.trial.setZoom', () => {
  it("zooms within the instrument's range, as the trial's zoom controls do", async () => {
    await renderSettled(<Lab instruments={[staged]} />, { wrapper: withIcons });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'far' }));
    });
    expect(screen.getByTestId('zoom')).toHaveTextContent('1.5');
  });
});
