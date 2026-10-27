import { describe, expect, it } from 'vitest';
import type { InputEvent } from '../ui/inputEvent';
import { DRAG_THRESHOLD_PX } from '../ui/dragThreshold';
import { createPointerRecognizer, type PointerRecognizerOptions } from './pointerRecognizer';
import type { HeldPress } from './longPressHold';
import type { PointerSample, PressSample } from './samples';
import { DOUBLE_CLICK_MAX_MS, DOUBLE_CLICK_MAX_PX, LONG_PRESS_MS, TAP_THRESHOLD_PX } from './thresholds';

const MODS = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

/** A clock that only moves when told to, firing the timers it passes. */
function fakeClock() {
  let t = 0;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => t,
    setTimer: (fn: () => void, ms: number) => { timers.set(++seq, { at: t + ms, fn }); return seq; },
    clearTimer: (id: unknown) => { timers.delete(id as number); },
    advance(ms: number) {
      t += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at > t) continue;
        timers.delete(id);
        timer.fn();
      }
    },
    pending: () => timers.size,
  };
}

function harness(opts: {
  /** Event kinds the sink answers `'handled'` to. */
  handles?: string[];
  inFlight?: () => number[];
  more?: Partial<PointerRecognizerOptions>;
} = {}) {
  const clock = fakeClock();
  const events: InputEvent[] = [];
  const log: string[] = [];
  const holds: (HeldPress | null)[] = [];
  const recognizer = createPointerRecognizer({
    clock,
    toWorld: (x, y) => ({ x: x + 100, y: y + 100 }),
    sink: {
      dispatch: (ev) => {
        events.push(ev);
        log.push(ev.kind === 'pointerdown' && ev.stage === 'press' ? 'press' : ev.kind);
        return opts.handles?.includes(ev.kind) ? 'handled' : 'unhandled';
      },
      multiTouchInFlight: (fingers) => opts.inFlight?.().includes(fingers) ?? false,
    },
    observer: {
      click: () => { log.push('observed:click'); },
      doubleClick: () => { log.push('observed:doubleclick'); },
      holdChanged: (pending) => { holds.push(pending); },
      longPress: (type) => { log.push(`haptic:${type}`); },
    },
    ...opts.more,
  });
  const at = (pointerId: number, x: number, y = 0): PointerSample => (
    { pointerId, clientX: x, clientY: y, ...MODS }
  );
  const down = (pointerId: number, x: number, more: Partial<PressSample> = {}): void => {
    recognizer.press({ ...at(pointerId, x), x: x + 100, y: 100, pointerType: 'mouse', ...more });
  };
  const click = (x = 0): ReturnType<typeof recognizer.release> => {
    down(1, x);
    return recognizer.release(at(1, x));
  };
  return { recognizer, clock, events, log, holds, at, down, click, kinds: () => log.filter((l) => !l.includes(':')) };
}

describe('a press', () => {
  it('dispatches at once, staged, and is otherwise held back', () => {
    const h = harness();
    h.down(1, 0);
    expect(h.log).toEqual(['press']);
  });

  it('carries what it landed on, in both spaces', () => {
    const h = harness();
    h.down(1, 3, { affordance: 'handle', bodyTarget: 'empty', bodyKind: 'rect', pressure: 0.4 });
    expect(h.events[0]).toEqual({
      kind: 'pointerdown', stage: 'press', target: undefined, pointerId: 1,
      x: 103, y: 100, clientX: 3, clientY: 0, ...MODS,
      pressure: 0.4, affordance: 'handle', bodyTarget: 'empty', bodyKind: 'rect',
    });
  });

  it('stays buffered while the pointer keeps under the drag threshold', () => {
    const h = harness();
    h.down(1, 0);
    h.recognizer.move(h.at(1, DRAG_THRESHOLD_PX - 1));
    expect(h.kinds()).toEqual(['press', 'pointermove']);
  });

  it('goes out ahead of the move that crosses the threshold, and only once', () => {
    const h = harness();
    h.down(1, 0);
    h.recognizer.move(h.at(1, DRAG_THRESHOLD_PX));
    h.recognizer.move(h.at(1, DRAG_THRESHOLD_PX * 3));
    expect(h.kinds()).toEqual(['press', 'pointerdown', 'pointermove', 'pointermove']);
    expect(h.events[1]).toMatchObject({ kind: 'pointerdown', clientX: 0, x: 100 });
    expect(h.events[1]).not.toHaveProperty('stage');
  });
});

