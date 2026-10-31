import {
  always, never, type ChromeRulesDep, type Contribution, type VisibilityRules,
} from '@weasel-js/core';
import {
  PATH_BALANCE_CHROME_ID, PATH_COMB_CHROME_ID, PATH_CORNERS_CHROME_ID, PATH_DIRECTION_CHROME_ID,
} from '@weasel-js/path-tools';
import { useMemo } from 'react';
import { drawPrefs, usePref } from './prefs';

/** Each path-edit overlay's chrome id, and the View preference that shows it. */
const OVERLAY_PREFS = {
  [PATH_DIRECTION_CHROME_ID]: 'view.pathDirection',
  [PATH_COMB_CHROME_ID]: 'view.pathComb',
  [PATH_BALANCE_CHROME_ID]: 'view.pathBalance',
  [PATH_CORNERS_CHROME_ID]: 'view.pathCorners',
} as const;

type OverlayId = keyof typeof OVERLAY_PREFS;
const isOverlay = (id: string): id is OverlayId => id in OVERLAY_PREFS;

/** The `chromeRules` dep over the View preferences: an overlay's rule is its preference, and setting one writes
 *  it. Every other id is the canvas's own. */
function prefsChromeRules(below: () => ChromeRulesDep | undefined): ChromeRulesDep {
  return {
    get: (id) => (isOverlay(id) ? (drawPrefs().get(OVERLAY_PREFS[id]) ? always : never) : below()?.get(id)),
    set: (id, rule) => {
      if (isOverlay(id)) drawPrefs().set(OVERLAY_PREFS[id], rule !== never);
      else below()?.set(id, rule);
    },
  };
}

/**
 * Path edit's overlays — direction, curvature comb, handle balance, and corner widgets — driven by one View
 * preference each: the chrome rules that show or hide them on the canvas, and an entry sourcing the `chromeRules`
 * dep the `pathEdit.show.*` toggles write, so a toggle sets the preference.
 */
export function usePathOverlays(): { chromeVisibility: VisibilityRules; contribution: Contribution } {
  const [direction] = usePref('view.pathDirection');
  const [comb] = usePref('view.pathComb');
  const [balance] = usePref('view.pathBalance');
  const [corners] = usePref('view.pathCorners');
  const chromeVisibility = useMemo<VisibilityRules>(() => ({
    [PATH_DIRECTION_CHROME_ID]: direction ? always : never,
    [PATH_COMB_CHROME_ID]: comb ? always : never,
    [PATH_BALANCE_CHROME_ID]: balance ? always : never,
    [PATH_CORNERS_CHROME_ID]: corners ? always : never,
  }), [direction, comb, balance, corners]);
  const contribution = useMemo<Contribution>(() => ({
    id: 'draw.pathOverlays',
    eligibility: { always: true },
    deps: { chromeRules: (below) => prefsChromeRules(below) },
    watch: (changed) => drawPrefs().subscribe(changed),
  }), []);
  return { chromeVisibility, contribution };
}
