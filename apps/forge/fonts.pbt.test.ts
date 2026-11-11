/**
 * The workshop app's font, theme, and mode globals, on any values a URL can hand them, names every
 * `Object.prototype` member answers to included: `fontRule` and `fontTheme` never throw, snap weight and width to
 * what the chosen family ships, and fall back to Oswald or the theme's own face for a name the table lacks; the
 * toolbar's `shows` agrees with the snapping; and `resolveMode` follows the OS for anything but light or dark.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { weaselTheme } from '@weasel-js/theme';
import { FONT_GLOBALS, fontRule, fontTheme } from './fonts';
import { resolveMode } from './mode';

const RUNS = Number(globalThis.process?.env?.WEASEL_PBT_RUNS) > 0 ? Number(process.env.WEASEL_PBT_RUNS) : 200;
const PROTO = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf'];

const family = fc.constantFrom('oswald', 'helvetica', 'inter', 'mono', 'theme', 'nope', '', ...PROTO);
const globals = fc.record(
  {
    fontFamily: family,
    fontDisplay: family,
    fontBody: family,
    fontMono: family,
    fontWeight: fc.oneof(fc.constantFrom('100', '450', '900', 'bold', '', 'NaN', '1e400'), fc.integer({ min: -100, max: 2000 }).map(String)),
    fontStretch: fc.constantFrom('condensed', 'normal', 'ultra-expanded', 'squished', ...PROTO),
    fontStyle: fc.constantFrom('italic', 'normal', 'oblique', ...PROTO),
  },
  { requiredKeys: [] },
);

const familyOf = (rule: string, slot: string) => new RegExp(`--wzl-font-${slot}: ([^;]+);`).exec(rule)?.[1];

describe('fontRule and fontTheme', () => {
  it('never throw, and give each slot a family from the table or leave it to the theme', () => {
    const offered = new Set(FONT_GLOBALS.fontFamily!.options.map((o) => o.value));
    fc.assert(
      fc.property(globals, (g) => {
        const rule = fontRule(g);
        const theme = fontTheme(weaselTheme, g);
        expect(theme.extends).toBe(weaselTheme);
        const ui = familyOf(rule, 'ui');
        expect(ui).toBeDefined();
        if (!offered.has(String(g.fontFamily))) expect(ui).toBe(familyOf(fontRule({}), 'ui'));
        for (const [slot, value] of [['display', g.fontDisplay], ['body', g.fontBody], ['mono', g.fontMono]] as const) {
          if (offered.has(String(value))) expect(familyOf(rule, slot)).toBeDefined();
          else expect(familyOf(rule, slot)).toBeUndefined();
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('snaps weight and width to ones the toolbar offers for the family, and shows the snapped ones', () => {
    fc.assert(
      fc.property(globals, (g) => {
        const rule = fontRule(g);
        const weight = /font-weight: ([^;]+);/.exec(rule)![1]!;
        const stretch = /font-stretch: ([^;]+);/.exec(rule)![1]!;
        expect(FONT_GLOBALS.fontWeight!.shows!(weight, g)).toBe(true);
        expect(FONT_GLOBALS.fontStretch!.shows!(stretch, g)).toBe(true);
        const italic = /font-style: ([^;]+);/.exec(rule)![1];
        if (italic === 'italic') expect(FONT_GLOBALS.fontStyle!.shows!('italic', g)).toBe(true);
      }),
      { numRuns: RUNS },
    );
  });
});

describe('resolveMode', () => {
  it('keeps light and dark and follows the OS for anything else', () => {
    fc.assert(
      fc.property(fc.oneof(fc.constantFrom('light', 'dark', 'auto', ...PROTO), fc.anything()), fc.constantFrom('light', 'dark' as const), (picked, system) => {
        expect(resolveMode(picked, system)).toBe(picked === 'light' || picked === 'dark' ? picked : system);
      }),
      { numRuns: RUNS },
    );
  });
});
