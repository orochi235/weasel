// Preference-schema vocabulary for PrefsForm / PrefsDialog.
//
// Deliberately field-compatible with core's `ToolPref*` family
// (src/tools/prefs.ts): weasel-ui does not depend on @weasel-js/core, so
// the contract is structural — a `ToolPrefGroup` (and any host-app
// superset, like WeaselDraw's registry) assigns into `PrefGroup` with no
// import and no cast. Keep the two in sync field-for-field.

/** Control-presentation hints per kind — visually-equivalent renderings
 *  of the same value type. The persisted value is unchanged either way. */
export type PrefNumberControl = 'input' | 'slider';
export type PrefBooleanControl = 'checkbox' | 'switch';
export type PrefStringControl = 'input' | 'textarea';
export type PrefEnumControl = 'select' | 'radio';

interface PrefBase<K extends string, Value> {
  kind: K;
  /** Human-readable label, e.g. "Show grid". */
  name: string;
  /** Longer help text — surfaces as a tooltip on the row label. */
  description: string;
  /** Fallback when `values` holds nothing at this leaf's path. */
  default: Value;
  /** Omitted from the form unless `showHidden` is set. */
  hidden?: boolean;
  /** Render the control full-width with no label/tooltip row — for
   *  controls that supply their own chrome (embedded sub-panel editors).
   *  The `description` still applies wherever the renderer surfaces it. */
  block?: boolean;
}

export interface PrefNumber extends PrefBase<'number', number> {
  min?: number;
  max?: number;
  step?: number;
  control?: PrefNumberControl;
}
export interface PrefBoolean extends PrefBase<'boolean', boolean> {
  control?: PrefBooleanControl;
}
export interface PrefString extends PrefBase<'string', string> {
  control?: PrefStringControl;
}
export interface PrefEnum<T extends string = string> extends PrefBase<'enum', T> {
  options: readonly { value: T; label: string }[];
  control?: PrefEnumControl;
}

export type BuiltinPref = PrefNumber | PrefBoolean | PrefString | PrefEnum;

/**
 * Open leaf: any node with a `kind` the form doesn't know renders via the
 * `renderers` map (`renderers[kind]`). App schemas keep their extra fields
 * (e.g. a registry-enum's `source`/`filter`) — renderers receive the node
 * and narrow it themselves. Deliberately NOT index-signatured so concrete
 * app interfaces stay assignable.
 */
export interface PrefCustom extends PrefBase<string, unknown> {}

export type PrefLeaf = BuiltinPref | PrefCustom;

/** Nestable group: branch nodes in the schema tree. */
export interface PrefGroup {
  name: string;
  description?: string;
  children: Record<string, PrefLeaf | PrefGroup>;
}

export function isPrefLeaf(node: PrefLeaf | PrefGroup): node is PrefLeaf {
  return 'kind' in node;
}

/** Get the value at a dotted path inside a nested value tree. Returns
 *  `undefined` when a segment is missing or hits a non-object. */
export function prefValueAtPath(values: unknown, path: string): unknown {
  let cur: unknown = values;
  for (const seg of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/**
 * Recursively drop `hidden` leaves (unless `showHidden`), pruning groups
 * that end up empty. Returns null when the entire subtree is hidden.
 */
export function visiblePrefSubtree<T extends PrefLeaf | PrefGroup>(
  node: T,
  showHidden: boolean,
): T | null {
  if (isPrefLeaf(node)) return node.hidden && !showHidden ? null : node;
  const group = node as PrefGroup;
  const children: Record<string, PrefLeaf | PrefGroup> = {};
  for (const [key, child] of Object.entries(group.children)) {
    const kept = visiblePrefSubtree(child, showHidden);
    if (kept) children[key] = kept;
  }
  if (Object.keys(children).length === 0) return null;
  return { ...node, children };
}
