import { always, never, type ChromeRulesDep, type Contribution, type VisibilityRules } from '@weasel-js/core';
import { PATH_EDIT_AID_CHROME_IDS, pathEditAidsVisibility, type PathEditAids } from '@weasel-js/path-tools';
import { useMemo } from 'react';
import { drawPrefs, usePrefGroup } from './prefs';

type Aid = keyof PathEditAids;

/** Each path-edit aid's chrome id, and the setting in the View preferences' Path editing group that shows it. */
const AID_OF: ReadonlyMap<string, Aid> = new Map(
  Object.entries(PATH_EDIT_AID_CHROME_IDS).map(([aid, id]) => [id, aid as Aid]),
);

/** The `chromeRules` dep over the View preferences: an aid's rule is its preference, and setting one writes it.
 *  Every other id is the canvas's own. */
function prefsChromeRules(below: () => ChromeRulesDep | undefined): ChromeRulesDep {
  return {
    get: (id) => {
      const aid = AID_OF.get(id);
      return aid === undefined ? below()?.get(id) : drawPrefs().get(`view.pathEditing.${aid}`) ? always : never;
    },
    set: (id, rule) => {
      const aid = AID_OF.get(id);
      if (aid === undefined) below()?.set(id, rule);
      else drawPrefs().set(`view.pathEditing.${aid}`, rule !== never);
    },
  };
}

/**
 * Path edit's aids — direction, curvature comb, poise lines, and fillet widgets — driven by the View preferences'
 * Path editing group: the chrome rules that show or hide them on the canvas, and an entry sourcing the
 * `chromeRules` dep the `pathEdit.show.*` toggles write, so a toggle sets the preference.
 */
export function usePathOverlays(): { chromeVisibility: VisibilityRules; contribution: Contribution } {
  const [aids] = usePrefGroup('view.pathEditing');
  const chromeVisibility = useMemo(() => pathEditAidsVisibility(aids), [aids]);
  const contribution = useMemo<Contribution>(() => ({
    id: 'draw.pathOverlays',
    eligibility: { always: true },
    deps: { chromeRules: (below) => prefsChromeRules(below) },
    watch: (changed) => drawPrefs().subscribe(changed),
  }), []);
  return { chromeVisibility, contribution };
}
