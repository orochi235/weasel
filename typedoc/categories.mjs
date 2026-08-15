/** Sidebar order. Alphabetical would open on "Extension points". */
export const CATEGORY_ORDER = [
  'Scene',
  'Rendering',
  'Tools & gestures',
  'Selection & actions',
  'Paths & geometry',
  'Viewport',
  'Paint & fills',
  'Text',
  'History',
  'Extension points',
];

/**
 * Path prefixes relative to `packages/core/src/`, in priority order — the first
 * match wins, so a specific path must precede the general one that contains it.
 * @type {ReadonlyArray<readonly [string, string]>}
 */
export const RULES = [
  ['core/ops/createHistory', 'History'],
  ['interactions/actions/defaults/enterTextEdit', 'Text'],

  ['features/paths', 'Paths & geometry'],
  ['features/text', 'Text'],
  ['features/patterns', 'Paint & fills'],
  ['features/selection', 'Selection & actions'],
  ['features/groups', 'Scene'],
  ['features/ingestion', 'Extension points'],

  ['core/scene', 'Scene'],
  ['core/ops', 'Scene'],
  ['core/adapters', 'Scene'],
  ['core/selection', 'Selection & actions'],
  ['core/viewport', 'Viewport'],
  ['core/paint-types', 'Paint & fills'],
  ['core/units', 'Extension points'],
  ['core/stylus', 'Tools & gestures'],

  ['renderer', 'Rendering'],
  ['canvas', 'Rendering'],

  ['tools', 'Tools & gestures'],
  ['interactions/gestures', 'Tools & gestures'],
  ['interactions/actions', 'Selection & actions'],
  ['interactions', 'Tools & gestures'],

  ['util/paint', 'Paint & fills'],
  ['contributions', 'Extension points'],
  ['layout', 'Extension points'],
  ['affordances', 'Selection & actions'],
  ['animation', 'Rendering'],
  ['debug', 'Extension points'],
  ['icons', 'Extension points'],
  ['features', 'Extension points'],
  ['util', 'Extension points'],
  ['core', 'Scene'],
];

/**
 * Symbol-name overrides, which beat every path rule. For the symbol whose file
 * is a poor guide to its subject. An override that could be a path rule should
 * be one.
 * @type {Record<string, string>}
 */
export const OVERRIDES = {
  VERSION: 'Extension points',
};
