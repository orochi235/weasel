import type { UnitScope, UnitValue } from '@weasel-js/quantity';

/**
 * Rulers along a 2D camera's top and left edges, and the guides dragged off
 * them, offered on a `canvas`, a `stage` or a `<TrialSceneCanvas>`. `true`
 * reads in CSS px. Declaring them offers them: the trial's Guides menu shows
 * the rulers, the guides and snapping to them, each starting off.
 *
 * An orbit has none: a ruler measures a 2D view, and a perspective camera has
 * no one scale along an edge to read.
 */
export type RulersOption =
  | boolean
  | {
      /** The unit scope the rulers read in. Default CSS px. */
      unit?: UnitScope;
      /** The lengths a labeled step chooses among, as `scaleBar` takes them. */
      lengths?: readonly UnitValue[];
    };

/** What a trial shows of its rulers: each switched from its Guides menu, all off at first. */
export interface TrialGuidesShown {
  /** The rulers, and the drags that place, move and remove guides. */
  rulers: boolean;
  /** The guides. Hidden ones take no press and snap nothing. */
  guides: boolean;
  /** Whether `trial.snap` and the guide drags snap to the guides. */
  snap: boolean;
}

/** The trial's rulers as its chrome sees them: what is shown, and the switch for each. */
export interface TrialGuidesChrome {
  shown: TrialGuidesShown;
  toggle: (which: keyof TrialGuidesShown) => void;
}
