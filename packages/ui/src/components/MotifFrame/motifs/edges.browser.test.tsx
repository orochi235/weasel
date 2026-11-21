import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { cssColorLiteral } from '@weasel-js/paint';
import type { CSSProperties } from 'react';
import { afterEach, expect, it } from 'vitest';
import { MotifFrame, sheet } from '@weasel-js/ui/components/MotifFrame';

// Which side an edge lands on under a writing direction is a cascade question only a browser answers.

afterEach(cleanup);

const group = (name: string) => screen.getByRole('group', { name });

it('draws a tinted rule frame’s edge at the start of the line, in either direction', () => {
  render(
    <>
      <div dir="ltr">
        <MotifFrame title="Ltr" tint={cssColorLiteral('rgb(200, 0, 0)')}>
          x
        </MotifFrame>
      </div>
      <div dir="rtl">
        <MotifFrame title="Rtl" tint={cssColorLiteral('rgb(200, 0, 0)')}>
          x
        </MotifFrame>
      </div>
    </>,
  );
  expect(getComputedStyle(group('Ltr')).borderLeftWidth).toBe('4px');
  expect(getComputedStyle(group('Rtl')).borderRightWidth).toBe('4px');
  expect(getComputedStyle(group('Rtl')).borderLeftWidth).not.toBe('4px');
});

it('sets no backdrop filter on a sheet with no blur, and the blur on one given it', () => {
  render(
    <>
      <MotifFrame title="Plain" motif={sheet()}>
        x
      </MotifFrame>
      <div style={{ '--_s-blur': '3px' } as CSSProperties}>
        <MotifFrame title="Blurred" motif={sheet()}>
          x
        </MotifFrame>
      </div>
    </>,
  );
  expect(getComputedStyle(group('Plain')).backdropFilter).toBe('none');
  expect(getComputedStyle(group('Blurred')).backdropFilter).toBe('blur(3px)');
});
