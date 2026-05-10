import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { GradientPlaygroundDemo } from '../GradientPlaygroundDemo';

describe('GradientPlaygroundDemo', () => {
  it('mounts and renders a canvas', () => {
    const { container } = render(<GradientPlaygroundDemo />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('switches between gradient variants without throwing', () => {
    const { getByText, container } = render(<GradientPlaygroundDemo />);
    fireEvent.click(getByText('Radial'));
    fireEvent.click(getByText('Conic'));
    fireEvent.click(getByText('Linear'));
    expect(container.querySelector('canvas')).toBeTruthy();
  });
});
