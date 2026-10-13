import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ColorMatrixDemo } from '../ColorMatrixDemo';

describe('ColorMatrixDemo', () => {
  it('mounts and renders a canvas', () => {
    const { container } = render(<ColorMatrixDemo />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });
  it('presses the preset that was clicked and releases the one before it', () => {
    const { getAllByText } = render(<ColorMatrixDemo />);
    const sepia = getAllByText('Sepia')[0];
    const identity = getAllByText('Identity')[0];
    fireEvent.click(sepia);
    expect(sepia.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(identity);
    expect(identity.getAttribute('aria-pressed')).toBe('true');
    expect(sepia.getAttribute('aria-pressed')).toBe('false');
  });
});
