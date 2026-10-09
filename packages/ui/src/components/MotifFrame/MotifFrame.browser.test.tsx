import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MotifFrame } from './MotifFrame';
import { notch, plaque, stereo, tab } from './motifs';

// Where a motif puts its title, and whether its ink reads, are layout and
// color questions, so only a real browser can answer them.

afterEach(cleanup);

const group = (name: string) => screen.getByRole('group', { name });
const titleOf = (name: string) => document.getElementById(group(name).getAttribute('aria-labelledby')!)!;

/** The boxes of a title's first and last characters, in reading order. */
function ends(el: Element) {
  const text = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)!;
  const at = (i: number) => {
    const range = document.createRange();
    range.setStart(text, i);
    range.setEnd(text, i + 1);
    return range.getBoundingClientRect();
  };
  return { first: at(0), last: at(text.textContent!.length - 1) };
}

describe('stereo', () => {
  it.each([
    // [side, which way reading runs]
    ['left', 'up'],
    ['right', 'down'],
    ['top', 'across'],
    ['bottom', 'across'],
  ] as const)('a %s bar reads %s, never upside-down', (side, way) => {
    render(
      <MotifFrame title="COMPONENT" motif={stereo({ side })}>
        <div style={{ width: 160, height: 60 }} />
      </MotifFrame>,
    );
    const { first, last } = ends(titleOf('COMPONENT'));
    if (way === 'up') expect(first.top).toBeGreaterThan(last.top);
    if (way === 'down') expect(first.top).toBeLessThan(last.top);
    if (way === 'across') expect(first.left).toBeLessThan(last.left);
  });

  it.each(['left', 'right', 'top', 'bottom'] as const)('puts the %s bar on that edge, the content beside it', (side) => {
    render(
      <MotifFrame title="Audio" motif={stereo({ side })}>
        <div data-testid="content" style={{ width: 160, height: 60 }} />
      </MotifFrame>,
    );
    const bar = titleOf('Audio').parentElement!.getBoundingClientRect();
    const content = screen.getByTestId('content').getBoundingClientRect();
    if (side === 'left') expect(bar.right).toBeLessThanOrEqual(content.left);
    if (side === 'right') expect(bar.left).toBeGreaterThanOrEqual(content.right);
    if (side === 'top') expect(bar.bottom).toBeLessThanOrEqual(content.top);
    if (side === 'bottom') expect(bar.top).toBeGreaterThanOrEqual(content.bottom);
  });

  it.each([
    ['left', 'start', 'bottom'],
    ['left', 'end', 'top'],
    ['right', 'start', 'top'],
    ['right', 'end', 'bottom'],
  ] as const)('a %s bar holds a %s title at its %s', (side, labelAlign, edge) => {
    render(
      <MotifFrame title="IN" motif={stereo({ side, labelAlign })}>
        <div style={{ width: 160, height: 160 }} />
      </MotifFrame>,
    );
    const title = titleOf('IN').getBoundingClientRect();
    const bar = titleOf('IN').parentElement!.getBoundingClientRect();
    const gap = edge === 'top' ? title.top - bar.top : bar.bottom - title.bottom;
    expect(gap).toBeLessThan(12);
    expect(bar.height - title.height - gap).toBeGreaterThan(60);
  });
});

describe('notch', () => {
  it('sets a centered title on the top border, not inside the box', () => {
    render(
      <MotifFrame title="Wall" motif={notch()}>
        <div style={{ width: 240, height: 40 }} />
      </MotifFrame>,
    );
    const frame = group('Wall').getBoundingClientRect();
    const legend = group('Wall').querySelector('legend')!.getBoundingClientRect();
    expect(Math.abs(legend.top - frame.top)).toBeLessThan(1);
    expect(Math.abs(legend.left + legend.width / 2 - (frame.left + frame.width / 2))).toBeLessThan(2);
  });

  it('holds actions at the far end of the title line', () => {
    render(
      <MotifFrame title="Wall" motif={notch()} actions={<button type="button">clear</button>}>
        <div style={{ width: 240, height: 40 }} />
      </MotifFrame>,
    );
    const frame = group('Wall').getBoundingClientRect();
    const action = screen.getByRole('button', { name: 'clear' }).getBoundingClientRect();
    expect(frame.right - action.right).toBeLessThan(24);
  });
});

describe('tab', () => {
  it('rises from the top edge, outside the box it labels', () => {
    render(
      <MotifFrame title="Layers" motif={tab()}>
        <div data-testid="content" style={{ width: 200, height: 40 }} />
      </MotifFrame>,
    );
    const label = titleOf('Layers').parentElement!.getBoundingClientRect();
    const box = screen.getByTestId('content').parentElement!.getBoundingClientRect();
    expect(Math.abs(label.bottom - box.top)).toBeLessThan(1);
  });
});

/** sRGB bytes for any CSS color the browser can paint. */
function rgb(css: string): [number, number, number] {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r!, g!, b!];
}

function contrast(a: string, b: string) {
  const lum = (c: string) => {
    const [r, g, b] = rgb(c).map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const GRAYS = Array.from({ length: 17 }, (_, i) => `rgb(${i * 15.9375} ${i * 15.9375} ${i * 15.9375})`);
const HUES = ['#ffd600', '#00e5ff', '#e53935', '#1e40af', '#16a34a', '#d946ef', '#f97316', '#8c94ee'];
const THEME_TONES = Array.from({ length: 10 }, (_, i) => i);

describe('ink', () => {
  it.each([...GRAYS, ...HUES, ...THEME_TONES].map((t) => [t] as const))(
    'a plaque toned %s draws its title at 4.5:1 or better',
    (tone) => {
      render(
        <MotifFrame title="View" motif={plaque()} tone={tone}>
          x
        </MotifFrame>,
      );
      const fill = getComputedStyle(group('View')).backgroundColor;
      const ink = getComputedStyle(titleOf('View')).color;
      expect(contrast(fill, ink)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each([...GRAYS, ...HUES].map((t) => [t] as const))('a stereo bar toned %s draws its title at 4.5:1 or better', (tone) => {
    render(
      <MotifFrame title="IN" motif={stereo()} tone={tone}>
        x
      </MotifFrame>,
    );
    const bar = titleOf('IN').parentElement!;
    expect(contrast(getComputedStyle(bar).backgroundColor, getComputedStyle(titleOf('IN')).color)).toBeGreaterThanOrEqual(4.5);
  });
});
