import { expect, it, vi } from 'vitest';
import { restoreOverlayFocus } from './overlaySelection';

it('returns focus to the overlay without scrolling it or the page', () => {
  const overlay = document.createElement('div');
  overlay.setAttribute('contenteditable', 'true');
  overlay.textContent = 'abc';
  const chrome = document.createElement('button');
  document.body.append(overlay, chrome);
  chrome.focus();
  // A proxy: jsdom scrolls nothing on focus, so what can be checked is the option passed.
  const focus = vi.spyOn(overlay, 'focus');
  restoreOverlayFocus(overlay, { start: 1, end: 2 });
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  overlay.remove();
  chrome.remove();
});

it("focuses through the overlay's own focus path when given one", () => {
  const overlay = document.createElement('div');
  overlay.setAttribute('contenteditable', 'true');
  overlay.textContent = 'abc';
  const chrome = document.createElement('button');
  document.body.append(overlay, chrome);
  chrome.focus();
  const bare = vi.spyOn(overlay, 'focus');
  const focus = vi.fn(() => HTMLElement.prototype.focus.call(overlay));
  restoreOverlayFocus(overlay, { start: 1, end: 2 }, focus);
  expect(focus).toHaveBeenCalledOnce();
  expect(bare).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(overlay);
  overlay.remove();
  chrome.remove();
});
