import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RigToolsDemo } from '../RigToolsDemo';

afterEach(cleanup);

describe('RigToolsDemo', () => {
  // Its hint opens with "Press J for the bone tool", so no press in the canvas comes first.
  it('answers a tool key before any press in the canvas', () => {
    render(<RigToolsDemo />);
    const key = new KeyboardEvent('keydown', { key: 'j', bubbles: true, cancelable: true });
    act(() => { document.dispatchEvent(key); });
    expect(key.defaultPrevented).toBe(true);
  });
});
