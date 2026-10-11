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
});
