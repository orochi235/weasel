import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PaintKindsDemo } from '../PaintKindsDemo';

const colorOf = () => screen.getByText('colorOf').nextElementSibling?.textContent;

describe('PaintKindsDemo', () => {
  it('seeds the chosen kind from the chosen color', () => {
    const { container } = render(<PaintKindsDemo />);
    expect(container.querySelector('canvas')).toBeTruthy();
    expect(colorOf()).toBe('#3a7bd5');
    fireEvent.click(screen.getByRole('radio', { name: '#c0392b' }));
    expect(colorOf()).toBe('#c0392b');
  });

  it('lists the mesh gradient once its loader has run', async () => {
    render(<PaintKindsDemo />);
    const load = screen.getByRole('button', { name: 'Load mesh gradient' });
    fireEvent.click(load);
    await waitFor(() => expect(load.hasAttribute('disabled')).toBe(true), { timeout: 10_000 });
  });
});