describe('a release', () => {
  it('clicks when the press never crossed the threshold, at the release with the press point alongside', () => {
    const h = harness();
    h.down(1, 0, { bodyTarget: 'empty' });
    h.recognizer.release(h.at(1, 2));
    expect(h.log).toEqual(['press', 'pointerup', 'click', 'observed:click']);
    expect(h.events[2]).toEqual({
      kind: 'click', target: undefined, x: 102, y: 100, clientX: 2, clientY: 0,
      pressX: 100, pressY: 100, bodyTarget: 'empty', ...MODS,
    });
  });

  it('does not click once the press became a drag, wherever it ends', () => {
    const h = harness();
    h.down(1, 0);
    h.recognizer.move(h.at(1, 50));
    h.recognizer.release(h.at(1, 0));
    expect(h.kinds()).toEqual(['press', 'pointerdown', 'pointermove', 'pointerup']);
  });

  // The buffer alone decides: nothing asks the sink whether a drag is in flight.
  it('clicks though the sink reports every gesture in flight', () => {
    const h = harness({ handles: ['pointerup'], inFlight: () => [1, 2, 3] });
    h.click();
    expect(h.kinds()).toContain('click');
  });
});

describe('a double click', () => {
  it('follows a second click, observed before it is dispatched', () => {
    const h = harness({ handles: ['doubleclick'] });
    expect(h.click()).toEqual({});
    expect(h.click()).toEqual({ doubleClick: 'handled' });
    expect(h.log.slice(-4)).toEqual(['click', 'observed:click', 'observed:doubleclick', 'doubleclick']);
  });

  it('reports one nothing handled', () => {
    const h = harness();
    h.click();
    expect(h.click()).toEqual({ doubleClick: 'unhandled' });
  });

  it('needs the second click inside the window', () => {
    const late = harness();
    late.click();
    late.clock.advance(DOUBLE_CLICK_MAX_MS);
    late.click();
    expect(late.kinds()).not.toContain('doubleclick');

    const inTime = harness();
    inTime.click();
    inTime.clock.advance(DOUBLE_CLICK_MAX_MS - 1);
    inTime.click();
    expect(inTime.kinds()).toContain('doubleclick');
  });

  it('needs the second click close to the first', () => {
    const far = harness();
    far.click(0);
    far.click(DOUBLE_CLICK_MAX_PX);
    expect(far.kinds()).not.toContain('doubleclick');

    const near = harness();
    near.click(0);
    near.click(DOUBLE_CLICK_MAX_PX - 1);
    expect(near.kinds()).toContain('doubleclick');
  });

  it('starts over afterwards, so a third click composes nothing', () => {
    const h = harness();
    h.click();
    h.click();
    h.click();
    expect(h.kinds().filter((k) => k === 'doubleclick')).toHaveLength(1);
  });

  it('lands on what the press says a double-click names, where the click keeps the hit', () => {
    const h = harness();
    const press = {
      bodyTarget: 'unselected-body', bodyKind: 'path',
      doubleClickBody: { bodyTarget: 'unselected-body', bodyKind: 'group' },
    } as const;
    for (let i = 0; i < 2; i++) {
      h.down(1, 0, press);
      h.recognizer.release(h.at(1, 0));
    }
    const click = h.events.find((e) => e.kind === 'click');
    const double = h.events.find((e) => e.kind === 'doubleclick');
    expect(click).toMatchObject({ bodyKind: 'path' });
    expect(double).toMatchObject({ bodyTarget: 'unselected-body', bodyKind: 'group' });
  });

  it('spans two recognizers that share a click memory', () => {
    const clicks = { last: null };
    harness({ more: { clicks } }).click();
    const second = harness({ more: { clicks } });
    second.click();
    expect(second.kinds()).toContain('doubleclick');
  });
});

