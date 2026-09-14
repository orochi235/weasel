import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LayerRail } from './LayerRail';

const counts = {
  seeds: { count: 0, pinned: 0 },
  ramps: { count: 23, pinned: 23 },
  scales: { count: 0, pinned: 0 },
  semantics: { count: 11, pinned: 0 },
  components: { count: 0, pinned: 0 },
  pins: { count: 89, pinned: 23 },
};

describe('<LayerRail>', () => {
  afterEach(cleanup);

  it('lists the six layers in derivation order with their counts', () => {
    render(<LayerRail counts={counts} selected="ramps" onSelect={() => {}} />);
    const buttons = within(screen.getByRole('navigation', { name: 'Layers' })).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Seeds0', 'Ramps2323 pinned', 'Scales0', 'Semantics11', 'Components0', 'Pins8923 pinned']);
    expect(buttons[1]).toHaveAttribute('aria-current', 'true');
  });

  it('selects a layer', async () => {
    const onSelect = vi.fn();
    render(<LayerRail counts={counts} selected="ramps" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /^Pins/ }));
    expect(onSelect).toHaveBeenCalledWith('pins');
  });
});
