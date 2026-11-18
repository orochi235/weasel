import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PlotKindsDemo } from '../PlotKindsDemo';

// A panel whose state is minted on mount stands in for PlotDataPanel's edit error and row ids.
const mounts = vi.hoisted(() => ({ n: 0 }));
vi.mock('@weasel-js/ui-canvas/components/PlotDataPanel', () => ({
  PlotDataPanel: () => {
    const [mount] = useState(() => ++mounts.n);
    return <output aria-label="panel mount">{mount}</output>;
  },
}));
vi.mock('@weasel-js/plot', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/plot')>()),
  PlotView: () => null,
}));

afterEach(cleanup);

describe('PlotKindsDemo', () => {
  it('gives each chart kind a data panel of its own, so one kind’s panel state does not carry to the next', async () => {
    render(<PlotKindsDemo />);
    await screen.findByLabelText('panel mount');
    act(() => { fireEvent.click(screen.getByRole('radio', { name: 'pie' })); });
    const pie = (await screen.findByLabelText('panel mount')).textContent;
    // Gantt is loaded already, so switching back shows its chart without a frame with no panel.
    act(() => { fireEvent.click(screen.getByRole('radio', { name: 'gantt' })); });
    expect(screen.getByLabelText('panel mount').textContent).not.toBe(pie);
  });
});