describe('a long-press', () => {
  const touch = { pointerType: 'touch' };

  it('fires after the hold for touch and pen, and never for a mouse', () => {
    for (const [pointerType, fires] of [['touch', true], ['pen', true], ['mouse', false]] as const) {
      const h = harness();
      h.down(1, 0, { pointerType });
      h.clock.advance(LONG_PRESS_MS - 1);
      expect(h.kinds()).toEqual(['press']);
      h.clock.advance(1);
      expect(h.kinds().includes('longpress')).toBe(fires);
    }
  });

  it('holds for the duration it is given', () => {
    const h = harness({ more: { longPressMs: () => 200 } });
    h.down(1, 0, touch);
    h.clock.advance(200);
    expect(h.kinds()).toContain('longpress');
  });

  it('handled, spends the press: no click on release, no drag on a later move', () => {
    const h = harness({ handles: ['longpress'] });
    h.down(1, 0, touch);
    h.clock.advance(LONG_PRESS_MS);
    h.recognizer.move(h.at(1, 50));
    h.recognizer.release(h.at(1, 50));
    expect(h.log).toEqual(['press', 'longpress', 'haptic:touch', 'pointermove', 'pointerup']);
  });

  it('unhandled, falls back to a contextmenu at the press, which spends it the same way', () => {
    const h = harness({ handles: ['contextmenu'] });
    h.down(1, 7, touch);
    h.clock.advance(LONG_PRESS_MS);
    h.recognizer.release(h.at(1, 7));
    expect(h.log).toEqual(['press', 'longpress', 'contextmenu', 'haptic:touch', 'pointerup']);
    expect(h.events[2]).toMatchObject({ kind: 'contextmenu', clientX: 7, x: 107 });
  });

  it('that nothing handled leaves the press to click', () => {
    const h = harness();
    h.down(1, 0, touch);
    h.clock.advance(LONG_PRESS_MS);
    h.recognizer.release(h.at(1, 0));
    expect(h.log).toEqual(['press', 'longpress', 'contextmenu', 'pointerup', 'click', 'observed:click']);
  });

  it('is abandoned by a drag, a release, a cancel, and a second pointer', () => {
    const abandon: ((h: ReturnType<typeof harness>) => void)[] = [
      (h) => { h.recognizer.move(h.at(1, DRAG_THRESHOLD_PX)); },
      (h) => { h.recognizer.release(h.at(1, 0)); },
      (h) => { h.recognizer.cancel(1); },
      (h) => { h.down(2, 30, touch); },
    ];
    for (const how of abandon) {
      const h = harness();
      h.down(1, 0, touch);
      how(h);
      expect(h.clock.pending()).toBe(0);
      expect(h.holds.at(-1)).toBeNull();
      h.clock.advance(LONG_PRESS_MS);
      expect(h.kinds()).not.toContain('longpress');
    }
  });

  it('reports the press being held, and its end when it fires', () => {
    const h = harness();
    h.clock.advance(40);
    h.down(1, 5, touch);
    expect(h.holds).toEqual([{
      pointerId: 1, pointerType: 'touch', startedAt: 40, duration: LONG_PRESS_MS,
      press: { target: undefined, clientX: 5, clientY: 0, world: { x: 105, y: 100 }, ...MODS },
    }]);
    h.clock.advance(LONG_PRESS_MS);
    expect(h.holds).toHaveLength(2);
    expect(h.holds[1]).toBeNull();
  });

  it('taken early fires once, and the hold still counts as held afterwards', () => {
    const h = harness({ handles: ['longpress'] });
    h.down(1, 0, touch);
    expect(h.recognizer.takeHold()).toBe(true);
    expect(h.recognizer.takeHold()).toBe(true);
    h.clock.advance(LONG_PRESS_MS);
    expect(h.kinds().filter((k) => k === 'longpress')).toHaveLength(1);
    h.recognizer.release(h.at(1, 0));
    expect(h.recognizer.takeHold()).toBe(false);
  });

  it('is not there to take for a mouse', () => {
    const h = harness();
    h.down(1, 0);
    expect(h.recognizer.takeHold()).toBe(false);
  });
});

