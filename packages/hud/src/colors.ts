import { colorLiteralToHex, type ColorSource } from '@weasel-js/paint';
import { colorSourceLiteral, type ColorSourceContext } from '@weasel-js/theme';

/**
 * What a draw context's `color` is built from: a source resolved against
 * `ctx` to a hex a canvas can draw. `undefined` for a source nothing answers,
 * and for a custom property only a cascade could resolve.
 */
export function hudColor(ctx: ColorSourceContext): (source: ColorSource) => string | undefined {
  return (source) => {
    const literal = colorSourceLiteral(source, ctx);
    return (literal && colorLiteralToHex(literal)) ?? undefined;
  };
}
