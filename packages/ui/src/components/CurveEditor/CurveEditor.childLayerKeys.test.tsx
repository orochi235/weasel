import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { CurveEditor, type ControlPoint } from './CurveEditor';
import { FunctionLayer } from './FunctionLayer';
import { functionLayerState } from './createFunctionLayer';

const POINTS: ControlPoint[] = [{ x: 0, y: 0.2 }, { x: 0.5, y: 0.5 }, { x: 1, y: 0.8 }];

describe('CurveEditor — a child function layer with the default id', () => {
  it('moves the child anchor an arrow key lands on, not the editor\'s own', () => {
    const own = vi.fn();
    const child = vi.fn();
    const { container } = render(
      <CurveEditor value={POINTS} onInput={own} width={200} height={100}>
        <FunctionLayer state={functionLayerState(POINTS)} onInput={child} />
      </CurveEditor>,
    );
    const groups = container.querySelectorAll('[data-layer-id]');
    expect(groups).toHaveLength(2);
    const childAnchor = groups[0].querySelector('[data-anchor-index="1"]')!;
    fireEvent.keyDown(childAnchor, { key: 'ArrowUp' });
    expect(own).not.toHaveBeenCalled();
    expect(child).toHaveBeenCalledTimes(1);
  });
});
