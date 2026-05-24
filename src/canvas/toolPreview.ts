/**
 * Helpers for reading preview pose / bounds / ids from a ToolsApi.
 * Extracted from Canvas.tsx so SceneCanvas can use the same logic when
 * constructing scene-aware layers (selection overlay, etc.) without
 * going through Canvas's internal render closure.
 */
import type { ToolsApi } from 'tools/useTools';
import type { AnyTool } from 'tools/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';

/** Iterate all tools in priority order: hotkey-engaged → active → rest of
 *  registry → ambient. Skips duplicates so each tool is only visited once.
 *  This preserves the "most-specific tool wins" contract when multiple
 *  siblings of select each publish their own preview slice. */
export function* toolsInPriorityOrder(tools: ToolsApi): IterableIterator<AnyTool> {
  const seen = new Set<AnyTool>();
  const hotkey = tools.hotkeyEngaged ? tools.registry[tools.hotkeyEngaged] : undefined;
  const active = tools.registry[tools.active];
  for (const t of [hotkey, active]) {
    if (t && !seen.has(t)) { seen.add(t); yield t; }
  }
  for (const t of Object.values(tools.registry)) {
    if (t && !seen.has(t)) { seen.add(t); yield t; }
  }
  for (const t of tools.ambient) {
    if (t && !seen.has(t)) { seen.add(t); yield t; }
  }
}

/** Return the first non-null `previewPose(id)` from any tool in priority
 *  order, or `null` when no tool owns a preview for this id. */
export function firstPreviewPose(tools: ToolsApi | undefined, id: string): unknown {
  if (!tools) return null;
  for (const t of toolsInPriorityOrder(tools)) {
    const p = t.previewPose?.(id);
    if (p != null) return p;
  }
  return null;
}

/** Return the first non-null `previewBounds(id)` from any tool in priority
 *  order, or `null` when no tool owns a bounds preview for this id. */
export function firstPreviewBounds(tools: ToolsApi | undefined, id: string): Bounds | null {
  if (!tools) return null;
  for (const t of toolsInPriorityOrder(tools)) {
    const b = t.previewBounds?.(id);
    if (b) return b as Bounds;
  }
  return null;
}

/** Aggregate all `previewIds()` from every registered tool into a single Set. */
export function aggregatePreviewIds(tools: ToolsApi | undefined): Set<string> {
  const out = new Set<string>();
  if (!tools) return out;
  for (const t of toolsInPriorityOrder(tools)) {
    const ids = t.previewIds?.();
    if (!ids) continue;
    for (const id of ids) out.add(id);
  }
  return out;
}
