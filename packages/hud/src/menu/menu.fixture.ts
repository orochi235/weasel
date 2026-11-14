/**
 * The theme and metrics hud's menu tests measure in. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import { resolveTheme, weaselTheme, type ResolvedTheme } from '@weasel-js/theme';
import { menuPanelMetrics, type MeasureEnv, type MenuPanelMetrics } from '@weasel-js/ui-logic';
import { menuMeasureEnv } from './menuEnv';

export const THEME: ResolvedTheme = resolveTheme(weaselTheme);

/** The built-in theme's tokens with `over` on top: a test ctx's `tokens`. */
export const menuTokens = (over: Readonly<Record<string, string>> = {}): ResolvedTheme =>
  ({ ...THEME, ...over }) as ResolvedTheme;

/** A menu env in `tokens` whose text is as wide as `width` says. */
export const envOf = (tokens: ResolvedTheme, width: (text: string) => number): MeasureEnv =>
  menuMeasureEnv(tokens, '', (t) => width(t));

/** A menu env in `tokens` whose text is `perChar` px a character. */
export const charEnv = (perChar: number, tokens: ResolvedTheme = THEME): MeasureEnv =>
  envOf(tokens, (t) => t.length * perChar);

/** The built-in theme's menu metrics. */
export const THEME_METRICS: MenuPanelMetrics = menuPanelMetrics(charEnv(0));

/** A theme to size a menu in: the built-in one, or one whose sizing tokens vary. */
export const menuTheme: fc.Arbitrary<{ tokens: ResolvedTheme; m: MenuPanelMetrics }> = fc.oneof(
  fc.constant(THEME),
  fc.record({
    h: fc.integer({ min: 12, max: 40 }), s1: fc.integer({ min: 0, max: 6 }), s2: fc.integer({ min: 0, max: 8 }),
    font: fc.integer({ min: 8, max: 24 }),
  }).map(({ h, s1, s2, font }) => menuTokens({
    '--wzl-control-h-sm': `${h}px`, '--wzl-space-1': `${s1}px`, '--wzl-space-2': `${s2}px`, '--wzl-font-size': `${font}px`,
  })),
).map((tokens) => ({ tokens, m: menuPanelMetrics(charEnv(0, tokens)) }));
