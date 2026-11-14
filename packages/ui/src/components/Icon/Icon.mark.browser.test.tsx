import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { type UiIconName, Icon } from '@weasel-js/ui/components/Icon';
import { icon } from '@weasel-js/ui/testing/icon';
import { withIcons } from '@weasel-js/ui/testing/withIcons';

afterEach(cleanup);

const SIZE = 200;

/** The alpha a browser paints at a point on the 20x20 frame. */
async function alphaAt(mark: UiIconName | undefined, x: number, y: number, name: UiIconName = 'formPage'): Promise<number> {
  const { container } = render(<Icon name={icon(name)} mark={mark && icon(mark)} size={SIZE} />, { wrapper: withIcons });
  const svg = container.querySelector('svg')!;
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  // An image has no surrounding text color for currentColor to take.
  svg.setAttribute('color', '#000');
  const img = new Image();
  img.src = `data:image/svg+xml,${encodeURIComponent(svg.outerHTML)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  cleanup();
  return ctx.getImageData((x / 20) * SIZE, (y / 20) * SIZE, 1, 1).data[3]!;
}

// On the page glyph's bottom edge, 3 units from the slot's center: inside the clearing, outside the dot.
const ON_EDGE = [12.5, 15.75] as const;

test('a mark clears the glyph under it, and leaves the rest of it drawn', async () => {
  expect(await alphaAt(undefined, ...ON_EDGE)).toBe(255);
  expect(await alphaAt('markDot', ...ON_EDGE)).toBe(0);
  // The same edge, well clear of the slot.
  expect(await alphaAt('markDot', 6, 15.75)).toBe(255);
});

test('a mark is drawn at the middle of its slot', async () => {
  expect(await alphaAt('markDot', 15.5, 15.5)).toBe(255);
});

// The stop glyph's right edge runs down into the slot's box toward the minus: still drawn where it is more than the band
// above the minus, cleared within the band, and both probes stay off the minus's own stroke.
test('the clearing follows the mark\'s outline, not its slot', async () => {
  expect(await alphaAt('markRemove', 15.72, 12.5, 'stop')).toBe(255);
  expect(await alphaAt('markRemove', 15.72, 14.2, 'stop')).toBe(0);
});

// A mask sized by its target's bounding box has no height to work with here, and erases the line.
test('a glyph that is one straight line survives being marked', async () => {
  expect(await alphaAt('markDot', 8, 10, 'remove')).toBe(255);
});