describe('two fingers', () => {
  const touch = { pointerType: 'touch' };

  it('start a multitouch gesture with its centroid and spread, and withhold the second press', () => {
    const h = harness();
    h.down(1, 0, touch);
    h.down(2, 40, touch);
    expect(h.kinds()).toEqual(['press', 'multitouch']);
    expect(h.events[1]).toEqual({ kind: 'multitouch', fingers: 2, centroid: { x: 20, y: 0 }, spread: 40, angle: 0, ...MODS });
  });

  it('report the centroid in the space the host maps to', () => {
    const h = harness({ more: { toSurface: (p) => ({ x: p.x - 10, y: p.y - 5 }) } });
    h.down(1, 0, touch);
    h.down(2, 40, touch);
    expect(h.events[1]).toMatchObject({ centroid: { x: 10, y: -5 }, spread: 40 });
  });

  it('claim both presses: neither opens a drag nor clicks', () => {
    const h = harness();
    h.down(1, 0, touch);
    h.down(2, 40, touch);
    h.recognizer.move(h.at(1, -30));
    h.recognizer.release(h.at(1, -30));
    h.recognizer.release(h.at(2, 40));
    expect(h.kinds()).not.toContain('pointerdown');
    expect(h.kinds()).not.toContain('click');
  });

  it('leave alone a drag one of them had already opened', () => {
    const h = harness();
    h.down(1, 0, touch);
    h.recognizer.move(h.at(1, 20));
    h.down(2, 60, touch);
    h.recognizer.move(h.at(1, 30));
    expect(h.kinds()).toEqual(['press', 'pointerdown', 'pointermove', 'multitouch', 'pointermove']);
  });

  it('pump the gesture on each move while the sink has it in flight, ahead of the move', () => {
    const h = harness({ inFlight: () => [2] });
    h.down(1, 0, touch);
    h.down(2, 40, touch);
    h.recognizer.move(h.at(2, 80));
    expect(h.kinds().slice(2)).toEqual(['multitouch', 'pointermove']);
    expect(h.events[2]).toEqual({ kind: 'multitouch', fingers: 2, centroid: { x: 40, y: 0 }, spread: 80, angle: 0, ...MODS });
  });

  it('report the angle of the line from the first finger to the second, clockwise on screen', () => {
    const h = harness({ inFlight: () => [2] });
    h.down(1, 0, touch);
    h.down(2, 40, touch);
    expect(h.events[1]).toMatchObject({ angle: 0 });
    h.recognizer.move(h.at(2, 0, 40));
    expect(h.events[2]).toMatchObject({ kind: 'multitouch', angle: 90 });
    h.recognizer.move(h.at(2, -40, 0));
    expect(h.events[4]).toMatchObject({ kind: 'multitouch', angle: 180 });
  });

  it('place the move where the pump left the view, not where it was before', () => {
    let offset = 0;
    const events: InputEvent[] = [];
    const recognizer = createPointerRecognizer({
      clock: fakeClock(),
      toWorld: (x, y) => ({ x: x + offset, y }),
      sink: {
        dispatch: (ev) => {
          events.push(ev);
          if (ev.kind === 'multitouch' && ev.centroid && events.length > 2) offset = 1000;
          return 'unhandled';
        },
        multiTouchInFlight: () => true,
      },
    });
    const sample = (pointerId: number, x: number) => ({ pointerId, clientX: x, clientY: 0, ...MODS });
    recognizer.press({ ...sample(1, 0), x: 0, y: 0, pointerType: 'touch' });
    recognizer.press({ ...sample(2, 40), x: 40, y: 0, pointerType: 'touch' });
    recognizer.move(sample(2, 80));
    expect(events.at(-1)).toMatchObject({ kind: 'pointermove', clientX: 80, x: 1080 });
  });

  it('pump nothing while the sink has no such gesture in flight', () => {
    const h = harness({ inFlight: () => [3] });
    h.down(1, 0, touch);
    h.down(2, 40, touch);
    h.recognizer.move(h.at(2, 80));
    expect(h.kinds().slice(2)).toEqual(['pointermove']);
  });

  it('end the gesture as a commit when either lifts, and as a cancel when either is canceled', () => {
    const lifted = harness();
    lifted.down(1, 0, touch);
    lifted.down(2, 40, touch);
    lifted.recognizer.move(lifted.at(2, 90));
    lifted.recognizer.release(lifted.at(2, 90));
    expect(lifted.events.at(-2)).toEqual({ kind: 'multitouch', fingers: 2, end: 'commit', ...MODS });
    expect(lifted.kinds().at(-1)).toBe('pointerup');

    const canceled = harness();
    canceled.down(1, 0, touch);
    canceled.down(2, 40, touch);
    canceled.recognizer.cancel(2);
    expect(canceled.events.slice(-2)).toEqual([
      { kind: 'multitouch', fingers: 2, end: 'cancel', ...MODS },
      { kind: 'pointercancel', pointerId: 2, ...MODS },
    ]);
  });
});

