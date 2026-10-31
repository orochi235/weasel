/**
 * Toggles for what path edit draws over the open path: one action per
 * overlay, each flipping that overlay's chrome rule between `always` and
 * `never` through the `chromeRules` dep.
 */
import { type Action, ActionDisabledReason, type ActionDeps, type ImmediateInvoker } from '@weasel-js/routing';
import { always, never, type ChromeRulesDep, type IconRef } from '@weasel-js/core';
import { PATH_BALANCE_CHROME_ID } from '../balance/balanceMarks';
import { PATH_COMB_CHROME_ID } from '../comb/comb';
import { PATH_CORNERS_CHROME_ID } from '../cornerShape/cornerWidgets';
import { PATH_DIRECTION_CHROME_ID } from '../pathStructure/directionMarks';
import { icon } from '../icons.gen';

/** The group every overlay toggle sits in, for a bar of them. */
export const PATH_OVERLAYS_GROUP = 'pathOverlays';

/** Whether `chromeId`'s rule leaves it shown. A rule that is not `never` shows it, and no rule does. */
export function overlayShown(rules: ChromeRulesDep | undefined, chromeId: string): boolean {
  return rules !== undefined && rules.get(chromeId) !== never;
}

/** The toggle `pathEdit.show.<name>`, which shows or hides the overlay drawn under `chromeId`. */
export function showOverlayAction(name: string, chromeId: string, label: string, glyph: IconRef): Action & { requires: string[] } {
  const rules = (deps: ActionDeps | undefined) => deps?.chromeRules;
  return {
    id: `pathEdit.show.${name}`,
    label,
    icon: glyph,
    group: PATH_OVERLAYS_GROUP,
    requires: ['chromeRules'],
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const dep = rules(deps);
        dep?.set(chromeId, overlayShown(dep, chromeId) ? never : always);
      },
    } as ImmediateInvoker,
    active: (deps) => overlayShown(rules(deps), chromeId),
    enabled: (deps) => (rules(deps) ? true : ActionDisabledReason.NotApplicable),
  };
}

/** `pathEdit.show.direction`: the direction arrows and start rings. */
export const showDirectionAction = showOverlayAction('direction', PATH_DIRECTION_CHROME_ID, 'Path direction', icon('pathDirection'));
/** `pathEdit.show.comb`: the curvature comb. */
export const showCombAction = showOverlayAction('comb', PATH_COMB_CHROME_ID, 'Curvature comb', icon('core:harmonize'));
/** `pathEdit.show.balance`: the handle balance lines and grips. */
export const showBalanceAction = showOverlayAction('balance', PATH_BALANCE_CHROME_ID, 'Handle balance', icon('balanceHandles'));
/** `pathEdit.show.corners`: the corner widgets. */
export const showCornersAction = showOverlayAction('corners', PATH_CORNERS_CHROME_ID, 'Corner widgets', icon('cornerRadius'));
