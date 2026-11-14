import { vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { describeHold, unlessDisabled } from '../Disabled/testing/holdCases.fixtures';
import { PatternPicker, seedPattern } from './PatternPicker';

// The tile swatches are its own; the size bar and the rotation field hold themselves through the scope it opens.
describeHold('PatternPicker', (mount, own) => {
  const onChange = vi.fn();
  mount(<PatternPicker value={seedPattern('hatch', '#123456')} color="#123456" onChange={onChange} {...own} />);
  const tiles = () => [...document.querySelectorAll<HTMLElement>('button[title]')];
  return {
    targets: tiles,
    tryAll: () => {
      for (const tile of tiles()) fireEvent.click(tile);
      unlessDisabled(screen.getByRole('radio', { name: 'L' }), (el) => fireEvent.click(el));
      unlessDisabled(screen.getByRole('spinbutton', { name: 'Rotation' }), (el) => {
        fireEvent.change(el, { target: { value: '30' } });
        fireEvent.blur(el);
      });
    },
    changed: () => onChange.mock.calls.length > 0,
  };
});
