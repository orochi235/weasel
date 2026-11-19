import * as pathTools from '@weasel-js/path-tools/presets';
import * as textTools from '@weasel-js/text-tools/presets';
import * as presets from '@weasel-js/editing/presets';

/** The feature bundles every WeaselDraw canvas mounts. The workspace adds the spacing hints while their pref is on. */
export const DRAW_FEATURES = [presets.draw, pathTools.pathTools, textTools.text] as const;
