import { defaultNodeProperties, describePresets, nodeTraitsOf, viewPreset, viewToolsPreset, type NodePropertiesEntry } from '@weasel-js/core';
import { FEATURE_PRESETS } from '@weasel-js/editing';
import { pathToolsPreset } from '@weasel-js/path-tools';
import { textPreset } from '@weasel-js/text-tools';
import { DRAW_FEATURES } from '../drawFeatures';

/**
 * Every preset WeaselDraw can mount, each under the package that defines it. Core's come first: editing's table
 * re-exports them, and a preset reached from two packages is the first's.
 */
export const DRAW_PRESETS = describePresets({
  '@weasel-js/core': [viewPreset, viewToolsPreset],
  '@weasel-js/editing': Object.values(FEATURE_PRESETS),
  '@weasel-js/path-tools': [pathToolsPreset],
  '@weasel-js/text-tools': [textPreset],
});

/** The properties of every node kind a WeaselDraw canvas mounts: core's defaults and each feature's own. */
export const DRAW_NODE_PROPERTIES: readonly NodePropertiesEntry[] =
  nodeTraitsOf(DRAW_FEATURES, { properties: defaultNodeProperties }).properties;
