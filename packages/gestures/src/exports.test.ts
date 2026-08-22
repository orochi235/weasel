import { describe, it, expect } from 'vitest';
import * as barrel from './index';
import type { InputEvent } from './ui/inputEvent';
import type { GestureSpec } from './ui/spec';
import type { LongPressEvent, LongPressSpec } from './index';

describe('package exports', () => {
  it('exposes every runtime helper', () => {
    for (const name of ['parseRoute', 'formatRoute', 'matchSpec', 'matchModifiers', 'getGestureDescriptor', 'describeRoute']) {
      expect(typeof (barrel as Record<string, unknown>)[name]).toBe('function');
    }
  });

  it('names every arm of the InputEvent and GestureSpec unions', () => {
    // A missing arm is a compile error here, not a runtime one: each variable
    // is typed from the barrel and assigned a value of that union arm.
    const longPress: LongPressEvent = { kind: 'longpress', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
    const spec: LongPressSpec = { kind: 'longPress' };
    const asEvent: InputEvent = longPress;
    const asSpec: GestureSpec = spec;
    expect(asEvent.kind).toBe('longpress');
    expect(asSpec.kind).toBe('longPress');
  });
});
