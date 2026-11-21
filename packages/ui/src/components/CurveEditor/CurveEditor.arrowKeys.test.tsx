import { describe, expect, it } from 'vitest';
import { useState, type ReactElement } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { CurveEditor, type ControlPoint } from './CurveEditor';

function Controlled({ points, inverted }: { points: ControlPoint[]; inverted?: boolean }): ReactElement {
  const [value, setValue] = useState<ControlPoint[]>(points);
  const range = inverted ? ([1, 0] as const) : undefined;
  return <CurveEditor value={value} onInput={setValue} xRange={range} yRange={range} width={200} height={100} />;
}

const POINTS: ControlPoint[] = [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }];
const anchor = (i: number): Element => document.querySelectorAll('[data-anchor-index]')[i];
const at = (i: number) => ({ cx: Number(anchor(i).getAttribute('cx')), cy: Number(anchor(i).getAttribute('cy')) });

describe('CurveEditor — a focused point and the arrow keys', () => {
  it('says which keys move it, and only where it can move', () => {
    render(<Controlled points={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5, locked: true }, { x: 1, y: 1 }]} />);
    expect(anchor(0)).toHaveAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown ArrowLeft ArrowRight');
    expect(anchor(1)).not.toHaveAttribute('aria-keyshortcuts');
  });

  it.each([
    ['ArrowRight', 1, 0],
    ['ArrowLeft', -1, 0],
    ['ArrowDown', 0, 1],
    ['ArrowUp', 0, -1],
  ])('moves it with %s, on inverted axes too', (key, sx, sy) => {
    render(<Controlled points={POINTS} />);
    expectMove(key, sx, sy);
    cleanup();
    render(<Controlled points={POINTS} inverted />);
    expectMove(key, sx, sy);
  });

  function expectMove(key: string, sx: number, sy: number): void {
    const before = at(1);
    fireEvent.keyDown(anchor(1), { key });
    const after = at(1);
    expect(Math.sign(after.cx - before.cx)).toBe(sx);
    expect(Math.sign(after.cy - before.cy)).toBe(sy);
  }

  it('moves it ten times as far with Shift', () => {
    render(<Controlled points={POINTS} />);
    const start = at(1).cx;
    fireEvent.keyDown(anchor(1), { key: 'ArrowRight' });
    const one = at(1).cx - start;
    fireEvent.keyDown(anchor(1), { key: 'ArrowRight', shiftKey: true });
    expect(at(1).cx - start - one).toBeCloseTo(one * 10, 6);
  });

  it('takes back each key press as one undo step', () => {
    const { container } = render(<Controlled points={POINTS} />);
    const start = at(1);
    fireEvent.keyDown(anchor(1), { key: 'ArrowRight' });
    const once = at(1);
    fireEvent.keyDown(anchor(1), { key: 'ArrowUp' });
    const svg = container.querySelector('svg')!;
    fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
    expect(at(1)).toEqual(once);
    fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
    expect(at(1)).toEqual(start);
  });
});
