import { describe, it, expect } from 'vitest';
import { act, render } from '@testing-library/react';
import { usePlatformerInput } from '../platformer/useInput';
import type { Input } from '../platformer/physics';

function mount() {
  let read!: () => Input;
  function Harness() {
    read = usePlatformerInput();
    return null;
  }
  render(<Harness />);
  return () => read();
}

const key = (type: 'keydown' | 'keyup', code: string, init: KeyboardEventInit = {}) => {
  let e!: KeyboardEvent;
  act(() => {
    e = new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true, ...init });
    window.dispatchEvent(e);
  });
  return e;
};

const NONE: Input = { left: false, right: false, jumpHeld: false, jumpPressed: false };

describe('usePlatformerInput', () => {
  it('starts with nothing held', () => {
    expect(mount()()).toEqual(NONE);
  });

  it('tracks a held direction from keydown to keyup', () => {
    const step = mount();
    key('keydown', 'ArrowRight');
    expect(step().right).toBe(true);
    key('keyup', 'ArrowRight');
    expect(step().right).toBe(false);
  });

  it('accepts the WASD positions', () => {
    const step = mount();
    key('keydown', 'KeyA');
    expect(step().left).toBe(true);
    key('keyup', 'KeyA');
    key('keydown', 'KeyD');
    expect(step().right).toBe(true);
  });

  it('reports a jump press to exactly one step, and the hold for as long as it lasts', () => {
    const step = mount();
    key('keydown', 'Space');
    expect(step()).toMatchObject({ jumpHeld: true, jumpPressed: true });
    key('keydown', 'Space', { repeat: true });
    expect(step()).toMatchObject({ jumpHeld: true, jumpPressed: false });
    key('keyup', 'Space');
    expect(step().jumpHeld).toBe(false);
  });

  it('keeps the keys it owns from scrolling the page', () => {
    mount();
    expect(key('keydown', 'Space').defaultPrevented).toBe(true);
    expect(key('keydown', 'ArrowUp').defaultPrevented).toBe(true);
  });

  it('clears everything on window blur so a held key cannot stick', () => {
    const step = mount();
    key('keydown', 'ArrowLeft');
    key('keydown', 'Space');
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(step()).toEqual(NONE);
  });
});
