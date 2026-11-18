import { type TokenScale, usePersistedState } from '@weasel-js/labkit';
import { getOwn } from '@weasel-js/registry';
import { useMemo } from 'react';
import type { ToFrame } from '../../protocol/messages';
import { type CssOverrides, useCssOverrides } from './overrides';
import { scaleValuesFor } from './themeScales';
import { useVarsHistory, type VarsHistory, type VarsState } from './varsHistory';

/** The CSS variable edits of the trial this is rendered inside, and how to make one. */
export interface VarsEdits {
  readonly overrides: CssOverrides;
  /** The scale each edited group's overrides were generated from. */
  readonly edited: Readonly<Record<string, TokenScale>>;
  readonly history: VarsHistory;
  /** Override one variable, or with `null` drop its override. */
  write(name: string, value: string | null): void;
  /** Regenerate a group's scale from `next`, overriding each of its steps. */
  editScale(group: string, next: TokenScale): void;
}

/**
 * The trial's variable overrides and scale edits, each change one undoable step, with every override a step puts in
 * force or takes away sent to the trial's frame by `send`.
 */
export function useVarsEdits(send: ((msg: ToFrame) => void) | null): VarsEdits {
  const [overrides, setOverrides] = useCssOverrides();
  const [edited, setEdited] = usePersistedState<Readonly<Record<string, TokenScale>>>('fg-css-vars-scales', {}, { scope: 'trial' });
  const state = useMemo<VarsState>(() => ({ overrides, scales: edited }), [overrides, edited]);
  const history = useVarsHistory(state, (from, to) => {
    setOverrides(to.overrides);
    setEdited(to.scales);
    for (const name of new Set([...Object.keys(from.overrides), ...Object.keys(to.overrides)])) {
      if (getOwn(from.overrides, name) !== getOwn(to.overrides, name)) send?.({ type: 'vars.set', name, value: getOwn(to.overrides, name) ?? null });
    }
  });
  const write = (name: string, value: string | null) => {
    const now = history.current();
    const { [name]: _dropped, ...rest } = now.overrides;
    history.commit({ ...now, overrides: value === null ? rest : { ...rest, [name]: value } }, `token:${name}`);
  };
  const editScale = (group: string, next: TokenScale) => {
    const values = scaleValuesFor(group, next);
    if (!values) return;
    const now = history.current();
    history.commit(
      { overrides: { ...now.overrides, ...Object.fromEntries(values) }, scales: { ...now.scales, [group]: next } },
      `scale:${group}`,
    );
  };
  return { overrides, edited, history, write, editScale };
}
