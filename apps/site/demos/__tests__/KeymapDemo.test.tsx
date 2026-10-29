import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { isApplePlatform } from '@weasel-js/gestures';
import { KeymapDemo } from '../KeymapDemo';

beforeAll(() => { window.history.replaceState(null, '', '/?test=1'); });
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

const press = (init: KeyboardEventInit): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  act(() => { document.dispatchEvent(e); });
  act(() => { document.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, ...init })); });
  return e;
};
const leader = () => press({ key: 'k', code: 'KeyK', ...(isApplePlatform() ? { metaKey: true } : { ctrlKey: true }) });
const poses = () => window.__weaselTest!.getScene().nodes.map((n) => n.pose);

describe('KeymapDemo', () => {
  it('opens its keymap on the leader, shows the hint, and takes a key from inside it', () => {
    render(<KeymapDemo />);
    expect(screen.queryByRole('status')).toBeNull();
    leader();
    expect(screen.getByRole('status')).toHaveAccessibleName('Arrange');
    expect(press({ key: 'l', code: 'KeyL' }).defaultPrevented).toBe(true);
    expect(screen.queryByRole('status')).toBeNull();
  });

  // Its rects are plain unrotated boxes, which a flip about each one's own box leaves as they were.
  it.each([['h', 'KeyH'], ['v', 'KeyV']])('moves the rects on %s', (key, code) => {
    render(<KeymapDemo />);
    const before = poses();
    leader();
    press({ key, code });
    expect(poses()).not.toEqual(before);
  });
});
