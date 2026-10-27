import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ColorMatrixDemo } from '../ColorMatrixDemo';

describe('ColorMatrixDemo', () => {
  it('mounts and renders a canvas', () => {
    const { container } = render(<ColorMatrixDemo />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });
  it('checks the preset that was clicked and releases the one before it', () => {
    const { getAllByRole } = render(<ColorMatrixDemo />);
    const sepia = getAllByRole('radio', { name: 'Sepia' })[0];
    const identity = getAllByRole('radio', { name: 'Identity' })[0];
    fireEvent.click(sepia);
    expect(sepia.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(identity);
    expect(identity.getAttribute('aria-checked')).toBe('true');
    expect(sepia.getAttribute('aria-checked')).toBe('false');
  });
});
