import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { CanvasStackContext } from '../canvas/CanvasStackContext';
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

  test('rounds bar to a nice number when target spans multiple units', () => {
    // zoom=0.5, pixelsPerUnit=50 → effective 25 px/unit → 100px ≈ 4 units → niceNumber → 5
    render(<ScaleIndicator zoom={0.5} pixelsPerUnit={50} unit="ft" />);
    expect(screen.getByText(/5\s*ft/)).toBeInTheDocument();
  });

  test('uses lk-scale-indicator class', () => {
    const { container } = render(<ScaleIndicator zoom={1} pixelsPerUnit={50} unit="ft" />);
    expect((container.firstChild as HTMLElement).className).toBe('lk-scale-indicator');
  });

  test('reads zoom from CanvasStackContext when prop omitted', () => {
    render(
      <CanvasStackContext.Provider value={{ view: { zoom: 2.5, pan: { x: 0, y: 0 } } }}>
        <ScaleIndicator pixelsPerUnit={50} unit="ft" />
      </CanvasStackContext.Provider>,
    );
    // zoom 2.5 × 50 = 125 px/unit → niceNumber(100/125 = 0.8) → 1
    expect(screen.getByText(/1\s*ft/)).toBeInTheDocument();
  });

  test('explicit zoom prop overrides context', () => {
    render(
      <CanvasStackContext.Provider value={{ view: { zoom: 100, pan: { x: 0, y: 0 } } }}>
        <ScaleIndicator zoom={1} pixelsPerUnit={50} unit="ft" />
      </CanvasStackContext.Provider>,
    );
    expect(screen.getByText(/2\s*ft/)).toBeInTheDocument();
  });
});
