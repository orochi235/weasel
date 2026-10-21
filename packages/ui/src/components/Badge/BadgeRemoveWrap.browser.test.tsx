import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { Badge } from './Badge';

// Where a line breaks is layout, which jsdom does not do.

afterEach(cleanup);

const SHAPES = ['pill', 'plain'] as const;
const BREAKS = ['slice', 'clone'] as const;

/** The label's line boxes, from its text alone: the label's own box also covers the tail. */
function textLines(badge: HTMLElement): DOMRect[] {
  const range = document.createRange();
  range.selectNodeContents(badge.querySelector('[data-label]')!);
  const rects = [...range.getClientRects()].filter((r) => r.width > 0);
  const lines: DOMRect[] = [];
  for (const r of rects) {
    if (!lines.some((l) => Math.abs((l.top + l.bottom) / 2 - (r.top + r.bottom) / 2) < 2)) lines.push(r);
  }
  return lines;
}

describe('a wrapped removable badge', () => {
  for (const shape of SHAPES) {
    for (const breakStyle of BREAKS) {
      for (const action of [false, true]) {
        test(`${shape} (${breakStyle}${action ? ', clickable' : ''}): the remove control shares a line with the last word, inside the badge`, () => {
          const { container } = render(
            <div data-wzl-mode="light">
              {Array.from({ length: 120 }, (_, i) => (
                <p key={i} style={{ width: 60 + i, margin: 0 }}>
                  xx{' '}
                  <Badge shape={shape} breakStyle={breakStyle} onClick={action ? () => {} : undefined} onRemove={() => {}}>
                    <span data-label="">alpha beta gamma</span>
                  </Badge>
                </p>
              ))}
            </div>,
          );
          for (const badge of container.querySelectorAll<HTMLElement>('[data-status]')) {
            const at = `at width ${badge.parentElement!.style.width}`;
            const lines = textLines(badge);
            const last = lines[lines.length - 1];
            const remove = badge.querySelector('button')!.getBoundingClientRect();
            const middle = (remove.top + remove.bottom) / 2;
            expect(middle > last.top && middle < last.bottom, `${at}: on the last word's line`).toBe(true);
            expect(remove.left, `${at}: after the last word`).toBeGreaterThanOrEqual(last.right);
            const fragments = [...badge.getClientRects()];
            const frag = fragments[fragments.length - 1];
            expect(remove.left, `${at}: right of the line's start`).toBeGreaterThanOrEqual(frag.left);
            expect(remove.right, `${at}: inside the badge`).toBeLessThanOrEqual(frag.right + 0.5);
          }
        });
      }
    }
  }
});

describe('a removable badge in a flex row with room to spare', () => {
  for (const shape of SHAPES) {
    for (const action of [false, true]) {
      test(`${shape}${action ? ', clickable' : ''}: a two-word label stays on one line`, () => {
        const { container } = render(
          <div data-wzl-mode="light" style={{ display: 'flex', gap: 12, alignItems: 'baseline', width: 600 }}>
            <Badge shape={shape} onRemove={() => {}} onClick={action ? () => {} : undefined}>
              <span data-label="">two words</span>
            </Badge>
            <span>after</span>
          </div>,
        );
        const badge = container.querySelector<HTMLElement>('[data-status]')!;
        expect(textLines(badge)).toHaveLength(1);
      });
    }
  }
});