describe('a multitouch tap', () => {
  const touch = { pointerType: 'touch' };
  const twoDown = (h: ReturnType<typeof harness>): void => {
    h.down(1, 0, touch);
    h.down(2, 40, touch);
  };

  it('fires when the fingers land and lift in place, between the gesture end and the release', () => {
    const h = harness();
    twoDown(h);
    h.recognizer.release(h.at(1, 0));
    expect(h.kinds().slice(2)).toEqual(['multitouch', 'multitouchtap', 'pointerup']);
    expect(h.events[3]).toEqual({ kind: 'multitouchtap', fingers: 2, ...MODS });
  });

  it('carries the most fingers that were down', () => {
    const h = harness();
    twoDown(h);
    h.down(3, 80, touch);
    h.recognizer.release(h.at(3, 80));
    h.recognizer.release(h.at(2, 40));
    expect(h.events.filter((e) => e.kind === 'multitouchtap')).toEqual([{ kind: 'multitouchtap', fingers: 3, ...MODS }]);
  });

  it('does not fire once a finger has moved past the tap threshold, even about a still center', () => {
    const h = harness();
    twoDown(h);
    h.recognizer.move(h.at(1, -(TAP_THRESHOLD_PX + 1)));
    h.recognizer.move(h.at(2, 40 + TAP_THRESHOLD_PX + 1));
    h.recognizer.release(h.at(1, -(TAP_THRESHOLD_PX + 1)));
    expect(h.kinds()).not.toContain('multitouchtap');
  });

  it('survives a finger moving up to the tap threshold', () => {
    const h = harness();
    twoDown(h);
    h.recognizer.move(h.at(1, -TAP_THRESHOLD_PX));
    h.recognizer.release(h.at(1, -TAP_THRESHOLD_PX));
    expect(h.kinds()).toContain('multitouchtap');
  });

  it('does not fire after a rest as long as a long-press', () => {
    const rested = harness();
    twoDown(rested);
    rested.clock.advance(LONG_PRESS_MS);
    rested.recognizer.release(rested.at(1, 0));
    expect(rested.kinds()).not.toContain('multitouchtap');

    const brief = harness();
    twoDown(brief);
    brief.clock.advance(LONG_PRESS_MS - 1);
    brief.recognizer.release(brief.at(1, 0));
    expect(brief.kinds()).toContain('multitouchtap');
  });

  it('does not fire once one of the fingers was canceled', () => {
    const h = harness();
    twoDown(h);
    h.down(3, 80, touch);
    h.recognizer.cancel(3);
    h.recognizer.release(h.at(2, 40));
    expect(h.kinds()).not.toContain('multitouchtap');
  });
});

