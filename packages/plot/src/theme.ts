import { THEMES, type ResolvedTheme } from '@weasel-js/theme';

/** The face a chart's text is set in. */
export interface PlotFont {
  fontFamily: string;
  fontSize: number;
}

/** The colors a chart is drawn in, by role, and its face. Plain strings, so a scene can keep it. */
export interface PlotTheme {
  /** Titles, labels and values. */
  text: string;
  /** Axis rules and ticks. */
  axis: string;
  /** Grid lines behind the marks. */
  grid: string;
  /** The colors series take in turn. Never empty. */
  series: readonly string[];
  font: PlotFont;
}

/** The weasel theme's swatches, in the order series take them. */
const SWATCHES = ['sky', 'amber', 'green', 'rose', 'violet', 'teal', 'citron', 'fuchsia', 'blue', 'red'] as const;

/** A plot theme from a resolved weasel theme: text in `fg`, axes in `border-strong`, grid in `border`, series in
 *  its swatches. */
export function plotThemeFrom(resolved: Readonly<Record<string, string>> | ResolvedTheme, font: PlotFont = PLOT_FONT): PlotTheme {
  const at = (token: string) => (resolved as Record<string, string>)[`--wzl-${token}`] ?? '#888888';
  return {
    text: at('fg'),
    axis: at('border-strong'),
    grid: at('border'),
    series: SWATCHES.map((s) => at(`swatch-${s}`)),
    font,
  };
}

/** 12px sans-serif. */
export const PLOT_FONT: PlotFont = { fontFamily: 'sans-serif', fontSize: 12 };

/** The weasel theme in its dark mode. */
export const PLOT_THEME: PlotTheme = plotThemeFrom(THEMES.weasel.selections['mode=dark,density=comfortable']);

/** The `i`th series' color, wrapping. */
export const seriesColor = (theme: PlotTheme, i: number): string =>
  theme.series[((i % theme.series.length) + theme.series.length) % theme.series.length] ?? theme.text;
