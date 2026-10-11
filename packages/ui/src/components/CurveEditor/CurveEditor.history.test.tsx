import { describe, expect, it } from 'vitest';
import { useState, type ReactElement } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { CurveEditor, type ControlPoint } from './CurveEditor';

function Controlled(): ReactElement {
  const [value, setValue] = useState<ControlPoint[]>([{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]);
  return <CurveEditor value={value} onInput={setValue} width={200} height={100} />;
}

const middle = (): Element => document.querySelectorAll('[data-anchor-index]')[1];

describe('CurveEditor — built-in undo', () => {
  it('does not spend an undo step on a click that moved nothing', () => {
    const { container } = render(<Controlled />);
    fireEvent.keyDown(middle(), { key: 'ArrowUp', shiftKey: true });
    const nudged = middle().getAttribute('cy');
    expect(nudged).not.toBe('50');
    fireEvent.pointerDown(middle(), { clientX: 100, clientY: Number(nudged), pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(document, { clientX: 100, clientY: Number(nudged), pointerId: 1 });
    fireEvent.keyDown(container.querySelector('svg')!, { key: 'z', metaKey: true });
    expect(middle().getAttribute('cy')).toBe('50');
  });

  it('keeps the last 100 steps and drops older ones', () => {
    const { container } = render(<Controlled />);
    const cy = (): number => Number(middle().getAttribute('cy'));
    // 101 edits, ending one nudge above where the point began.
    for (let i = 0; i < 101; i++) fireEvent.keyDown(middle(), { key: i % 2 === 0 ? 'ArrowUp' : 'ArrowDown' });
    const nudged = cy();
    expect(nudged).not.toBeCloseTo(50);
    const svg = container.querySelector('svg')!;
    fireEvent.keyDown(svg, { key: 'z', metaKey: true });
    expect(cy()).toBeCloseTo(50);
    // The oldest step is gone, so undoing everything stops one edit short of the start.
    for (let i = 0; i < 150; i++) fireEvent.keyDown(svg, { key: 'z', metaKey: true });
    expect(cy()).toBeCloseTo(nudged);
  });
});
