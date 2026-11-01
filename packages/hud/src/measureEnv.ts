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
    text(text, spec) {
      const metrics = metricsOf(cachedFontVariant(family, 400, 'normal'));
      const em = metrics ? spec.size / metrics.size : 0;
      return {
        width: measureLabel(text, spec.size, family),
        ascent: metrics ? metrics.ascent * em : spec.size * 0.8,
        descent: metrics?.descent !== undefined ? metrics.descent * em : spec.size * 0.2,
      };
    },
  };
}
