import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CurveEditor, type ControlPoint } from './CurveEditor';

describe('CurveEditor — rendering', () => {
  it('renders an SVG with the configured width and height', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        width={200}
        height={100}
      />,
    );
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('width')).toBe('200');
    expect(svg!.getAttribute('height')).toBe('100');
  });

  it('renders one circle per control point', () => {
    const value: ControlPoint[] = [
      { x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 },
    ];
    const { container } = render(
      <CurveEditor value={value} onChange={() => {}} width={200} height={100} />,
    );
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(3);
  });

  it('renders a path element for the curve when there are >= 2 anchors', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        width={200}
        height={100}
      />,
    );
    const path = container.querySelector('path');
    expect(path).not.toBeNull();
    expect(path!.getAttribute('d')).toMatch(/^M/);
  });

  it('renders no path when fewer than 2 anchors', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0.5, y: 0.5 }]}
        onChange={() => {}}
        width={200}
        height={100}
      />,
    );
    expect(container.querySelector('path')).toBeNull();
    expect(container.querySelectorAll('circle').length).toBe(1);
  });
});
