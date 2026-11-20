import { fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it } from 'vitest';
import { ShapePanelCell } from './ShapePanelCell';

// Each cell shows its control in a small working state (`Specimen`'s doc): every control on it answers.

describe('specimen cells', () => {
  it('moves the Rings slider by a key step and keeps it there', () => {
    renderWithIcons(<ShapePanelCell />);
    fireEvent.click(screen.getByRole('button', { name: /Bevel/ }));
    const rings = screen.getByRole('slider', { name: /Rings/ }) as HTMLInputElement;
    // A key step as a browser delivers it: one input, then the change that ends it.
    fireEvent.input(rings, { target: { value: '33' } });
    fireEvent.change(rings);
    expect(Number(rings.value)).toBe(33);
  });
});
