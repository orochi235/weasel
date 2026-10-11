import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Ruler } from './Ruler';
import type { TimeWindow } from './timeScale';

afterEach(cleanup);

function setup(window: TimeWindow) {
  const onWindowChange = vi.fn<(w: TimeWindow) => void>();
  const { getByTestId } = render(
    <div style={{ width: 500 }}>
      <Ruler window={window} bounds={{ from: 0, to: 1000 }} playhead={0} onScrub={() => {}} onWindowChange={onWindowChange} />
    </div>,
  );
  const ruler = getByTestId('timeline-ruler');
  const wheel = (init: WheelEventInit): boolean =>
    ruler.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init }));
  return { onWindowChange, wheel };
}

// Wheel listeners React registers are passive, so only a native one can keep
// the page from zooming or scrolling under the ruler.
test('a Ctrl-wheel zooms the window and not the page', () => {
  const { onWindowChange, wheel } = setup({ from: 0, to: 1000 });
  const notPrevented = wheel({ ctrlKey: true, deltaY: -100, clientX: 250 });
  expect(onWindowChange).toHaveBeenCalledTimes(1);
  expect(notPrevented).toBe(false);
});

test('a wheel pans the window and does not scroll the page', () => {
  const { onWindowChange, wheel } = setup({ from: 0, to: 500 });
  const notPrevented = wheel({ deltaY: 50 });
  expect(onWindowChange).toHaveBeenCalledTimes(1);
  expect(notPrevented).toBe(false);
});

test('a sideways swipe pans the window', () => {
  const { onWindowChange, wheel } = setup({ from: 0, to: 500 });
  wheel({ deltaX: 50, deltaY: 0 });
  expect(onWindowChange).toHaveBeenCalledWith({ from: 50, to: 550 });
});
