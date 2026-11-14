import { expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { createRecentColorsStore } from '../RecentColors';
import { describeHold } from '../Disabled/testing/holdCases.fixtures';
import { SwatchStrip } from './SwatchStrip';
import type { SwatchPalette } from './palettes';

const WARM: SwatchPalette = { id: 'warm', name: 'Warm', colors: [{ value: '#ff0000ff', label: 'Red' }, { value: '#ff8800ff', label: 'Orange' }] };
const COOL: SwatchPalette = { id: 'cool', name: 'Cool', colors: [{ value: '#0000ffff', label: 'Blue' }] };

// Both rows: the recent one, which an apply records into, and the palette's.
describeHold('SwatchStrip', (mount, own) => {
  const store = createRecentColorsStore({ storage: null });
  store.record('#00ff00ff');
  const onChange = vi.fn();
  const onAltChange = vi.fn();
  mount(<SwatchStrip store={store} palettes={[WARM]} onChange={onChange} onAltChange={onAltChange} {...own} />);
  return {
    targets: () => screen.getAllByRole('button'),
    tryAll: () => {
      for (const name of ['Orange', '#00ff00']) {
        const swatch = screen.getByRole('button', { name });
        fireEvent.click(swatch);
        fireEvent.contextMenu(swatch);
      }
    },
    changed: () => onChange.mock.calls.length + onAltChange.mock.calls.length > 0 || store.get()[0] !== '#00ff00ff',
  };
});

it('holds its palette picker and marks its root', () => {
  render(<SwatchStrip palettes={[WARM, COOL]} onChange={() => {}} disabled aria-label="Swatches" />);
  expect(screen.getByRole('group', { name: 'Swatches' })).toHaveAttribute('data-held', 'disabled');
  expect(screen.getByRole('button', { name: /Palette/ })).toBeDisabled();
});
