import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { useKeyState } from './useKeyState';
import type { KeyState } from './keyState';

const press = (target: EventTarget, code: string) =>
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true }));
  });

describe('useKeyState', () => {
  it('polls the window by default and detaches on unmount', () => {
    let keys!: KeyState;
    function Probe() {
      keys = useKeyState();
      return null;
    }
    const { unmount } = render(<Probe />);
    press(window, 'KeyA');
    expect(keys.isDown('KeyA')).toBe(true);
    unmount();
    expect(keys.isDown('KeyA')).toBe(false);
    press(window, 'KeyB');
    expect(keys.isDown('KeyB')).toBe(false);
  });

  it('scoped to an element, sees only keys typed inside it', () => {
    let keys!: KeyState;
    let host!: HTMLDivElement;
    function Probe() {
      const ref = useRef<HTMLDivElement>(null);
      keys = useKeyState({ target: ref });
      return <div ref={(el) => { ref.current = el; if (el) host = el; }} />;
    }
    render(<Probe />);
    press(document.body, 'KeyA');
    expect(keys.isDown('KeyA')).toBe(false);
    press(host, 'KeyB');
    expect(keys.isDown('KeyB')).toBe(true);
  });

  it('attaches to the element its ref holds once one mounts, and follows a swap', () => {
    let keys!: KeyState;
    let host!: HTMLDivElement;
    function Probe({ show, k }: { show: boolean; k: string }) {
      const ref = useRef<HTMLDivElement>(null);
      keys = useKeyState({ target: ref });
      return show ? <div key={k} ref={(el) => { ref.current = el; if (el) host = el; }} /> : null;
    }
    const { rerender } = render(<Probe show={false} k="a" />);
    rerender(<Probe show k="a" />);
    const first = host;
    press(first, 'KeyA');
    expect(keys.isDown('KeyA')).toBe(true);
    rerender(<Probe show k="b" />);
    expect(host).not.toBe(first);
    press(first, 'KeyB');
    expect(keys.isDown('KeyB')).toBe(false);
    press(host, 'KeyC');
    expect(keys.isDown('KeyC')).toBe(true);
  });
});
