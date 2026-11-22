import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CurveEditor, type ControlPoint } from './CurveEditor';
import s from './CurveEditor.module.css';

const POINTS: ControlPoint[] = [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }];
const anchor = (i: number): Element => document.querySelectorAll('[data-anchor-index]')[i];

describe('CurveEditor — how a pinned endpoint looks', () => {
  it('styles a pinned-x endpoint, which still moves in y, as movable', () => {
    render(<CurveEditor value={POINTS} endpoints="pinned-x" width={200} height={100} />);
    expect(anchor(0)).not.toHaveClass(s.pinned);
    expect(anchor(2)).not.toHaveClass(s.pinned);
  });

  it('styles a pinned-both endpoint and a locked anchor as immovable', () => {
    render(<CurveEditor value={[POINTS[0], { ...POINTS[1], locked: true }, POINTS[2]]} endpoints="pinned-both" width={200} height={100} />);
    for (const i of [0, 1, 2]) expect(anchor(i)).toHaveClass(s.pinned);
  });
});
