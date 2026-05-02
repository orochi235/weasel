import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useKeybinding, isEditableTarget } from './useKeybinding';

function press(opts: {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  target?: EventTarget;
}) {
  const e = new KeyboardEvent('keydown', {
    key: opts.key,
    metaKey: opts.meta ?? false,
    ctrlKey: opts.ctrl ?? false,
    altKey: opts.alt ?? false,
    shiftKey: opts.shift ?? false,
    cancelable: true,
    bubbles: true,
  });
  if (opts.target) {
    Object.defineProperty(e, 'target', { value: opts.target });
  }
  document.dispatchEvent(e);
  return e;
}

describe('useKeybinding', () => {
  let cleanup: (() => void) | null = null;

  afterEach(() => {
    cleanup?.();
    cleanup = null;
  });

  it('fires when key matches and modifiers absent', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeybinding({ key: 'Escape' }, handler));
    cleanup = unmount;
    press({ key: 'Escape' });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('matches case-insensitively and against a list', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeybinding({ key: ['Delete', 'Backspace'] }, handler));
    cleanup = unmount;
    press({ key: 'Backspace' });
    press({ key: 'Delete' });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('requires mod when mod=true; cmd or ctrl both work', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeybinding({ key: 'a', mod: true }, handler));
    cleanup = unmount;
    press({ key: 'a' });
    expect(handler).not.toHaveBeenCalled();
    press({ key: 'a', meta: true });
    press({ key: 'a', ctrl: true });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('forbids mod when mod is unset', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeybinding({ key: 'Escape' }, handler));
    cleanup = unmount;
    press({ key: 'Escape', meta: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it('shift policy: forbidden by default, optional allows either, true requires', () => {
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    const ha = renderHook(() => useKeybinding({ key: 'x' }, a));
    const hb = renderHook(() => useKeybinding({ key: 'y', shift: 'optional' }, b));
    const hc = renderHook(() => useKeybinding({ key: 'z', shift: true }, c));
    press({ key: 'x', shift: true });
    expect(a).not.toHaveBeenCalled();
    press({ key: 'y' });
    press({ key: 'y', shift: true });
    expect(b).toHaveBeenCalledTimes(2);
    press({ key: 'z' });
    expect(c).not.toHaveBeenCalled();
    press({ key: 'z', shift: true });
    expect(c).toHaveBeenCalledOnce();
    ha.unmount(); hb.unmount(); hc.unmount();
  });

  it('skips editable targets by default; opt-out allows them', () => {
    const a = vi.fn();
    const b = vi.fn();
    const ha = renderHook(() => useKeybinding({ key: 'Escape' }, a));
    const hb = renderHook(() => useKeybinding({ key: 'q', skipInEditable: false }, b));
    const input = document.createElement('input');
    document.body.appendChild(input);
    press({ key: 'Escape', target: input });
    press({ key: 'q', target: input });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
    document.body.removeChild(input);
    ha.unmount(); hb.unmount();
  });

  it('preventDefault by default; opt-out leaves it untouched', () => {
    const a = vi.fn();
    const b = vi.fn();
    const ha = renderHook(() => useKeybinding({ key: 'a' }, a));
    const hb = renderHook(() => useKeybinding({ key: 'b', preventDefault: false }, b));
    const ea = press({ key: 'a' });
    const eb = press({ key: 'b' });
    expect(ea.defaultPrevented).toBe(true);
    expect(eb.defaultPrevented).toBe(false);
    ha.unmount(); hb.unmount();
  });

  it('does not attach when enabled=false', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeybinding({ key: 'x', enabled: false }, handler));
    press({ key: 'x' });
    expect(handler).not.toHaveBeenCalled();
    unmount();
  });

  it('always reads fresh handler', () => {
    const a = vi.fn();
    const b = vi.fn();
    let h: () => void = a;
    const { rerender, unmount } = renderHook(() => useKeybinding({ key: 'x' }, h));
    press({ key: 'x' });
    expect(a).toHaveBeenCalledOnce();
    h = b;
    rerender();
    press({ key: 'x' });
    expect(b).toHaveBeenCalledOnce();
    expect(a).toHaveBeenCalledOnce();
    unmount();
  });
});

describe('isEditableTarget', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('detects INPUT/TEXTAREA/contenteditable', () => {
    const i = document.createElement('input');
    const t = document.createElement('textarea');
    const d = document.createElement('div');
    d.setAttribute('contenteditable', 'true');
    expect(isEditableTarget(i)).toBe(true);
    expect(isEditableTarget(t)).toBe(true);
    expect(isEditableTarget(d)).toBe(true);
  });

  it('returns false for plain elements and null', () => {
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(document.createElement('div'))).toBe(false);
  });
});
