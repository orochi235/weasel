import type { ComponentType } from 'react';
import * as Weasel from '@orochi235/weasel';
import * as ActionIcons from '../actionIcons';
import * as KindIcons from '../kindIcons';

/** Discriminated leaf entry. One of these per row in the tree's right pane. */
export type TreeEntry =
  | ToolEntry
  | ActionEntry
  | ShapeKindEntry
  | BundleEntry
  | IconEntry
  | OpFactoryEntry
  | PublicExportEntry;

export interface ToolEntry {
  kind: 'tool';
  id: string;
  label: string;
  hookName?: string;
  cursor?: string;
  /** Route signatures the tool exposes, derived from `buildActionRegistry`
   *  on the live `ToolDef`. Each entry is a compact `phase.gesture.target`
   *  string (with a trailing `:modifiers` segment when non-default), e.g.
   *  `initial.click.empty` or `initial.drag.node:shift`. */
  routes: readonly string[];
}

export interface ActionEntry {
  kind: 'action';
  id: string;
  label: string;
  shortcut?: string;
  hookName?: string;
}

export interface ShapeKindEntry {
  kind: 'shapeKind';
  id: string;
  label: string;
}

export interface BundleEntry {
  kind: 'bundle';
  id: 'minimal' | 'standard' | 'exhaustive';
  label: string;
  /** Tool ids the bundle enables when passed as SceneCanvas's `toolBundle`
   *  prop. The kit does not group actions into bundles — actions are
   *  wired separately by consumers. */
  tools: readonly string[];
}

export interface IconEntry {
  kind: 'icon';
  id: string;
  label: string;
  source: 'action' | 'kind';
  Component: ComponentType;
}

export interface OpFactoryEntry {
  kind: 'opFactory';
  id: string;
  label: string;
}

export interface PublicExportEntry {
  kind: 'publicExport';
  id: string;
  label: string;
}

export type TreeCategory =
  | 'tools' | 'actions' | 'shapeKinds' | 'bundles'
  | 'icons' | 'opFactories' | 'publicExports';

export interface TreeCategoryNode {
  id: TreeCategory;
  label: string;
  entries: readonly TreeEntry[];
}

// ── Static collectors ──────────────────────────────────────────────────────

function isLikelyComponent(value: unknown): boolean {
  return typeof value === 'function'
    || (typeof value === 'object' && value !== null && '$$typeof' in value);
}

export function collectIcons(): readonly IconEntry[] {
  const out: IconEntry[] = [];
  for (const [id, Component] of Object.entries(ActionIcons)) {
    if (!isLikelyComponent(Component)) continue;
    out.push({ kind: 'icon', id, label: id, source: 'action', Component: Component as ComponentType });
  }
  for (const [id, Component] of Object.entries(KindIcons)) {
    if (!isLikelyComponent(Component)) continue;
    out.push({ kind: 'icon', id, label: id, source: 'kind', Component: Component as ComponentType });
  }
  return out;
}

/** Named ToolBundle presets — mirrored from the kit until the kit exports
 *  BUNDLE_TOOLS publicly. Tracked under the "kit-barrel drift" follow-up in
 *  docs/TODO.md. */
const BUNDLE_DEFINITIONS = [
  { id: 'minimal' as const,    label: 'Minimal',
    tools: ['select', 'hand'] as const },
  { id: 'standard' as const,   label: 'Standard',
    tools: ['select', 'resize', 'rotate', 'hand', 'rect', 'ellipse', 'line', 'pencil'] as const },
  { id: 'exhaustive' as const, label: 'Exhaustive',
    tools: ['select', 'resize', 'rotate', 'hand', 'rect', 'ellipse', 'line',
            'polygon', 'star', 'pencil', 'lasso', 'text', 'clone'] as const },
];

export function collectBundles(): readonly BundleEntry[] {
  return BUNDLE_DEFINITIONS.map((b) => ({ kind: 'bundle', ...b }));
}

const OP_FACTORY_NAMES: readonly string[] = [
  'createInsertOp', 'createDeleteOp', 'createTransformOp',
  'createReparentOp', 'createSetSelectionOp', 'createSetTextOp', 'createSetPathOp',
];

export function collectOpFactories(): readonly OpFactoryEntry[] {
  return OP_FACTORY_NAMES
    .filter((name) => typeof (Weasel as Record<string, unknown>)[name] === 'function')
    .map((id) => ({ kind: 'opFactory', id, label: id }));
}

export function collectPublicExports(): readonly PublicExportEntry[] {
  const out: PublicExportEntry[] = [];
  for (const [id, value] of Object.entries(Weasel)) {
    if (value === undefined || value === null) continue;
    if (id === 'default') continue;
    out.push({ kind: 'publicExport', id, label: id });
  }
  return out;
}

const SHAPE_KIND_IDS: readonly string[] = [
  'rect', 'ellipse', 'line', 'polygon', 'star', 'pencil', 'lasso', 'text', 'clone',
];

export function collectShapeKinds(): readonly ShapeKindEntry[] {
  return SHAPE_KIND_IDS.map((id) => ({ kind: 'shapeKind', id, label: id }));
}
