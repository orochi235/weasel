/**
 * The keys that activate each tool, as chrome shows them: read from the live
 * `tool.activate` bindings, so a rebound or unbound key reaches every palette.
 */
import type { Action } from '../interactions/actions/action';
import { actionShortcuts, type ActionShortcut } from '../interactions/actions/actionShortcuts';
import type { AnyTool } from './types';

/** Id of the one action every tool key binds: each binding passes `params.toolId`. */
export const TOOL_ACTIVATE_ID = 'tool.activate';

/** Each tool's activation keys by tool id, first the one a chip shows. A tool with no key is absent. */
export type ToolShortcuts = Readonly<Record<string, readonly ActionShortcut[]>>;

const NONE: ToolShortcuts = Object.freeze({});

/** The keys `actions`' `tool.activate` binds to each of `toolIds`, each binding under its override and tuning. */
export function toolShortcutsOf(actions: readonly Action[], toolIds: Iterable<string>): ToolShortcuts {
  const activate = actions.find((a) => a.id === TOOL_ACTIVATE_ID);
  if (!activate) return NONE;
  const out: Record<string, readonly ActionShortcut[]> = {};
  for (const toolId of toolIds) {
    const keys = actionShortcuts(activate, { toolId });
    if (keys.length > 0) out[toolId] = keys;
  }
  return out;
}

/** The keys each tool declares (`ToolDef.keybinding`), as a canvas binds them before any override. */
export function declaredToolShortcuts(tools: Readonly<Record<string, AnyTool>>): ToolShortcuts {
  const out: Record<string, readonly ActionShortcut[]> = {};
  for (const [id, tool] of Object.entries(tools)) {
    const b = tool.keybinding;
    if (!b) continue;
    const keys = (typeof b.key === 'string' ? [b.key] : b.key).filter((k) => k.length > 0);
    if (keys.length > 0) out[id] = keys.map((key) => ({ key, mod: b.mod === true, alt: b.alt === true, shift: b.shift === true }));
  }
  return out;
}
