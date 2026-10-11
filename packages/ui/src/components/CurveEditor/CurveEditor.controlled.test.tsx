import { describe, expect, it } from 'vitest';
import { useState, type ReactElement } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { CurveEditor, type ControlPoint } from './CurveEditor';

const INITIAL: ControlPoint[] = [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }];

const middle = (): Element => document.querySelectorAll('[data-anchor-index]')[1];
const dragMiddle = (x: number, y: number): void => {
  fireEvent.pointerDown(middle(), { clientX: 100, clientY: 50, pointerId: 1, buttons: 1 });
  fireEvent.pointerMove(document, { clientX: x, clientY: y, pointerId: 1, buttons: 1 });
  fireEvent.pointerUp(document, { clientX: x, clientY: y, pointerId: 1 });
};

function Rounding(): ReactElement {
  const [value, setValue] = useState(INITIAL);
  return (
    <CurveEditor
      value={value}
      onInput={(next) => setValue(next.map((p) => ({ ...p, y: Math.round(p.y * 4) / 4 })))}
      width={200}
      height={100}
    />
  );
}

describe('CurveEditor — value is the source of truth between gestures', () => {
  it('draws the value again after a drag the consumer declined', () => {
    render(<CurveEditor value={INITIAL} onInput={() => {}} width={200} height={100} />);
    dragMiddle(120, 30);
    expect([middle().getAttribute('cx'), middle().getAttribute('cy')]).toEqual(['100', '50']);
  });

  it('draws the value the consumer normalized once the drag ends', () => {
    render(<Rounding />);
    dragMiddle(100, 32);
    expect(Number(middle().getAttribute('cy'))).toBeCloseTo(25);
  });

  it('follows the pointer, not the value, while the drag is live', () => {
    render(<Rounding />);
    fireEvent.pointerDown(middle(), { clientX: 100, clientY: 50, pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 100, clientY: 32, pointerId: 1, buttons: 1 });
    expect(Number(middle().getAttribute('cy'))).toBeCloseTo(32);
    fireEvent.pointerUp(document, { clientX: 100, clientY: 32, pointerId: 1 });
  });
});
