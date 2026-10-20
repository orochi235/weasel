// A long task between two inputs delays the second one's handling, not the
// input itself: windows between two inputs are measured on their own stamps.
import { describe, expect, it } from 'vitest';
import { createPointerRecognizer } from './pointerRecognizer';
import type { PointerSample } from './samples';
import { DOUBLE_CLICK_MAX_MS, LONG_PRESS_MS } from './thresholds';

const MODS = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

function harness() {
  let t = 0;
  const kinds: string[] = [];
  const recognizer = createPointerRecognizer({
    clock: { now: () => t, setTimer: () => 0, clearTimer: () => {} },
    sink: {
      dispatch: (ev) => { kinds.push(ev.kind); return 'unhandled'; },
      multiTouchInFlight: () => false,
    },
  });
  const at = (pointerId: number, x: number, timeStamp?: number): PointerSample => ({
    pointerId, clientX: x, clientY: 0, ...MODS, ...(timeStamp !== undefined ? { timeStamp } : {}),
  });
  const press = (pointerId: number, x: number, pointerType: string, timeStamp?: number): void => {
    recognizer.press({ ...at(pointerId, x, timeStamp), x, y: 0, pointerType });
  };
  /** A click whose press and release both happened at `timeStamp`, handled now. */
  const click = (timeStamp?: number): void => {
    press(1, 0, 'mouse', timeStamp);
    recognizer.release(at(1, 0, timeStamp));
  };
  return {
    recognizer, kinds, at, press, click,
    /** Move the handling clock to `ms`. */
    handleAt: (ms: number) => { t = ms; },
  };
}

describe('the double-click window', () => {
  it('is measured between the clicks as they happened, however late the second is handled', () => {
    const h = harness();
    h.handleAt(1000);
    h.click(1000);
    h.handleAt(1000 + DOUBLE_CLICK_MAX_MS + 400);
    h.click(1300);
    expect(h.kinds).toContain('doubleclick');
  });

  it('still shuts on two clicks that happened too far apart, though handled together', () => {
    const h = harness();
    h.handleAt(5000);
    h.click(1000);
    h.click(1000 + DOUBLE_CLICK_MAX_MS);
    expect(h.kinds).not.toContain('doubleclick');
  });

  it.each([
    ['missing', undefined],
    ['zero', 0],
    // jsdom stamps events with Date.now(), not on performance.now()'s origin.
    ['ahead of the clock', 1.7e12],
  ])('is measured when each click is handled when its stamp is %s', (_name, stamp) => {
    const h = harness();
    h.handleAt(1000);
    h.click(stamp);
    h.handleAt(1000 + DOUBLE_CLICK_MAX_MS + 400);
    h.click(stamp);
    expect(h.kinds).not.toContain('doubleclick');
  });
});

describe('a multitouch tap', () => {
  it('is timed from the fingers landing to the lift as they happened', () => {
    const h = harness();
    h.handleAt(1000);
    h.press(1, 0, 'touch', 1000);
    h.press(2, 40, 'touch', 1000);
    h.handleAt(1000 + LONG_PRESS_MS + 400);
    h.recognizer.release(h.at(1, 0, 1100));
    expect(h.kinds).toContain('multitouchtap');
  });

  it('is not one when the lift happened a long-press after the landing', () => {
    const h = harness();
    h.handleAt(1000);
    h.press(1, 0, 'touch', 100);
    h.press(2, 40, 'touch', 100);
    h.recognizer.release(h.at(1, 0, 100 + LONG_PRESS_MS));
    expect(h.kinds).not.toContain('multitouchtap');
  });
});
