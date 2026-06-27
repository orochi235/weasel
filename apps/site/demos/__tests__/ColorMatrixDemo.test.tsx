import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ColorMatrixDemo } from '../ColorMatrixDemo';

describe('ColorMatrixDemo', () => {
  it('mounts and renders a canvas', () => {
    const { container } = render(<ColorMatrixDemo />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });
  it('preset clicks do not throw', () => {
    const { getAllByText } = render(<ColorMatrixDemo />);
    const sepias = getAllByText('Sepia');
    fireEvent.click(sepias[0]);
    fireEvent.click(getAllByText('Identity')[0]);
  });
});
