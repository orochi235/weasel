import { describe, it, expect, vi } from 'vitest';
import { createScene } from 'core/scene/scene';
import {
  closeGesture,
  readGestureLifecycle,
  reduceBehaviorEnd,
  runBehaviorCancel,
  runBehaviorSettled,
} from './gestureLifecycle';
import type { BehaviorEnd } from '../gestures/types';

const refuse = (): never => { throw new Error('refused'); };

describe('reduceBehaviorEnd', () => {
  it('hands every onEnd the action\'s own end fields beside `answered`', () => {
    interface End extends BehaviorEnd { tag: string }
    const seen: End[] = [];
    const behaviors = [
      { onEnd: (_ctx: null, end: End) => { seen.push(end); return []; } },
      { onEnd: (_ctx: null, end: End) => { seen.push(end); } },
    ];
    reduceBehaviorEnd(behaviors, null, { tag: 'mine' });
    expect(seen).toEqual([{ tag: 'mine', answered: false }, { tag: 'mine', answered: true }]);
  });
});

describe('runBehaviorSettled', () => {
  it('runs the behaviors after one that throws, then rethrows the first error', () => {
    const later = vi.fn();
    const behaviors = [
      { onSettled: refuse },
      { onSettled: later },
      { onSettled: () => { throw new Error('second'); } },
    ];
    expect(() => runBehaviorSettled(behaviors, 'ctx', true)).toThrow('refused');
    expect(later).toHaveBeenCalledWith('ctx', true);
  });
});

describe('runBehaviorCancel', () => {
  it('runs the behaviors after one that throws, then rethrows the first error', () => {
    const later = vi.fn();
    const behaviors = [
      { onCancel: refuse },
      { onCancel: later },
      { onCancel: () => { throw new Error('second'); } },
    ];
    expect(() => runBehaviorCancel(behaviors, 'ctx')).toThrow('refused');
    expect(later).toHaveBeenCalledWith('ctx');
  });
});

describe('closeGesture', () => {
  function closing(onSettled: (ctx: string, committed: boolean) => void, onGestureEnd: (committed: boolean) => void) {
    const scene = createScene<object, 'main', unknown>({ systemLayers: [{ id: 'main' }] });
    const lifecycle = readGestureLifecycle({ onGestureEnd }, 'Test');
    lifecycle.start([]);
    return {
      publish: { scene: scene as never, previews: new Map(), overrideEntries: new Map() },
      behaviors: [{ onSettled }],
      ctx: 'ctx',
      lifecycle,
    };
  }

  it('still tells the behaviors and fires onGestureEnd when the settle callback throws', () => {
    const onSettled = vi.fn();
    const onGestureEnd = vi.fn();
    expect(() => closeGesture(closing(onSettled, onGestureEnd), true, refuse)).toThrow('refused');
    expect(onSettled).toHaveBeenCalledWith('ctx', true);
    expect(onGestureEnd).toHaveBeenCalledWith(true);
  });

  it('still fires onGestureEnd when a behavior\'s onSettled throws', () => {
    const onGestureEnd = vi.fn();
    expect(() => closeGesture(closing(refuse, onGestureEnd), false)).toThrow('refused');
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });
});
