import { expect, it } from 'vitest';
import { resolveTextStyle, type ResolvedTextStyle } from '@weasel-js/text';
import { openEditOverlay } from './editOverlay';

it('places the overlay in the style the edit holds now, not the one it opened with', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const opening = resolveTextStyle({ fontSize: 16 });
  let held: ResolvedTextStyle = opening;
  const frame = {
    pose: () => ({ x: 0, y: 0, width: 200, height: 40, fontSize: 16 }),
    clip: () => null,
    style: () => held,
  };
  const opened = openEditOverlay(container, { text: 'abc', runs: undefined, style: opening }, frame, 0, 'all');
  expect(opened.overlay.style.letterSpacing).toBe('0px');
  held = resolveTextStyle({ fontSize: 16, letterSpacing: 3 });
  opened.place();
  expect(opened.overlay.style.letterSpacing).toBe('3px');
  opened.remove();
});
