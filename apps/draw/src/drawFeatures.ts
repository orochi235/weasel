import { pathTools } from '@weasel-js/path-tools';
import { textPreset } from '@weasel-js/text-tools';
import { drawPreset } from '@weasel-js/editing';

/** The feature bundles every WeaselDraw canvas mounts. The workspace adds the spacing hints while their pref is on. */
export const DRAW_FEATURES = [drawPreset, pathTools, textPreset] as const;
