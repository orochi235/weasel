/** Every place the panel names a key names it the same way, on macOS as elsewhere. */
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { GestureRoute } from './GestureRoute';
import { keyName } from './keyName';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('names a key in a route strip as the trace row and the diagram do', () => {
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
  const { container } = render(<GestureRoute route="[initial] keyDown(Escape)" />);
  expect(keyName('Escape')).toBe('Esc');
  expect(container.querySelector('kbd')?.textContent).toBe(keyName('Escape'));
  expect(keyName(' ')).toBe('Space');
});
