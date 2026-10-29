import { describe, expect, it, vi } from 'vitest';
import { attachMenuDismiss, type MenuDismissTarget } from './dismiss';

interface Ev { inside: boolean }

function fakeTarget() {
  const listeners = new Map<string, (e: Ev) => void>();
  const target: MenuDismissTarget<Ev> = {
    addEventListener: (type, l) => { listeners.set(type, l); },
    removeEventListener: (type, l) => { if (listeners.get(type) === l) listeners.delete(type); },
  };
  const fire = (type: string, e: Ev = { inside: false }) => listeners.get(type)?.(e);
  return { target, listeners, fire };
}

describe('attachMenuDismiss', () => {
  it('closes on a press or wheel outside, and not inside', () => {
    const { target, fire } = fakeTarget();
    const close = vi.fn();
    attachMenuDismiss(target, { outside: (e) => !e.inside, close });
    fire('pointerdown', { inside: true });
    fire('wheel', { inside: true });
    expect(close).not.toHaveBeenCalled();
    fire('pointerdown');
    fire('wheel');
    expect(close).toHaveBeenCalledTimes(2);
  });

  it('closes on blur and resize', () => {
    const { target, fire } = fakeTarget();
    const close = vi.fn();
    attachMenuDismiss(target, { outside: () => true, close });
    fire('blur');
    fire('resize');
    expect(close).toHaveBeenCalledTimes(2);
  });

  it('skips the press listener when press is off', () => {
    const { target, listeners } = fakeTarget();
    attachMenuDismiss(target, { outside: () => true, close: vi.fn(), press: false });
    expect([...listeners.keys()].sort()).toEqual(['blur', 'resize', 'wheel']);
  });

  it('keeps the menu open on a blur keepOnBlur allows', () => {
    const { target, fire } = fakeTarget();
    const close = vi.fn();
    let keep = true;
    attachMenuDismiss(target, { outside: () => true, close, keepOnBlur: () => keep });
    fire('blur');
    expect(close).not.toHaveBeenCalled();
    keep = false;
    fire('blur');
    expect(close).toHaveBeenCalledOnce();
  });

  it('detaches every listener', () => {
    const { target, listeners } = fakeTarget();
    const detach = attachMenuDismiss(target, { outside: () => true, close: vi.fn() });
    expect(listeners.size).toBe(4);
    detach();
    expect(listeners.size).toBe(0);
  });
});
