import { contrastOver, parseComputedColor } from '@weasel-js/theme/testing/computedColor';
import { platinumTheme } from '@weasel-js/theme/themes/platinum';
import { afterEach, describe, expect, test } from 'vitest';
import { mountThemed, type Themed } from './testing/mountThemed';

// What a browser makes of the theme's pins: a bevel written with var() per
// mode, a striped strip with a patch behind its centered title, and the
// contrast the text ends up at.

let themed: Themed | undefined;
afterEach(() => {
  themed?.unmount();
  themed = undefined;
});

const css = (el: Element, pseudo?: string) => getComputedStyle(el, pseudo);
const inset = (color: string, offset: string) => `${color} ${offset} 0px 0px inset`;
const ring = (color: string, width: string, inside = true) => `${color} 0px 0px 0px ${width}${inside ? ' inset' : ''}`;

const LOOK = {
  light: { surface: 'rgb(221, 221, 221)', sunken: 'rgb(255, 255, 255)', fg: 'rgb(0, 0, 0)', light: 'rgb(255, 255, 255)', shade: 'rgb(136, 136, 136)' },
  dark: { surface: 'rgb(44, 44, 44)', sunken: 'rgb(22, 22, 22)', fg: 'rgb(240, 240, 240)', light: 'rgb(90, 90, 90)', shade: 'rgb(22, 22, 22)' },
} as const;
const OUTLINE = 'rgb(0, 0, 0)';

describe.each(['light', 'dark'] as const)('platinum in %s mode', (mode) => {
  const k = LOOK[mode];
  const raised = [ring(OUTLINE, '1px'), inset(k.shade, '-2px -2px'), inset(k.light, '2px 2px')].join(', ');
  const sunken = [inset(k.shade, '1px 1px'), inset(k.light, '-1px -1px'), ring(OUTLINE, '2px')].join(', ');

  test('a panel is a square face with a black outline and a two-tone edge', () => {
    themed = mountThemed(platinumTheme, { mode });
    const panel = css(themed.panel);
    expect(panel.backgroundColor).toBe(k.surface);
    expect(panel.boxShadow).toBe(raised);
    expect(panel.borderTopWidth).toBe('0px');
    expect(panel.borderRadius).toBe('0px');
  });

  test('a button is the same face with rounded corners, in the system face, with no glass', () => {
    themed = mountThemed(platinumTheme, { mode });
    const button = css(themed.button('Plain'));
    expect(button.backgroundColor).toBe(k.surface);
    expect(button.backgroundImage).toBe('none');
    expect(button.boxShadow).toBe(raised);
    expect(button.borderRadius).toBe('4px');
    expect(button.color).toBe(k.fg);
    expect(button.textShadow).toBe('none');
    expect(button.fontFamily).toMatch(/^Charcoal, Chicago, "Lucida Grande"/);
    expect(css(themed.button('Plain'), '::before').opacity).toBe('0');
  });

  test('a primary button adds a ring outside the outline, its label in the text color', () => {
    themed = mountThemed(platinumTheme, { mode });
    const button = css(themed.button('Main'));
    expect(button.backgroundColor).toBe(k.surface);
    expect(button.color).toBe(k.fg);
    expect(button.boxShadow).toBe(`${ring(OUTLINE, '2px', false)}, ${raised}`);
  });

  test('a button that stays down keeps its outline and takes a shaded top and left', () => {
    themed = mountThemed(platinumTheme, { mode });
    expect(css(themed.button('Held')).boxShadow).toBe([ring(OUTLINE, '1px'), inset(k.shade, '2px 2px')].join(', '));
  });

  test('a field is a square well: the sunken surface, outlined inside a soft edge', () => {
    themed = mountThemed(platinumTheme, { mode });
    const frame = css(themed.frame);
    expect(frame.backgroundColor).toBe(k.sunken);
    expect(frame.boxShadow).toBe(sunken);
    expect(frame.borderTopWidth).toBe('0px');
    expect(frame.borderRadius).toBe('0px');
  });

  test('a group under DefaultMotif is a window: pinstripes, with the title centered on a patch of the face', () => {
    themed = mountThemed(platinumTheme, { mode });
    expect(themed.group).toHaveAttribute('data-motif', 'titlebar');
    const strip = css(themed.strip);
    expect(strip.backgroundImage).toMatch(/repeating-linear-gradient\(/);
    expect(strip.color).toBe(k.fg);
    expect(css(themed.title).backgroundColor).toBe(k.surface);
    expect(css(themed.title).paddingLeft).toBe('6px');
    const [box, title] = [themed.strip.getBoundingClientRect(), themed.title.getBoundingClientRect()];
    expect(Math.abs(title.left - box.left - (box.right - title.right))).toBeLessThan(2);
    expect(css(themed.group).boxShadow).toBe(raised);
  });

  test('text and both emphasis steps clear WCAG 4.5:1 on the panel and in the field', () => {
    themed = mountThemed(platinumTheme, { mode });
    for (const ground of [themed.panel, themed.frame]) {
      const bg = parseComputedColor(css(ground).backgroundColor);
      for (const step of ['fg', 'muted', 'subtle'] as const) {
        expect(contrastOver(parseComputedColor(css(themed.text(step)).color), bg), step).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test('a container below the theme still overrides a pinned hook', () => {
    themed = mountThemed(platinumTheme, { mode });
    expect(css(themed.button('Quiet')).boxShadow).toBe('none');
  });
});

test.each([
  ['compact', '20px', '12px'],
  ['comfortable', '24px', '13px'],
  ['roomy', '28px', '15px'],
])('at %s density a button and a field are %s tall, with %s type', (density, height, size) => {
  themed = mountThemed(platinumTheme, { mode: 'light', density });
  expect(css(themed.button('Plain')).height).toBe(height);
  expect(css(themed.frame).height).toBe(height);
  expect(css(themed.button('Plain')).fontSize).toBe(size);
});

test('with no mode named, it opens in light', () => {
  themed = mountThemed(platinumTheme, {});
  expect(themed.host).toHaveAttribute('data-wzl-mode', 'light');
  expect(css(themed.panel).backgroundColor).toBe(LOOK.light.surface);
});
