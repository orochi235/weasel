import type { MeasureEnv } from '@weasel-js/ui-logic';
import { cachedFontVariant, metricsOf } from '@weasel-js/font';
import { expandVars, type ResolvedTheme } from '@weasel-js/theme';
import { measureLabel } from './menu/measureLabel';

/**
 * A HUD's {@link MeasureEnv}: tokens from its resolved theme, and text measured in `font`, the face a widget draws
 * with, whatever family the component asks for. The atlas has one weight, so weight is not measured. `overrides`
 * set tokens over the theme: a widget option that stands for one (`fontSize` for `--wzl-field-font-size`).
 */
export function hudMeasureEnv(
  ctx: { tokens: ResolvedTheme; defaultFont: string }, font?: string, overrides?: Readonly<Record<string, string>>,
): MeasureEnv {
  const family = font ?? ctx.defaultFont;
  const tokens = ctx.tokens as Readonly<Record<string, string>>;
  return {
    token(name) {
      const raw = overrides?.[name] ?? tokens[name];
      return raw !== undefined && raw.includes('var(') ? expandVars(raw, tokens) : raw;
    },
    text: (text, spec) => ({ width: measureLabel(text, spec.size, family), ...lineExtent(family, spec.size) }),
  };
}

/** The ascent and descent a line of `size` px text in `family` is set with: its face's, else an estimate. */
export function lineExtent(family: string, size: number): { ascent: number; descent: number } {
  const metrics = metricsOf(cachedFontVariant(family, 400, 'normal'));
  const em = metrics ? size / metrics.size : 0;
  return {
    ascent: metrics ? metrics.ascent * em : size * 0.8,
    descent: metrics?.descent !== undefined ? metrics.descent * em : size * 0.2,
  };
}
