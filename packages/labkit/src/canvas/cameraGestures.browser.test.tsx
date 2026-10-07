import '../styles.less';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { CanvasStack } from './CanvasStack';
import type { CameraGestures } from './cameraGestures';
import { Stage } from './Stage';

// `touch-action` is what decides whether a finger scrolls the page, and only a
// browser resolves it from the stylesheet.

afterEach(cleanup);

const VIEW = { zoom: 1, pan: { x: 0, y: 0 } };

function touchActions(gestures?: CameraGestures): string[] {
  const { container } = render(
    <>
      <Stage
        size={{ width: 10, height: 10 }}
        view={VIEW}
        onViewChange={() => {}}
        gestures={gestures}
      />
      <CanvasStack layers={[]} view={VIEW} onViewChange={() => {}} gestures={gestures} />
    </>,
  );
  return [...container.querySelectorAll('.lk-stage, .lk-canvas-stack')].map(
    (el) => getComputedStyle(el).touchAction,
  );
}

test('a camera that pans takes every touch', () => {
  expect(touchActions()).toEqual(['none', 'none']);
});

test('a camera that does not pan lets one finger scroll the page and keeps the pinch', () => {
  expect(touchActions({ pan: false })).toEqual(['pan-x pan-y', 'pan-x pan-y']);
});

test('a camera that takes no touch leaves it all to the browser', () => {
  expect(touchActions({ pan: false, pinch: false })).toEqual(['auto', 'auto']);
});
