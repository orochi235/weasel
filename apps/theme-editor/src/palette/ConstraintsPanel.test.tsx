import { DEFAULT_CONSTRAINTS } from '@weasel-js/theme/engine';
import { PropertyPanel } from '@weasel-js/ui';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConstraintsPanel } from './ConstraintsPanel';

describe('<ConstraintsPanel>', () => {
  afterEach(cleanup);

  it('shows every gate group, and the count unless the caller fixes it', () => {
    const { rerender } = render(<PropertyPanel title="c"><ConstraintsPanel c={DEFAULT_CONSTRAINTS} onSet={vi.fn()} /></PropertyPanel>);
    for (const label of ['Colors', 'Order', 'Min hue gap', 'Min contrast', 'From surface', 'Between colors', 'Target', 'Pull', 'Fraction of cap', 'Equalize']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    rerender(<PropertyPanel title="c"><ConstraintsPanel c={DEFAULT_CONSTRAINTS} onSet={vi.fn()} fixedCount /></PropertyPanel>);
    expect(screen.queryByText('Colors')).toBeNull();
  });
});
