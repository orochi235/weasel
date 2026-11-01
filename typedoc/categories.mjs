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

  ['packages/core/src/domains/paths', 'Paths & geometry'],
  ['packages/core/src/domains/text', 'Text'],
  ['packages/renderer/src/patterns', 'Paint & fills'],
  ['packages/core/src/domains/selection', 'Selection & actions'],
  ['packages/core/src/domains/ingestion', 'Extension points'],

  ['packages/core/src/core/scene', 'Scene'],
  ['packages/core/src/core/ops', 'Scene'],
  ['packages/core/src/core/adapters', 'Scene'],
  ['packages/core/src/core/selection', 'Selection & actions'],
  ['packages/core/src/core/viewport', 'Viewport'],
  ['packages/core/src/core/paint-types', 'Paint & fills'],
  ['packages/core/src/core/units', 'Extension points'],
  ['packages/core/src/core/stylus', 'Tools & gestures'],

  ['packages/renderer/src', 'Rendering'],
  ['packages/pdf/src', 'Rendering'],
  ['packages/core/src/canvas', 'Rendering'],

  ['packages/core/src/tools', 'Tools & gestures'],
  ['packages/core/src/input', 'Tools & gestures'],
  ['packages/core/src/interactions/gestures', 'Tools & gestures'],
  ['packages/core/src/interactions/actions', 'Selection & actions'],
  ['packages/core/src/interactions', 'Tools & gestures'],

  ['packages/core/src/util/paint', 'Paint & fills'],
  ['packages/core/src/contributions', 'Extension points'],
  ['packages/core/src/layout', 'Extension points'],
  ['packages/core/src/affordances', 'Selection & actions'],
  ['packages/core/src/animation', 'Rendering'],
  ['packages/core/src/debug', 'Extension points'],
  ['packages/core/src/devtools', 'Extension points'],
  ['packages/core/src/icons', 'Extension points'],
  ['packages/core/src/iconRegistry', 'Extension points'],
  ['packages/core/src/kitSettings', 'Extension points'],
  ['packages/core/src/kitSettingsSchema', 'Extension points'],
  ['packages/core/src/domains', 'Extension points'],
  ['packages/core/src/util', 'Extension points'],
  ['packages/core/src/WeaselProvider', 'Extension points'],
  ['packages/core/src/core', 'Scene'],

  // Sibling packages the barrel re-exports wholesale.
  ['packages/cursor/src', 'Tools & gestures'],
  ['packages/font/src', 'Text'],
  ['packages/geom/src', 'Paths & geometry'],
  ['packages/gestures/src', 'Tools & gestures'],
  ['packages/history/src', 'History'],
  ['packages/icons/src', 'Extension points'],
  ['packages/ui-logic/src', 'Menu'],
  ['packages/menu/src', 'Menu'],
  ['packages/paint/src', 'Paint & fills'],
  ['packages/quantity/src', 'Scene'],
  ['packages/simulation/src', 'Rendering'],
  ['packages/clock/src', 'Rendering'],
  ['packages/stroke/src', 'Paint & fills'],
  ['packages/react/src/useVisibleRaf', 'Rendering'],
  ['packages/react/src', 'Extension points'],
  ['packages/registry/src', 'Extension points'],
  ['packages/text/src', 'Text'],
  ['packages/text-dom/src', 'Text'],

  // Routing moved out of core; each part keeps the category its core directory had.
  ['packages/routing/src/interactions/actions', 'Selection & actions'],
  ['packages/routing/src/interactions', 'Tools & gestures'],
  ['packages/routing/src/tools', 'Tools & gestures'],
  ['packages/routing/src/viewport', 'Viewport'],
  ['packages/routing/src/contributions', 'Extension points'],
  ['packages/routing/src/eligibility', 'Extension points'],
  ['packages/routing/src/ingestion', 'Extension points'],
  ['packages/routing/src/dlog', 'Extension points'],
  ['packages/routing/src/ambient/SelectionContext', 'Selection & actions'],
  ['packages/routing/src/ambient', 'Extension points'],
  ['packages/routing/src/index', 'Selection & actions'],
  ['packages/routing/src/vocabulary', 'Tools & gestures'],
  ['packages/routing/src/menus', 'Menu'],
  ['packages/routing/src/kitSettings', 'Tools & gestures'],
  ['packages/routing/src/keymaps', 'Tools & gestures'],
];

/**
 * Symbol-name overrides, which beat every path rule. For the symbol whose file
 * is a poor guide to its subject. An override that could be a path rule should
 * be one.
 * @type {Record<string, string>}
 */
export const OVERRIDES = {
  VERSION: 'Extension points',

  // packages/routing/src/vocabulary.ts gathers types from several core directories.
  View: 'Viewport',
  Bounds: 'Viewport',
  NodeId: 'Scene',
  SelectionApi: 'Selection & actions',
  SelectionMode: 'Selection & actions',
  SelectionExtendKey: 'Selection & actions',
  DebugSink: 'Extension points',
  HandleKind: 'Extension points',
  HitShape: 'Extension points',
  DeviceProfile: 'Extension points',
};
