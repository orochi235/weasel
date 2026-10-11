import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { CurveEditor } from './CurveEditor';

const INITIAL = [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }];

describe('CurveEditor — a canceled gesture', () => {
  it('puts a dragged anchor back and reports the points it started with', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const { container } = render(
      <CurveEditor value={INITIAL} onInput={onInput} onChange={onChange} width={200} height={100} />,
    );
    const middle = () => container.querySelectorAll('[data-anchor-index]')[1] as Element;
    const at = [middle().getAttribute('cx'), middle().getAttribute('cy')];
    fireEvent.pointerDown(middle(), { clientX: 100, clientY: 50, pointerId: 1, buttons: 1 });
    fireEvent.pointerMove(document, { clientX: 120, clientY: 30, pointerId: 1, buttons: 1 });
    expect(middle().getAttribute('cx')).not.toBe(at[0]);
    fireEvent.pointerCancel(document, { pointerId: 1 });
    expect([middle().getAttribute('cx'), middle().getAttribute('cy')]).toEqual(at);
    expect(onInput.mock.calls.at(-1)![0]).toEqual(INITIAL);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('takes back the point a canceled click on the curve inserted', () => {
    const onInput = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onInput={onInput}
        addPointMode="click-curve"
        width={200}
        height={100}
      />,
    );
    fireEvent.pointerDown(container.querySelector('svg')!, { clientX: 100, clientY: 50, pointerId: 1, buttons: 1 });
    expect(container.querySelectorAll('[data-anchor-index]')).toHaveLength(3);
    fireEvent.pointerCancel(document, { pointerId: 1 });
    expect(container.querySelectorAll('[data-anchor-index]')).toHaveLength(2);
    expect(onInput.mock.calls.at(-1)![0]).toHaveLength(2);
  });
});
