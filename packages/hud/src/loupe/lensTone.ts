import { resolveCurrentColor, type ResolvedTheme } from '@weasel-js/theme';

/** Theme token `name` as a color a draw command takes: a `currentColor` form flattened against the foreground. */
export const lensTone = (t: ResolvedTheme, name: keyof ResolvedTheme): string => resolveCurrentColor(t[name], t['--wzl-fg']);
