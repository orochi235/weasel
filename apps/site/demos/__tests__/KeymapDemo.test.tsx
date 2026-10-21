import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { isApplePlatform } from '@weasel-js/gestures';
import { KeymapDemo } from '../KeymapDemo';

afterEach(cleanup);

const press = (init: KeyboardEventInit): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  act(() => { document.dispatchEvent(e); });
  act(() => { document.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, ...init })); });
  return e;
};

describe('KeymapDemo', () => {
  it('opens its keymap on the leader, shows the hint, and takes a key from inside it', () => {
    render(<KeymapDemo />);
    expect(screen.queryByRole('status')).toBeNull();
    press({ key: 'k', code: 'KeyK', ...(isApplePlatform() ? { metaKey: true } : { ctrlKey: true }) });
    expect(screen.getByRole('status')).toHaveAccessibleName('Arrange');
    expect(press({ key: 'l', code: 'KeyL' }).defaultPrevented).toBe(true);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