describe('held pointers', () => {
  it('are counted and located until released, canceled or reset', () => {
    const h = harness();
    h.down(1, 0);
    h.recognizer.move(h.at(1, 2, 3));
    expect(h.recognizer.heldCount()).toBe(1);
    expect(h.recognizer.positionOf(1)).toEqual({ x: 2, y: 3 });
    h.recognizer.reset();
    expect(h.recognizer.heldCount()).toBe(0);
    expect(h.recognizer.positionOf(1)).toBeUndefined();
  });

  it('a reset dispatches nothing and stops the hold', () => {
    const h = harness();
    h.down(1, 0, { pointerType: 'touch' });
    h.recognizer.reset();
    h.clock.advance(LONG_PRESS_MS);
    expect(h.kinds()).toEqual(['press']);
  });

  it('a cancel of a pointer that is not held dispatches nothing', () => {
    const h = harness();
    h.recognizer.cancel(9);
    expect(h.log).toEqual([]);
  });

  it('a move of a pointer that is not held is still a move', () => {
    const h = harness();
    h.recognizer.move(h.at(1, 5));
    expect(h.kinds()).toEqual(['pointermove']);
  });
});

describe('thresholds read through options', () => {
  it('takes the double-click window from doubleClickMs, read at each click', () => {
    let ms: number | undefined = 100;
    const h = harness({ more: { doubleClickMs: () => ms } });
    h.click();
    h.clock.advance(100);
    h.click();
    expect(h.kinds()).not.toContain('doubleclick');

    ms = undefined;
    h.clock.advance(DOUBLE_CLICK_MAX_MS);
    h.click();
    h.clock.advance(DOUBLE_CLICK_MAX_MS - 1);
    h.click();
    expect(h.kinds()).toContain('doubleclick');
  });

  it('takes the double-click distance from doubleClickPx', () => {
    const h = harness({ more: { doubleClickPx: () => 20 } });
    h.click(0);
    h.click(DOUBLE_CLICK_MAX_PX + 5);
    expect(h.kinds()).toContain('doubleclick');
  });

  it('takes the drag threshold from dragPx', () => {
    const h = harness({ more: { dragPx: () => 20 } });
    h.down(1, 0);
    h.recognizer.move(h.at(1, 19));
    expect(h.kinds()).toEqual(['press', 'pointermove']);
    h.recognizer.move(h.at(1, 20));
    expect(h.kinds()).toEqual(['press', 'pointermove', 'pointerdown', 'pointermove']);
  });

  it('takes the multitouch tap travel from tapPx', () => {
    const touch = { pointerType: 'touch' } as const;
    const tight = harness({ more: { tapPx: () => 2 } });
    tight.down(1, 0, touch);
    tight.down(2, 40, touch);
    tight.recognizer.move(tight.at(1, -3));
    tight.recognizer.release(tight.at(1, -3));
    expect(tight.kinds()).not.toContain('multitouchtap');

    const wide = harness({ more: { tapPx: () => 30 } });
    wide.down(1, 0, touch);
    wide.down(2, 40, touch);
    wide.recognizer.move(wide.at(1, -(TAP_THRESHOLD_PX + 1)));
    wide.recognizer.move(wide.at(2, 40 + TAP_THRESHOLD_PX + 1));
    wide.recognizer.release(wide.at(1, -(TAP_THRESHOLD_PX + 1)));
    expect(wide.kinds()).toContain('multitouchtap');
  });
});
