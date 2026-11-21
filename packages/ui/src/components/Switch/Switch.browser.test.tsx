import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Switch } from '@weasel-js/ui/components/Switch';

// Where the thumb sits is layout, which jsdom does not do.

afterEach(cleanup);

/** Where the thumb sits along its track, from 0 at the left to 1 at the right. */
function thumbAt(): number {
  const label = screen.getByRole('switch').closest('label')!;
  const track = [...label.querySelectorAll('span')].find((el) => el.firstElementChild?.tagName === 'SPAN' && !el.querySelector('input'))!;
  const thumb = track.firstElementChild!.getBoundingClientRect();
  const box = track.getBoundingClientRect();
  return Math.round((thumb.left - box.left) / (box.width - thumb.width));
}

describe('Switch thumb', () => {
  for (const dir of ['ltr', 'rtl'] as const) {
    it(`sits at the inline start off and moves to the inline end on, in ${dir}`, async () => {
      const start = dir === 'ltr' ? 0 : 1;
      const { rerender } = render(<div dir={dir}><Switch isSelected={false}>Wifi</Switch></div>);
      await expect.poll(thumbAt).toBe(start);
      rerender(<div dir={dir}><Switch isSelected>Wifi</Switch></div>);
      await expect.poll(thumbAt).toBe(1 - start);
    });
  }
});
