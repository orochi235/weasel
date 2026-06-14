/**
 * Tests for the three color action descriptors.
 *
 * Verifies descriptor shape and that `invoker.run` calls the right method on a
 * mock `ColorContextValue`.
 */
import { describe, it, expect, vi } from 'vitest';
import { colorResetAction, colorSwapAction, colorToggleFocusedNoneAction } from './actions';
import type { ActionDeps } from '@weasel-js/core';
import type { ImmediateInvoker } from '@weasel-js/core';

function makeColorDeps() {
  return {
    reset: vi.fn(),
    swap: vi.fn(),
    swapFocus: vi.fn(),
    toggleFocusedNone: vi.fn(),
  };
}

describe('colorResetAction', () => {
  it('has the expected id and label', () => {
    expect(colorResetAction.id).toBe('color.reset');
    expect(colorResetAction.label).toBe('Reset colors');
  });

  it('has defaultBinding for key d', () => {
    expect(colorResetAction.defaultBinding).toEqual({ kind: 'key', key: 'd' });
  });

  it('requires color dep', () => {
    expect(colorResetAction.requires).toContain('color');
  });

  it('invoker.run calls color.reset()', () => {
    const color = makeColorDeps();
    (colorResetAction.invoker! as ImmediateInvoker).run({ color } as unknown as ActionDeps, undefined);
    expect(color.reset).toHaveBeenCalledOnce();
  });
});

describe('colorSwapAction', () => {
  it('has the expected id and label', () => {
    expect(colorSwapAction.id).toBe('color.swap');
    expect(colorSwapAction.label).toBe('Swap fill/stroke');
  });

  it('has two BoundGesture entries for x and Shift+X', () => {
    const bindings = colorSwapAction.defaultBinding as Array<{ spec: unknown; opts: unknown }>;
    expect(bindings).toHaveLength(2);
  });

  it('requires color dep', () => {
    expect(colorSwapAction.requires).toContain('color');
  });

  it('invoker.run calls color.swap() when params.kind is "swap"', () => {
    const color = makeColorDeps();
    (colorSwapAction.invoker! as ImmediateInvoker).run({ color } as unknown as ActionDeps, { kind: 'swap' });
    expect(color.swap).toHaveBeenCalledOnce();
    expect(color.swapFocus).not.toHaveBeenCalled();
  });

  it('invoker.run calls color.swapFocus() when params.kind is "swapFocus"', () => {
    const color = makeColorDeps();
    (colorSwapAction.invoker! as ImmediateInvoker).run({ color } as unknown as ActionDeps, { kind: 'swapFocus' });
    expect(color.swapFocus).toHaveBeenCalledOnce();
    expect(color.swap).not.toHaveBeenCalled();
  });

  it('invoker.run defaults to swap when params are undefined', () => {
    const color = makeColorDeps();
    (colorSwapAction.invoker! as ImmediateInvoker).run({ color } as unknown as ActionDeps, undefined);
    expect(color.swap).toHaveBeenCalledOnce();
  });
});

describe('colorToggleFocusedNoneAction', () => {
  it('has the expected id and label', () => {
    expect(colorToggleFocusedNoneAction.id).toBe('color.toggleFocusedNone');
    expect(colorToggleFocusedNoneAction.label).toBe('Toggle focused color none');
  });

  it('has defaultBinding for key /', () => {
    expect(colorToggleFocusedNoneAction.defaultBinding).toEqual({ kind: 'key', key: '/' });
  });

  it('requires color dep', () => {
    expect(colorToggleFocusedNoneAction.requires).toContain('color');
  });

  it('invoker.run calls color.toggleFocusedNone()', () => {
    const color = makeColorDeps();
    (colorToggleFocusedNoneAction.invoker! as ImmediateInvoker).run({ color } as unknown as ActionDeps, undefined);
    expect(color.toggleFocusedNone).toHaveBeenCalledOnce();
  });
});
