/** Every event with a world point puts it in `InvocationCtx.world`. */
import { describe, expect, it } from 'vitest';
import { buildInvocationCtx } from './invocationCtx';
import { worldPointOf } from './inputFacts';
import type { InputEvent } from './matcher';

const MODS = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

describe('buildInvocationCtx world', () => {
  it.each<InputEvent>([
    { kind: 'longpress', x: 30, y: 40, clientX: 3, clientY: 4, ...MODS },
    { kind: 'drop', items: [], x: 30, y: 40, ...MODS },
    { kind: 'hover', x: 30, y: 40, ...MODS },
  ])('reads $kind\'s point as worldPointOf does', (event) => {
    expect(buildInvocationCtx(event, {}, undefined).world).toEqual(worldPointOf(event));
  });
});
