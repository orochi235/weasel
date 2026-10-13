import type { TokenEntry } from '@weasel-js/labkit';
import { isColorModePreference, resolveTheme, TOKEN_MANIFEST, themeAxes, weaselTheme } from '@weasel-js/theme';
import { useResolvedColorMode } from '@weasel-js/theme/react';
import { useMemo } from 'react';
import type { CssVarReport, Globals } from '../../protocol/messages';
import { selectionFor } from './saveScales';

const AXES = themeAxes(weaselTheme);

/**
 * The theme's tokens as a trial shows them: each at the value its frame reports, or, for one the frame has not
 * reported, at what the theme gives it under the trial's globals. A mode global naming a preference follows the OS.
 */
export function useThemeTokens(globals: Globals, vars: readonly CssVarReport[]): TokenEntry[] {
  const { mode } = globals;
  const osMode = useResolvedColorMode(isColorModePreference(mode) ? mode : 'auto');
  const themed = useMemo<Readonly<Record<string, string>>>(() => {
    const selection = selectionFor(AXES, globals);
    return resolveTheme(weaselTheme, 'mode' in AXES ? { mode: osMode, ...selection } : selection);
  }, [globals, osMode]);
  return useMemo(() => {
    const reported = new Map(vars.map((v) => [v.name, v.value]));
    return TOKEN_MANIFEST.map((token) => ({
      name: token.name,
      type: token.type,
      group: token.group,
      value: reported.get(token.name) ?? themed[token.name] ?? token.defaultValue,
      description: token.description,
    }));
  }, [vars, themed]);
}
