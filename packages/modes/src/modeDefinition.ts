import { capabilitiesAllowed, IMPLICIT_TAGS, type CapabilityTag } from './capabilities';

/** How a mode tints the workspace — the area around the page — so the user
 *  can see at a glance which mode is active. */
export interface WorkspaceVisual {
  tint?: string;
  gradient?: 'top-down' | 'bottom-up';
  intensity?: number;
}

/** How a mode is entered. */
export interface ModeEntry {
  shortcut?: string;
  /** `'double-click-target'`: double-clicking a node enters the mode on that node. Which nodes is
   *  `targets`; `modeTriggers` in `@weasel-js/core` turns the pair into a canvas binding. */
  trigger?: 'double-click-target';
  /** The routing kinds a double-click enters this mode on — the `Hit.kind` vocabulary a
   *  binding's `kind:<k>` target reads, so `'path'` or an app's own `'group'`. A trigger with no
   *  targets binds nothing, for a mode whose entry follows something else (text-edit, which the
   *  edit opening enters). */
  targets?: readonly string[];
}

/**
 * A mode: an app-level editing context that narrows which tools are usable and
 * how the workspace looks. Tools live inside modes; a tool is never "in" one.
 *
 * `kind` picks the lifecycle. A `soft` mode (path-edit, isolation, text-edit)
 * is a scoped context with no commit ceremony — every edit inside it is
 * independently undoable and `exit` is non-destructive. A `strict` mode
 * (free-transform, crop) is a transaction: the whole session collapses to one
 * undoable step and leaving requires an explicit `commit` or `cancel`.
 *
 * The four shortcut fields are key chords (`'Escape'`, `'Meta+T'`) that
 * `modeShortcuts` in `@weasel-js/routing` turns into dispatcher bindings,
 * each live only while the mode it acts on is (or, for `entry`, is not).
 */
export interface ModeDefinition {
  id: string;
  /** Human-readable name for chrome — a breadcrumb, a status bar. Falls back
   *  to `id`; read it through {@link modeLabel}. */
  label?: string;
  /** One sentence on what the mode is for, for a tooltip or a hint line. */
  description?: string;
  kind: 'soft' | 'strict';
  /** Capability tags this mode allows beyond IMPLICIT_TAGS. */
  allows: CapabilityTag[];
  /** When true, out-of-target objects dim at the renderer layer. */
  scoping: boolean;
  workspace?: WorkspaceVisual;
  entry?: ModeEntry;
  exit?: { shortcut?: string };
  commit?: { shortcut?: string };
  cancel?: { shortcut?: string };
  /** Leave a soft mode and throw its session away, where `exit` keeps it to
   *  resume. */
  discard?: { shortcut?: string };
}

/** A mode's display name: its `label`, else its `id`. */
export function modeLabel(mode: ModeDefinition): string {
  return mode.label ?? mode.id;
}

/** True iff a tool carrying `toolTags` is eligible for `mode`. */
export function eligibleForMode(mode: ModeDefinition, toolTags: readonly CapabilityTag[]): boolean {
  return capabilitiesAllowed(allowedCapabilitiesOf(mode), toolTags);
}

/** Every tag `mode` permits: its `allows` plus `IMPLICIT_TAGS`. */
export function allowedCapabilitiesOf(mode: ModeDefinition): Set<string> {
  return new Set<string>([...mode.allows, ...IMPLICIT_TAGS]);
}
