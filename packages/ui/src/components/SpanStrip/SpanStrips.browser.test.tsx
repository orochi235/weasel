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

describe('an open span', () => {
  const label = 'six of six fixed after a long fix';
  it("runs its label on past its end over the empty track, and cuts a span's that something follows", () => {
    const spans = [{ id: 'x', label: 'first of two', ms: 4, start: 0, state: 'done' as const }, { id: 'y', label, ms: 4, start: 4, state: 'done' as const }];
    render(<div style={{ width: 600 }}><SpanStrips window={{ from: 0, to: 40 }} rows={[{ id: 'r', 'aria-label': 'r', spans }]} /></div>);
    const strip = screen.getByRole('meter', { name: 'r' });
    const [first, open] = [...strip.querySelectorAll('[data-state]')].slice(0, 2) as HTMLElement[];
    const text = (seg: HTMLElement) => seg.firstElementChild as HTMLElement;
    expect(open!.hasAttribute('data-open')).toBe(true);
    expect(first!.hasAttribute('data-open')).toBe(false);
    expect(text(open!).getBoundingClientRect().width).toBeGreaterThan(open!.getBoundingClientRect().width);
    expect(text(open!).scrollWidth).toBeLessThanOrEqual(text(open!).clientWidth);
    expect(text(first!).scrollWidth).toBeGreaterThan(text(first!).clientWidth);
  });
});
