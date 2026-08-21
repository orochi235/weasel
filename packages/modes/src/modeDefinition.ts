import { IMPLICIT_TAGS, type CapabilityTag } from './capabilities';

/** How a mode tints the workspace — the area around the page — so the user
 *  can see at a glance which mode is active. */
export interface WorkspaceVisual {
  tint?: string;
  gradient?: 'top-down' | 'bottom-up';
  intensity?: number;
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
 */
export interface ModeDefinition {
  id: string;
  kind: 'soft' | 'strict';
  /** Capability tags this mode allows beyond IMPLICIT_TAGS. */
  allows: CapabilityTag[];
  /** When true, out-of-target objects dim at the renderer layer. */
  scoping: boolean;
  workspace?: WorkspaceVisual;
  entry?: { shortcut?: string; trigger?: 'double-click-target' };
  exit?: { shortcut?: string };
  commit?: { shortcut?: string };
  cancel?: { shortcut?: string };
}

/** True iff a tool carrying `toolTags` is eligible for `mode`. */
export function eligibleForMode(mode: ModeDefinition, toolTags: readonly CapabilityTag[]): boolean {
  if (toolTags.length === 0) return false;
  const allowed = new Set<CapabilityTag>([...mode.allows, ...IMPLICIT_TAGS]);
  for (const t of toolTags) {
    if (allowed.has(t)) return true;
  }
  return false;
}
