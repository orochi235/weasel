import { TOKEN_MANIFEST } from './generated/manifest';
import type { ResolvedTheme } from './resolveTheme';
import type { TokenName } from './generated/themes';

const DEFAULTS = new Map<string, string>(TOKEN_MANIFEST.map((t) => [t.name, t.defaultValue]));

/**
 * A px-valued token as a number, for code that draws rather than styles —
 * SVG geometry attributes, canvas, WebGL. Pass `resolved` (from
 * `useTheme().resolved`) where a live theme override must reach the drawing;
 * without it the built-in theme's value is used, which is static and costs no
 * style resolution.
 *
 * Throws rather than guessing: a token that is not a plain px length has no
 * number, and silently returning 0 collapses whatever it sized.
 */
export function tokenPx(name: TokenName, resolved?: ResolvedTheme): number {
  const raw = resolved?.[name] ?? DEFAULTS.get(name);
  const m = /^(-?\d*\.?\d+)px$/.exec((raw ?? '').trim());
  if (!m) throw new Error(`tokenPx: ${name} is not a px length (${raw ?? 'unknown token'})`);
  return Number(m[1]);
}
