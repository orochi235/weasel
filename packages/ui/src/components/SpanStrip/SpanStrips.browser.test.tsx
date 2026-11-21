import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SpanStrips } from '@weasel-js/ui/components/SpanStrip';

// Which row's corners round is computed style, which jsdom does not resolve.

afterEach(cleanup);

const rows = ['a', 'b', 'c'].map((id) => ({ id, 'aria-label': id, spans: [{ id: `${id}1`, label: id, ms: 10 }] }));
const bottomRounded = (name: string) => getComputedStyle(screen.getByRole('meter', { name })).borderEndStartRadius !== '0px';

describe('SpanStrips corners', () => {
  for (const at of [undefined, 5]) {
    it(`rounds the bottom of the last row only, ${at === undefined ? 'with no playhead' : 'under a playhead'}`, () => {
      render(<SpanStrips window={{ from: 0, to: 10 }} rows={rows} {...(at === undefined ? {} : { at })} />);
      expect(['a', 'b', 'c'].map(bottomRounded)).toEqual([false, false, true]);
    });
  }
});
