import { describe, it, expect, expectTypeOf } from 'vitest';
import * as barrel from './index';
import type { InputEvent } from './ui/inputEvent';
import type { GestureSpec } from './ui/spec';
import type { LongPressEvent, LongPressSpec } from './index';

describe('package exports', () => {
  it('exposes every runtime helper', () => {
    for (const name of ['parseRoute', 'formatRoute', 'matchSpec', 'matchModifiers', 'getGestureDescriptor', 'describeRoute', 'pastDragThreshold']) {
      expect(typeof (barrel as Record<string, unknown>)[name]).toBe('function');
    }
  });

  it('exports the long-press event and spec as arms of their unions', () => {
    expectTypeOf<LongPressEvent>().toMatchTypeOf<InputEvent>();
    expectTypeOf<LongPressSpec>().toMatchTypeOf<GestureSpec>();
  });
});
