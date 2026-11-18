import { describePresets, viewPreset, viewToolsPreset } from '@weasel-js/core';
import { FEATURE_PRESETS } from '@weasel-js/editing';
import { pathToolsPreset } from '@weasel-js/path-tools';

/**
 * Every preset WeaselDraw can mount, each under the package that defines it. Core's come first: editing's table
 * re-exports them, and a preset reached from two packages is the first's.
 */
export const DRAW_PRESETS = describePresets({
  '@weasel-js/core': [viewPreset, viewToolsPreset],
  '@weasel-js/editing': Object.values(FEATURE_PRESETS),
  '@weasel-js/path-tools': [pathToolsPreset],
});
