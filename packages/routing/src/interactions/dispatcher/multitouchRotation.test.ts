import { describe, it, expect } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { Action } from '../actions/action';
import type { Contribution } from '../../contributions/types';
import type { InputEvent } from './matcher';
import { makeCtx, makeRegistry } from './testing/dispatcherStubs';

const MODS = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

const twoFingers = (angle: number): InputEvent =>
  ({ kind: 'multitouch', fingers: 2, centroid: { x: 0, y: 0 }, spread: 100, angle, ...MODS });

function setup() {
  const seen: Array<number | undefined> = [];
  const twist: Action = {
    id: 'twist', label: 'twist',
    invoker: {
      timing: 'ongoing',
      start: (ctx) => {
        seen.push(ctx.multiTouch?.rotation);
        return {
          onMove: (c) => { seen.push(c.multiTouch?.rotation); },
          onEnd: (c) => { seen.push(c.multiTouch?.rotation); },
        };
      },
    },
  };
  const entry: Contribution = {
    id: 'gestures', eligibility: { always: true },
    bindings: [{ spec: { kind: 'multiTouch', fingers: 2 }, actionId: 'twist' }],
  };
  const ctx = makeCtx({ actions: makeRegistry([twist]), entriesById: new Map([['gestures', entry]]) });
  return { seen, ctx, dispatcher: createDispatcher() };
}

describe('InvocationCtx.multiTouch.rotation', () => {
  it('is the degrees the two fingers have turned since the gesture began', () => {
    const { seen, ctx, dispatcher } = setup();
    dispatcher.handleInput(twoFingers(20), ctx);
    dispatcher.handleInput(twoFingers(50), ctx);
    dispatcher.handleInput(twoFingers(5), ctx);
    expect(seen).toEqual([0, 30, -15]);
  });

  it('keeps counting through the angle wrapping at 180 degrees', () => {
    const { seen, ctx, dispatcher } = setup();
    dispatcher.handleInput(twoFingers(100), ctx);
    dispatcher.handleInput(twoFingers(170), ctx);
    dispatcher.handleInput(twoFingers(-170), ctx);
    dispatcher.handleInput(twoFingers(-80), ctx);
    expect(seen).toEqual([0, 70, 90, 180]);
  });

  it('reports the turn so far on the event that ends the gesture, which carries no angle', () => {
    const { seen, ctx, dispatcher } = setup();
    dispatcher.handleInput(twoFingers(0), ctx);
    dispatcher.handleInput(twoFingers(45), ctx);
    dispatcher.handleInput({ kind: 'multitouch', fingers: 2, end: 'commit', ...MODS }, ctx);
    expect(seen).toEqual([0, 45, 45]);
  });
});
