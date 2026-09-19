import { afterEach, describe, expect, it, vi } from 'vitest';
import { createKeyState, type KeyState } from './keyState';

const detachers: Array<() => void> = [];
afterEach(() => {
  while (detachers.length) detachers.pop()!();
  document.body.innerHTML = '';
});

function attached(target: Window | HTMLElement = window, opts?: Parameters<KeyState['attach']>[1]) {
  const keys = createKeyState();
  detachers.push(keys.attach(target, opts));
  return keys;
}

function fire(
  type: 'keydown' | 'keyup',
  code: string,
  init: KeyboardEventInit = {},
  target: EventTarget = window,
): KeyboardEvent {
  const e = new KeyboardEvent(type, { code, key: init.key ?? code, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
}

describe('createKeyState', () => {
  it('reports a physical key down between its keydown and keyup', () => {
    const keys = attached();
    expect(keys.isDown('KeyA')).toBe(false);
    fire('keydown', 'KeyA', { key: 'a' });
    expect(keys.isDown('KeyA')).toBe(true);
    expect(keys.isDown(['ArrowLeft', 'KeyA'])).toBe(true);
    expect(keys.codes()).toEqual(new Set(['KeyA']));
    fire('keyup', 'KeyA', { key: 'a' });
    expect(keys.isDown('KeyA')).toBe(false);
  });

  it('releases by code, so a key whose character changed under Shift does not stick', () => {
    const keys = attached();
    fire('keydown', 'KeyA', { key: 'a' });
    fire('keydown', 'ShiftLeft', { key: 'Shift', shiftKey: true });
    fire('keyup', 'KeyA', { key: 'A', shiftKey: true });
    expect(keys.isDown('KeyA')).toBe(false);
    expect(keys.isKeyDown('a')).toBe(false);
  });

  it('answers by the key a press produced, single characters case-folded', () => {
    const keys = attached();
    fire('keydown', 'KeyA', { key: 'A', shiftKey: true });
    expect(keys.isKeyDown('a')).toBe(true);
    expect(keys.isKeyDown(['x', 'A'])).toBe(true);
    fire('keydown', 'Space', { key: ' ' });
    expect(keys.isKeyDown(' ')).toBe(true);
  });

  describe('releasing everything when the keyups can no longer arrive', () => {
    it('on window blur', () => {
      const keys = attached();
      fire('keydown', 'KeyA');
      fire('keydown', 'ShiftLeft', { key: 'Shift', shiftKey: true });
      window.dispatchEvent(new Event('blur'));
      expect(keys.codes().size).toBe(0);
      expect(keys.modifiers()).toEqual({ shift: false, ctrl: false, alt: false, meta: false });
    });

    it('when the document is hidden', () => {
      const keys = attached();
      fire('keydown', 'KeyA');
      const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
      document.dispatchEvent(new Event('visibilitychange'));
      hidden.mockRestore();
      expect(keys.isDown('KeyA')).toBe(false);
    });

    it('drops a press nobody took, so it cannot fire after focus returns', () => {
      const keys = attached();
      fire('keydown', 'Space');
      window.dispatchEvent(new Event('blur'));
      expect(keys.take('Space')).toBe(false);
    });

    it('when an element target loses focus to something outside it, and not within it', () => {
      const host = document.createElement('div');
      const inner = document.createElement('button');
      const outside = document.createElement('button');
      host.append(inner);
      document.body.append(host, outside);
      const keys = attached(host);
      fire('keydown', 'KeyA', {}, inner);
      inner.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: host }));
      expect(keys.isDown('KeyA')).toBe(true);
      inner.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
      expect(keys.isDown('KeyA')).toBe(false);
    });

    it('releases the keys a released Meta swallowed the keyups of, and nothing else of Meta', () => {
      const keys = attached();
      fire('keydown', 'MetaLeft', { key: 'Meta', metaKey: true });
      fire('keydown', 'ShiftLeft', { key: 'Shift', metaKey: true, shiftKey: true });
      fire('keydown', 'KeyZ', { key: 'z', metaKey: true, shiftKey: true });
      fire('keyup', 'MetaLeft', { key: 'Meta', shiftKey: true });
      expect(keys.isDown('KeyZ')).toBe(false);
      expect(keys.isDown('ShiftLeft')).toBe(true);
    });
  });

  describe('autorepeat', () => {
    it('is not a press', () => {
      const keys = attached();
      fire('keydown', 'Space');
      expect(keys.take('Space')).toBe(true);
      fire('keydown', 'Space', { repeat: true });
      fire('keydown', 'Space', { repeat: true });
      expect(keys.take('Space')).toBe(false);
      expect(keys.isDown('Space')).toBe(true);
    });

    it('re-reports a key held across a focus loss, without inventing a press', () => {
      const keys = attached();
      fire('keydown', 'ArrowRight');
      window.dispatchEvent(new Event('blur'));
      fire('keydown', 'ArrowRight', { repeat: true });
      expect(keys.isDown('ArrowRight')).toBe(true);
      expect(keys.take('ArrowRight')).toBe(false);
    });
  });

  it('take consumes a press once, and any listed code answers', () => {
    const keys = attached();
    fire('keydown', 'KeyW');
    fire('keyup', 'KeyW');
    expect(keys.take(['Space', 'KeyW'])).toBe(true);
    expect(keys.take(['Space', 'KeyW'])).toBe(false);
  });

  it('reconciles modifier keys against the flags every key event carries', () => {
    const keys = attached();
    fire('keydown', 'AltLeft', { key: 'Alt', altKey: true });
    expect(keys.modifiers().alt).toBe(true);
    // The Alt keyup went to another window (alt-tab); the next event says it is up.
    fire('keydown', 'KeyA', { key: 'a' });
    expect(keys.modifiers().alt).toBe(false);
    expect(keys.isDown('AltLeft')).toBe(false);
  });

  it('ignores presses typed into an editable element but still takes their release', () => {
    const input = document.createElement('input');
    document.body.append(input);
    const keys = attached();
    fire('keydown', 'KeyA', {}, input);
    expect(keys.isDown('KeyA')).toBe(false);

    fire('keydown', 'KeyB');
    fire('keyup', 'KeyB', {}, input);
    expect(keys.isDown('KeyB')).toBe(false);
  });

  it('prevents the default of only the codes it was told to', () => {
    attached(window, { preventDefault: ['Space'] });
    expect(fire('keydown', 'Space').defaultPrevented).toBe(true);
    expect(fire('keydown', 'KeyA').defaultPrevented).toBe(false);
  });

  it('notifies subscribers on every change, and stops listening on detach', () => {
    const keys = createKeyState();
    const detach = keys.attach(window);
    const seen = vi.fn();
    const unsub = keys.subscribe(seen);
    fire('keydown', 'KeyA');
    fire('keydown', 'KeyA', { repeat: true });
    fire('keyup', 'KeyA');
    expect(seen).toHaveBeenCalledTimes(2);
    unsub();
    detach();
    fire('keydown', 'KeyB');
    expect(keys.isDown('KeyB')).toBe(false);
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it('releases what it holds when detached', () => {
    const keys = createKeyState();
    const detach = keys.attach(window);
    fire('keydown', 'KeyA');
    detach();
    expect(keys.isDown('KeyA')).toBe(false);
  });
});
