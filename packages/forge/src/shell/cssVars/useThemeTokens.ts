import type { TokenEntry } from '@weasel-js/labkit';
import { resolveTheme, TOKEN_MANIFEST, themeAxes, weaselTheme } from '@weasel-js/theme';
import { useMemo } from 'react';
import type { CssVarReport, Globals } from '../../protocol/messages';
import { useTrialSelection } from './useTrialSelection';

const AXES = themeAxes(weaselTheme);

/**
 * The theme's tokens as a trial shows them: each at the value its frame reports, or, for one the frame has not
 * reported, at what the theme gives it under the trial's globals.
 */
export function useThemeTokens(globals: Globals, vars: readonly CssVarReport[]): TokenEntry[] {
  const selection = useTrialSelection(AXES, globals);
  const themed = useMemo<Readonly<Record<string, string>>>(() => resolveTheme(weaselTheme, selection), [selection]);
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
