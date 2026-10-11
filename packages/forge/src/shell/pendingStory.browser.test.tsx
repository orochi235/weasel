import './shell.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

afterEach(cleanup);

test('a story still pending is unseen and unclickable, and its controls still count as focusable', () => {
  const { container } = render(
    <div className="fg-story" data-pending>
      <button type="button">help</button>
    </div>,
  );
  const host = container.querySelector('.fg-story')!;
  expect(getComputedStyle(host).opacity).toBe('0');
  expect(getComputedStyle(host).pointerEvents).toBe('none');
  // The check react-aria's Focusable makes in a mount effect, warning when it is false.
  expect(container.querySelector('button')!.checkVisibility({ visibilityProperty: true })).toBe(true);
});
