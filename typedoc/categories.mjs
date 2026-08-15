/**
 * Repo-relative path prefixes, in priority order — the first match wins, so a
 * specific path must precede the general one that contains it. The barrel
 * re-exports from sibling packages as well as core, so every rule names its
 * package.
 * @type {ReadonlyArray<readonly [string, string]>}
 */
export const RULES = [
  ['packages/core/src/core/ops/createHistory', 'History'],
  ['packages/core/src/interactions/actions/defaults/enterTextEdit', 'Text'],

  ['packages/core/src/features/paths', 'Paths & geometry'],
  ['packages/core/src/features/text', 'Text'],
  ['packages/core/src/features/patterns', 'Paint & fills'],
  ['packages/core/src/features/selection', 'Selection & actions'],
  ['packages/core/src/features/groups', 'Scene'],
  ['packages/core/src/features/ingestion', 'Extension points'],

  ['packages/core/src/core/scene', 'Scene'],
  ['packages/core/src/core/ops', 'Scene'],
  ['packages/core/src/core/adapters', 'Scene'],
  ['packages/core/src/core/selection', 'Selection & actions'],
  ['packages/core/src/core/viewport', 'Viewport'],
  ['packages/core/src/core/paint-types', 'Paint & fills'],
  ['packages/core/src/core/units', 'Extension points'],
  ['packages/core/src/core/stylus', 'Tools & gestures'],

  ['packages/core/src/renderer', 'Rendering'],
  ['packages/core/src/canvas', 'Rendering'],

  ['packages/core/src/tools', 'Tools & gestures'],
  ['packages/core/src/interactions/gestures', 'Tools & gestures'],
  ['packages/core/src/interactions/actions', 'Selection & actions'],
  ['packages/core/src/interactions', 'Tools & gestures'],

  ['packages/core/src/util/paint', 'Paint & fills'],
  ['packages/core/src/contributions', 'Extension points'],
  ['packages/core/src/layout', 'Extension points'],
  ['packages/core/src/affordances', 'Selection & actions'],
  ['packages/core/src/animation', 'Rendering'],
  ['packages/core/src/debug', 'Extension points'],
  ['packages/core/src/icons', 'Extension points'],
  ['packages/core/src/features', 'Extension points'],
  ['packages/core/src/util', 'Extension points'],
  ['packages/core/src/WeaselProvider', 'Extension points'],
  ['packages/core/src/core', 'Scene'],

  // Sibling packages the barrel re-exports wholesale.
  ['packages/font/src', 'Text'],
  ['packages/gestures/src', 'Tools & gestures'],
  ['packages/history/src', 'History'],
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
