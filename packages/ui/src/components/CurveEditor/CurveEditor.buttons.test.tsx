import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { CurveEditor, type AddPointMode } from './CurveEditor';

function setup(addPointMode: AddPointMode) {
  const onInput = vi.fn();
  const { container } = render(
    <CurveEditor
      value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
      onInput={onInput}
      addPointMode={addPointMode}
      width={200}
      height={100}
    />,
  );
  return { onInput, svg: container.querySelector('svg')!, anchors: () => container.querySelectorAll('[data-anchor-index]') };
}

describe('CurveEditor — buttons other than the primary one', () => {
  for (const button of [1, 2]) {
    it(`does not insert a point on the curve for button ${button}`, () => {
      const { onInput, svg, anchors } = setup('click-curve');
      fireEvent.pointerDown(svg, { clientX: 50, clientY: 75, pointerId: 1, button });
      expect(anchors()).toHaveLength(3);
      expect(onInput).not.toHaveBeenCalled();
    });

    it(`does not insert a point on empty plot for button ${button}`, () => {
      const { onInput, svg, anchors } = setup('click-empty');
      fireEvent.pointerDown(svg, { clientX: 50, clientY: 10, pointerId: 1, button });
      expect(anchors()).toHaveLength(3);
      expect(onInput).not.toHaveBeenCalled();
    });

    it(`does not drag an anchor for button ${button}`, () => {
      const { onInput, anchors } = setup('never');
      fireEvent.pointerDown(anchors()[1], { clientX: 100, clientY: 50, pointerId: 1, button, buttons: 1 });
      fireEvent.pointerMove(document, { clientX: 120, clientY: 30, pointerId: 1, buttons: 1 });
      expect(onInput).not.toHaveBeenCalled();
    });
  }
});
