import { describe, expect, it } from 'vitest';
import { useState, type ReactElement } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { CurveEditor, type ControlPoint } from './CurveEditor';

const POINTS: ControlPoint[] = [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }];

function Controlled(): ReactElement {
  const [value, setValue] = useState<ControlPoint[]>(POINTS);
  return <CurveEditor value={value} onInput={setValue} width={200} height={100} />;
}

describe('CurveEditor — a long press on an anchor', () => {
  it('deletes it, though its press began a drag', () => {
    render(<Controlled />);
    const anchor = document.querySelectorAll('[data-anchor-index]')[1]!;
    fireEvent.pointerDown(anchor, { clientX: 100, clientY: 50, button: 0, pointerId: 1, pointerType: 'touch' });
    const menu = fireEvent.contextMenu(anchor, { clientX: 100, clientY: 50 });
    expect(menu).toBe(false);
    expect(document.querySelectorAll('[data-anchor-index]')).toHaveLength(2);
    fireEvent.pointerUp(document, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.keyDown(document.querySelector('svg')!, { key: 'z', ctrlKey: true });
    expect(document.querySelectorAll('[data-anchor-index]')).toHaveLength(3);
  });
});
