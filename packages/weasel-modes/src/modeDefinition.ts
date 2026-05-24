import { IMPLICIT_TAGS, type CapabilityTag } from './capabilities';

export interface WorkspaceVisual {
  tint?: string;
  gradient?: 'top-down' | 'bottom-up';
  intensity?: number;
}

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
