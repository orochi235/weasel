import { cssColorLiteral } from '@weasel-js/paint';
import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import type { CSSProperties, ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MotifFrame } from '../MotifFrame';
import { titlebar } from './titlebar';

// Where the strip sits, what paints it, and whether a tint outranks a theme's
// strip are layout and cascade questions, so only a real browser answers them.

afterEach(cleanup);

const group = (name: string) => screen.getByRole('group', { name });
const titleOf = (name: string) => document.getElementById(group(name).getAttribute('aria-labelledby')!)!;
/** The strip: the row the title sits in, across the frame's top. */
const stripOf = (name: string) => titleOf(name).parentElement!.parentElement!;

function Scope({ vars, children }: { vars?: Record<string, string>; children: ReactNode }) {
  return <div style={{ width: 240, ...vars } as CSSProperties}>{children}</div>;
}

const GRADIENT = 'linear-gradient(90deg, rgb(0, 0, 128), rgb(16, 132, 208))';
const THEMED = { '--wzl-titlebar-surface': GRADIENT, '--wzl-titlebar-fg': 'rgb(255, 255, 255)' };

describe('titlebar', () => {
  it('runs a strip across the top of the frame, the content under it', () => {
    render(
      <Scope>
        <MotifFrame title="Display" motif={titlebar()}>
          <div data-testid="content">x</div>
        </MotifFrame>
      </Scope>,
    );
    const frame = group('Display').getBoundingClientRect();
    const strip = stripOf('Display').getBoundingClientRect();
    const content = screen.getByTestId('content').getBoundingClientRect();
    expect(strip.bottom).toBeLessThanOrEqual(content.top);
    expect(strip.top - frame.top).toBeLessThan(4);
    expect(frame.width - strip.width).toBeLessThan(8);
  });

  it('fills the strip with the edge color and inks the title to read on it', () => {
    render(
      <Scope>
        <MotifFrame title="Display" motif={titlebar()} tint={cssColorLiteral("rgb(10, 20, 120)")}>
          x
        </MotifFrame>
      </Scope>,
    );
    const strip = getComputedStyle(stripOf('Display'));
    expect(strip.backgroundColor).toBe('rgb(10, 20, 120)');
    // Chromium serializes the black-or-white ink in oklch.
    expect(strip.color).toBe('oklch(1 0 0)');
  });

  it('takes a theme’s strip and its text color', () => {
    render(
      <Scope vars={THEMED}>
        <MotifFrame title="Display" motif={titlebar()}>
          x
        </MotifFrame>
      </Scope>,
    );
    const strip = getComputedStyle(stripOf('Display'));
    expect(strip.backgroundImage).toBe(GRADIENT);
    expect(strip.color).toBe('rgb(255, 255, 255)');
  });

  it('paints a named tint over the theme’s strip', () => {
    render(
      <Scope vars={THEMED}>
        <MotifFrame title="Display" motif={titlebar()} tint={cssColorLiteral("rgb(250, 240, 120)")}>
          x
        </MotifFrame>
      </Scope>,
    );
    const strip = getComputedStyle(stripOf('Display'));
    expect(strip.backgroundImage).toBe('none');
    expect(strip.backgroundColor).toBe('rgb(250, 240, 120)');
    expect(strip.color).toBe('oklch(0 0 0)');
  });

  it('sets the title at the start of the strip, and centered where the theme says so', () => {
    const offsets = () => {
      const strip = stripOf('Hi').getBoundingClientRect();
      const title = titleOf('Hi').getBoundingClientRect();
      return { before: title.left - strip.left, after: strip.right - title.right };
    };
    const { rerender } = render(
      <Scope>
        <MotifFrame title="Hi" motif={titlebar()}>
          x
        </MotifFrame>
      </Scope>,
    );
    expect(offsets().before).toBeLessThan(16);
    expect(offsets().after).toBeGreaterThan(120);
    rerender(
      <Scope vars={{ '--wzl-titlebar-align': 'center' }}>
        <MotifFrame title="Hi" motif={titlebar()}>
          x
        </MotifFrame>
      </Scope>,
    );
    expect(Math.abs(offsets().before - offsets().after)).toBeLessThan(2);
  });

  it('patches the ground behind the title, for a strip drawn in stripes', () => {
    render(
      <Scope vars={{ '--wzl-titlebar-label-surface': 'rgb(221, 221, 221)' }}>
        <MotifFrame title="Display" motif={titlebar()}>
          x
        </MotifFrame>
      </Scope>,
    );
    expect(getComputedStyle(titleOf('Display')).backgroundColor).toBe('rgb(221, 221, 221)');
  });

  it('draws the frame in the raised bevel, and the border and inset a theme gives it', () => {
    const vars = {
      '--wzl-bevel-raised': 'inset 1px 1px 0 rgb(255, 0, 0)',
      '--wzl-titlebar-border': '0 solid transparent',
      '--wzl-titlebar-inset': '3px',
    };
    render(
      <Scope vars={vars}>
        <MotifFrame title="Display" motif={titlebar()}>
          x
        </MotifFrame>
      </Scope>,
    );
    const frame = getComputedStyle(group('Display'));
    expect(frame.boxShadow).toBe('rgb(255, 0, 0) 1px 1px 0px 0px inset');
    expect(frame.borderTopWidth).toBe('0px');
    expect(frame.paddingTop).toBe('3px');
  });
});
