import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { ScaleIndicator } from './ScaleIndicator';

describe('ScaleIndicator', () => {
  test('renders the unit label', () => {
    render(<ScaleIndicator zoom={1} pixelsPerUnit={50} unit="ft" />);
    expect(screen.getByText(/ft/)).toBeInTheDocument();
  });

  test('shows scale value scaled by zoom', () => {
    render(<ScaleIndicator zoom={2} pixelsPerUnit={50} unit="ft" />);
    expect(screen.getByText(/1\s*ft/)).toBeInTheDocument();
  });

  test('rounds non-integer zoom values for label', () => {
    const { container } = render(<ScaleIndicator zoom={0.5} pixelsPerUnit={50} unit="ft" />);
    expect(container.querySelector('.lk-scale-indicator')).not.toBeNull();
  });

  test('uses lk-scale-indicator class', () => {
    const { container } = render(<ScaleIndicator zoom={1} pixelsPerUnit={50} unit="ft" />);
    expect((container.firstChild as HTMLElement).className).toBe('lk-scale-indicator');
  });
});
