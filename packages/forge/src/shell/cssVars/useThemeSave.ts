import { type AxisDefs, THEME_SOURCES } from '@weasel-js/theme';
import { httpThemeApi, type ThemeApi } from '@weasel-js/theme/engine';
import { useMemo, useState } from 'react';
import type { Globals } from '../../protocol/messages';
import type { CssOverrides } from './overrides';
import { applyScaleEdits, type ScaleEdit } from './saveScales';
import { applyTokenEdits, writtenOut } from './saveTokens';
import { useTrialSelection } from './useTrialSelection';
import type { VarsHistory } from './varsHistory';

export const THEME_NAME = 'weasel';
export const TOKEN_PREFIX = '--wzl-';
const NO_AXES: AxisDefs = {};

type Notice = { readonly trialId: string | null; readonly outcome: 'saved' | 'error'; readonly text: string };

/** A scale whose steps all hold what its edit generated. */
export interface UnsavedScale {
  /** The scale's name in the definition. */
  readonly name: string;
  /** The panel's group for it, which its edit is kept under. */
  readonly group: string;
  readonly tokens: readonly string[];
  readonly edit: ScaleEdit;
}

export interface ThemeSaveOptions {
  readonly trialId: string | null;
  /** The globals the trial renders under, which pick the axis values a save writes into. */
  readonly globals: Globals;
  /** Where a save goes. Defaults to the dev server's theme store. */
  readonly themeApi: ThemeApi | undefined;
  readonly scales: readonly UnsavedScale[];
  readonly overrides: CssOverrides;
  readonly history: VarsHistory;
}

export interface ThemeSave {
  /** Whether any edit has a place in the definition to be saved to. */
  readonly pending: boolean;
  readonly saving: boolean;
  readonly notice: Omit<Notice, 'trialId'> | null;
  save(): Promise<void>;
}

/**
 * Saves a trial's edits into the theme's definition file: each clean scale edit, and each token edited by hand whose
 * value the definition writes out. Every other override stays the trial's own.
 */
export function useThemeSave({ trialId, globals, themeApi, scales, overrides, history }: ThemeSaveOptions): ThemeSave {
  const definition = THEME_SOURCES[THEME_NAME];
  const selection = useTrialSelection(definition?.axes ?? NO_AXES, globals);
  const tokens = useMemo(() => {
    if (!definition) return {};
    const generated = new Set(scales.flatMap((scale) => scale.tokens));
    return Object.fromEntries(
      Object.entries(overrides).flatMap(([name, value]) => {
        if (!name.startsWith(TOKEN_PREFIX) || generated.has(name)) return [];
        const token = name.slice(TOKEN_PREFIX.length);
        return writtenOut(definition, token, selection) ? [[token, value]] : [];
      }),
    );
  }, [definition, selection, scales, overrides]);

  const [saving, setSaving] = useState(false);
  const [held, setHeld] = useState<Notice | null>(null);
  const setNotice = (next: Omit<Notice, 'trialId'> | null) => setHeld(next && { ...next, trialId });

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const api = themeApi ?? httpThemeApi();
      const stored = await api.get(THEME_NAME);
      const file = `themes/${THEME_NAME}.json`;
      if (JSON.stringify(stored.definition) !== JSON.stringify(THEME_SOURCES[THEME_NAME])) {
        setNotice({ outcome: 'error', text: `${file} has changed since this page loaded. Reload to edit against it.` });
        return;
      }
      const scaled = applyScaleEdits(stored.definition, Object.fromEntries(scales.map((s) => [s.name, s.edit])), selection);
      const next = scaled.ok ? applyTokenEdits(scaled.definition, tokens, selection) : scaled;
      if (!next.ok) {
        setNotice({ outcome: 'error', text: next.message });
        return;
      }
      const result = await api.put(THEME_NAME, next.definition, stored.hash);
      if (result.status === 'conflict') {
        setNotice({ outcome: 'error', text: `${file} changed on disk while saving. Nothing was written; reload to edit against it.` });
        return;
      }
      if (result.status === 'invalid') {
        setNotice({ outcome: 'error', text: result.message });
        return;
      }
      // What was saved is the theme's own now, so nothing from before the save has a value to go back to.
      const saved = new Set([
        ...scales.flatMap((scale) => scale.tokens),
        ...Object.keys(tokens).map((token) => `${TOKEN_PREFIX}${token}`),
      ]);
      const groups = new Set(scales.map((scale) => scale.group));
      const now = history.current();
      history.reset({
        overrides: Object.fromEntries(Object.entries(now.overrides).filter(([name]) => !saved.has(name))),
        scales: Object.fromEntries(Object.entries(now.scales).filter(([group]) => !groups.has(group))),
      });
      setNotice(
        result.regenerated || result.problems.length === 0
          ? { outcome: 'saved', text: `Saved to ${file}.` }
          : { outcome: 'error', text: `Saved to ${file}, but the tokens were not regenerated: ${result.problems.join('; ')}` },
      );
    } catch (e) {
      setNotice({ outcome: 'error', text: `Saving needs forge's dev server, which did not answer: ${(e as Error).message}` });
    } finally {
      setSaving(false);
    }
  };

  return {
    pending: scales.length > 0 || Object.keys(tokens).length > 0,
    saving,
    notice: held?.trialId === trialId ? held : null,
    save,
  };
}
