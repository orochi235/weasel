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

test('an isolated story still pending is unseen, and the controls in its frame still count as focusable', async () => {
  const frame = document.createElement('iframe');
  frame.className = 'fg-frame-view';
  frame.toggleAttribute('data-pending', true);
  const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
  frame.srcdoc = '<button type="button">help</button>';
  document.body.append(frame);
  try {
    await loaded;
    expect(getComputedStyle(frame).visibility).toBe('hidden');
    // The frame's own visibility does not inherit into the document it holds, which is where the check runs.
    expect(frame.contentDocument?.querySelector('button')?.checkVisibility({ visibilityProperty: true })).toBe(true);
    // The same check does fail for a control hidden from inside its own document.
    frame.contentDocument?.body.style.setProperty('visibility', 'hidden');
    expect(frame.contentDocument?.querySelector('button')?.checkVisibility({ visibilityProperty: true })).toBe(false);
  } finally {
    frame.remove();
  }
});
