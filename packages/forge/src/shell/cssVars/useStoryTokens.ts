import { inferTokenType, type TokenEntry, usePersistedState } from '@weasel-js/labkit';
import { TOKEN_MANIFEST } from '@weasel-js/theme';
import { useMemo } from 'react';
import type { CssVarReport } from '../../protocol/messages';

const MANIFEST = new Map(TOKEN_MANIFEST.map((token) => [token.name, token]));

/** A reported var's group: its name without the leading dashes or its last segment, which names the step. */
function groupOf(name: string): string {
  const segments = name.replace(/^--/, '').split('-');
  return segments.length > 1 ? segments.slice(0, -1).join('-') : name.replace(/^--/, '');
}

export interface StoryTokens {
  readonly tokens: TokenEntry[];
  readonly showUnused: boolean;
  readonly setShowUnused: (show: boolean) => void;
  /** What the panel says when it lists none of them. */
  readonly emptyText: string;
}

/** The vars a trial's frame reports, the ones its story doesn't use left out until asked for. */
export function useStoryTokens(vars: readonly CssVarReport[]): StoryTokens {
  const [showUnused, setShowUnused] = usePersistedState('fg-css-vars-unused', false, { scope: 'lab' });
  const tokens = useMemo<TokenEntry[]>(
    () =>
      vars.flatMap(({ name, value, used }) => {
        if (!used && !showUnused) return [];
        const known = MANIFEST.get(name);
        return [{ name, type: known?.type ?? inferTokenType(value), group: known?.group ?? groupOf(name), value }];
      }),
    [vars, showUnused],
  );
  const emptyText = vars.length > 0 && !showUnused ? 'The story uses no variables.' : 'The story’s frame has reported no variables.';
  return { tokens, showUnused, setShowUnused, emptyText };
}
