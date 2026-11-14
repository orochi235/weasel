import type { MeasureEnv } from '@weasel-js/ui-logic';
import type { ResolvedTheme } from '@weasel-js/theme';
import { hudMeasureEnv, lineExtent } from '../measureEnv';

/** A menu's {@link MeasureEnv}: `tokens`, and text as wide as `width` says, which is the menu's own measure, or an
 *  estimate before the hud has drawn. Ascents come from `family`'s face, and are estimated while `family` is `''`. */
export function menuMeasureEnv(
  tokens: ResolvedTheme, family: string, width: (text: string, fontSize: number) => number,
): MeasureEnv {
  const { token } = hudMeasureEnv({ tokens, defaultFont: family });
  return {
    token,
    text: (text, font) => ({
      width: width(text, font.size),
      ...(family === '' ? { ascent: font.size * 0.8, descent: font.size * 0.2 } : lineExtent(family, font.size)),
    }),
  };
}
