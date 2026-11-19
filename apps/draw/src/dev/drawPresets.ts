import { defaultNodeProperties, describePresets, nodeTraitsOf, type NodePropertiesEntry } from '@weasel-js/core';
import * as corePresets from '@weasel-js/core/presets';
import { FEATURE_PRESETS } from '@weasel-js/editing';
import * as pathTools from '@weasel-js/path-tools/presets';
import * as textTools from '@weasel-js/text-tools/presets';
import { DRAW_FEATURES } from '../drawFeatures';

/**
 * Every preset WeaselDraw can mount, each under the package that defines it. Core's come first: editing's table
 * re-exports them, and a preset reached from two packages is the first's.
 */
export const DRAW_PRESETS = describePresets({
  '@weasel-js/core': [corePresets.view, corePresets.viewTools],
  '@weasel-js/editing': Object.values(FEATURE_PRESETS),
  '@weasel-js/path-tools': [pathTools.pathTools],
  '@weasel-js/text-tools': [textTools.text],
});

/** The properties of every node kind a WeaselDraw canvas mounts: core's defaults and each feature's own. */
export const DRAW_NODE_PROPERTIES: readonly NodePropertiesEntry[] =
  nodeTraitsOf(DRAW_FEATURES, { properties: defaultNodeProperties }).properties;
