import { fullSelection, resolveTheme, type AxisDefs, type ResolvedTheme, type Selection, type Theme, type ThemeDefinition } from '@weasel-js/theme';
import { derive, mergeChain, type DeriveResult, type Lookup } from '@weasel-js/theme/engine';
import { runtimeTheme } from './model';

export interface ModeView {
  /** `undefined` when the theme declares no mode axis. */
  readonly mode: string | undefined;
  readonly selection: Selection;
  readonly result: DeriveResult;
  readonly resolved: ResolvedTheme;
}

export interface DerivedDraft {
  readonly merged: ThemeDefinition;
  readonly axes: AxisDefs;
  readonly theme: Theme;
  readonly views: readonly ModeView[];
  /** The view at the default mode: what counts and single-value columns read. */
  readonly primary: ModeView;
}

/** Everything the workbench shows for one draft. Throws as `derive` does, on a cycle or a dangling reference. */
export function deriveDraft(def: ThemeDefinition, lookup: Lookup, axisValues: Selection): DerivedDraft {
  const merged = mergeChain(def, lookup);
  const axes = merged.axes ?? {};
  const theme = runtimeTheme(def, lookup, `draft-${def.name}`);
  const modes = axes.mode ? Object.keys(axes.mode.values) : [undefined];
  const views = modes.map((mode) => {
    const selection = fullSelection(axes, mode === undefined ? axisValues : { ...axisValues, mode });
    return { mode, selection, result: derive(def, selection, lookup), resolved: resolveTheme(theme, selection) };
  });
  const primary = views.find((v) => v.mode === axes.mode?.default) ?? views[0];
  return { merged, axes, theme, views, primary };
}
