import { contrastOver, parseComputedColor } from '@weasel-js/theme/testing/computedColor';
import { win9xTheme } from '@weasel-js/theme/themes/win9x';
import { afterEach, describe, expect, test } from 'vitest';
import { mountThemed, type Themed } from './testing/mountThemed';

// A theme's pins are only token values until a browser resolves them: whether
// a bevel written with var() follows the mode, whether a hook reaches the
// face it is for, and what the text ends up reading at.

let themed: Themed | undefined;
afterEach(() => {
  themed?.unmount();
  themed = undefined;
});

const css = (el: Element, pseudo?: string) => getComputedStyle(el, pseudo);
const inset = (color: string, offset: string) => `${color} ${offset} 0px 0px inset`;

const LOOK = {
  light: {
    surface: 'rgb(192, 192, 192)',
    sunken: 'rgb(255, 255, 255)',
    fg: 'rgb(0, 0, 0)',
    light: 'rgb(255, 255, 255)',
    faceLight: 'rgb(223, 223, 223)',
    shade: 'rgb(128, 128, 128)',
    dark: 'rgb(0, 0, 0)',
  },
  dark: {
    surface: 'rgb(42, 42, 42)',
    sunken: 'rgb(20, 20, 20)',
    fg: 'rgb(240, 240, 240)',
    light: 'rgb(90, 90, 90)',
    faceLight: 'rgb(60, 60, 60)',
    shade: 'rgb(20, 20, 20)',
    dark: 'rgb(0, 0, 0)',
  },
} as const;

describe.each(['light', 'dark'] as const)('win9x in %s mode', (mode) => {
  const k = LOOK[mode];
  const raised = [inset(k.dark, '-1px -1px'), inset(k.light, '1px 1px'), inset(k.shade, '-2px -2px'), inset(k.faceLight, '2px 2px')].join(', ');
  const sunken = [inset(k.light, '-1px -1px'), inset(k.shade, '1px 1px'), inset(k.faceLight, '-2px -2px'), inset(k.dark, '2px 2px')].join(', ');
  const pressed = [inset(k.light, '-1px -1px'), inset(k.dark, '1px 1px'), inset(k.faceLight, '-2px -2px'), inset(k.shade, '2px 2px')].join(', ');

  test('a panel is a square gray face in a raised bevel, with no border of its own', () => {
    themed = mountThemed(win9xTheme, { mode });
    const panel = css(themed.panel);
    expect(panel.backgroundColor).toBe(k.surface);
    expect(panel.boxShadow).toBe(raised);
    expect(panel.borderTopWidth).toBe('0px');
    expect(panel.borderRadius).toBe('0px');
  });

  test('a button is a flat face in the same bevel, in the system sans, with no glass', () => {
    themed = mountThemed(win9xTheme, { mode });
    const button = css(themed.button('Plain'));
    expect(button.backgroundColor).toBe(k.surface);
    expect(button.backgroundImage).toBe('none');
    expect(button.boxShadow).toBe(raised);
    expect(button.borderRadius).toBe('0px');
    expect(button.color).toBe(k.fg);
    expect(button.textShadow).toBe('none');
    expect(button.fontFamily).toMatch(/^"MS Sans Serif", "Microsoft Sans Serif", Tahoma/);
    expect(css(themed.button('Plain'), '::before').opacity).toBe('0');
  });

  test('a primary button is the same face in a heavier frame, its label in the text color', () => {
    themed = mountThemed(win9xTheme, { mode });
    const button = css(themed.button('Main'));
    expect(button.backgroundColor).toBe(k.surface);
    expect(button.color).toBe(k.fg);
    expect(button.boxShadow).toBe(
      [`${k.dark} 0px 0px 0px 1px inset`, inset(k.dark, '-2px -2px'), inset(k.light, '2px 2px'), inset(k.shade, '-3px -3px'), inset(k.faceLight, '3px 3px')].join(', '),
    );
  });

  test('a button that stays down wears the pressed bevel', () => {
    themed = mountThemed(win9xTheme, { mode });
    expect(css(themed.button('Held')).boxShadow).toBe(pressed);
  });

  test('a field is a well: the sunken surface in the sunken bevel, with no border', () => {
    themed = mountThemed(win9xTheme, { mode });
    const frame = css(themed.frame);
    expect(frame.backgroundColor).toBe(k.sunken);
    expect(frame.boxShadow).toBe(sunken);
    expect(frame.borderTopWidth).toBe('0px');
    expect(frame.borderRadius).toBe('0px');
  });

  test('a group under DefaultMotif is a window: a navy-to-blue strip, a bold white title, a raised frame', () => {
    themed = mountThemed(win9xTheme, { mode });
    expect(themed.group).toHaveAttribute('data-motif', 'titlebar');
    const strip = css(themed.strip);
    expect(strip.backgroundImage).toBe('linear-gradient(90deg, rgb(0, 0, 128), rgb(16, 132, 208))');
    expect(strip.color).toBe('rgb(255, 255, 255)');
    expect(strip.fontWeight).toBe('700');
    expect(css(themed.title).textTransform).toBe('none');
    expect(css(themed.group).boxShadow).toBe(raised);
    expect(css(themed.group).borderTopWidth).toBe('0px');
  });

  test('text and both emphasis steps clear WCAG 4.5:1 on the panel and in the field', () => {
    themed = mountThemed(win9xTheme, { mode });
    for (const ground of [themed.panel, themed.frame]) {
      const bg = parseComputedColor(css(ground).backgroundColor);
      for (const step of ['fg', 'muted', 'subtle'] as const) {
        expect(contrastOver(parseComputedColor(css(themed.text(step)).color), bg), step).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test('a container below the theme still overrides a pinned hook', () => {
    themed = mountThemed(win9xTheme, { mode });
    expect(css(themed.button('Quiet')).boxShadow).toBe('none');
  });
});

test.each([
  ['compact', '21px', '11px'],
  ['comfortable', '23px', '12px'],
  ['roomy', '28px', '14px'],
])('at %s density a button and a field are %s tall, with %s type', (density, height, size) => {
  themed = mountThemed(win9xTheme, { mode: 'light', density });
  expect(css(themed.button('Plain')).height).toBe(height);
  expect(css(themed.frame).height).toBe(height);
  expect(css(themed.button('Plain')).fontSize).toBe(size);
});

test('with no mode named, it opens in light', () => {
  themed = mountThemed(win9xTheme, {});
  expect(themed.host).toHaveAttribute('data-wzl-mode', 'light');
  expect(css(themed.panel).backgroundColor).toBe(LOOK.light.surface);
});
