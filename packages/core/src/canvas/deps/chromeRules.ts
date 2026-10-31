/**
 * The `chromeRules` dep: the canvas's chrome-visibility rules, read and set
 * at run time, for an action that shows or hides a piece of chrome.
 */
import { useCallback, useMemo, useState } from 'react';
import { useLatest } from '@weasel-js/react';
import type { VisibilityRules } from 'domains/chrome-caps';

/** One chrome id's rule, as `VisibilityRules` holds it. */
export type VisibilityRule = NonNullable<VisibilityRules[string]>;

/** Read and set the rule in force for a chrome id. */
export interface ChromeRulesDep {
  /** The rule in force for `id`, or undefined where none is set, which shows it. */
  get(id: string): VisibilityRule | undefined;
  /** Put `rule` in force for `id`, over the presets' rule and `chromeVisibility`'s. */
  set(id: string, rule: VisibilityRule): void;
}

declare module '@weasel-js/routing' {
  interface DepSchema {
    /** The canvas's chrome-visibility rules. Sourced by `<SceneCanvas>`, whose
     *  `set` lays a rule over its presets' and its `chromeVisibility` prop's
     *  until it unmounts; an app keeping these as preferences sources its own. */
    chromeRules?: ChromeRulesDep;
  }
}

/**
 * The rules set through the dep over `rules`, and the dep that reads and sets
 * them. Its identity is stable.
 */
export function useChromeRulesDep(rules: VisibilityRules): { rules: VisibilityRules; dep: ChromeRulesDep } {
  const [overrides, setOverrides] = useState<VisibilityRules>({});
  const merged = useMemo(() => ({ ...rules, ...overrides }), [rules, overrides]);
  const mergedRef = useLatest(merged);
  const set = useCallback((id: string, rule: VisibilityRule) => {
    setOverrides((prev) => (prev[id] === rule ? prev : { ...prev, [id]: rule }));
  }, []);
  const dep = useMemo<ChromeRulesDep>(() => ({ get: (id) => mergedRef.current[id], set }), [mergedRef, set]);
  return { rules: merged, dep };
}
