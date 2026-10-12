import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AlignDemo } from '../AlignDemo';

afterEach(cleanup);

describe('AlignDemo', () => {
  it('mounts and takes its align and flip keys without throwing', () => {
    const { container } = render(<AlignDemo />);
    for (const init of [{ key: 'l' }, { key: 'T', shiftKey: true }, { key: 'f' }]) {
      act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { ...init, bubbles: true })); });
    }
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  // Its rects start selected and its hint says to press a letter, so no press in the canvas comes first.
  it('answers an align key before any press in the canvas', () => {
    render(<AlignDemo />);
    const key = new KeyboardEvent('keydown', { key: 'l', bubbles: true, cancelable: true });
    act(() => { document.dispatchEvent(key); });
    expect(key.defaultPrevented).toBe(true);
  });
});
