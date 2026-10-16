// src/tools/defineTool.ts
import type { Tool } from './types';
import type { ToolDef } from './routeTypes';
import { RESERVED_ID_NAMES, RESERVED_ID_PREFIXES } from '@weasel-js/gestures';
import type { CursorSpec } from '@weasel-js/cursor';
import type { KernelOverlay } from '../index';

/** Validate that `id` is usable as a tool / channel id in the route
 *  grammar. Rejects ids that start with a reserved sigil (would shadow
 *  future grammar extensions) and ids that collide with phase keywords
 *  (would parse as the bare-phase shorthand). */
function validateId(id: string, kind: 'tool' | 'action'): void {
  if (id.length === 0) {
    throw new Error(`weasel: ${kind} id may not be empty`);
  }
  if (RESERVED_ID_PREFIXES.has(id[0]!)) {
    throw new Error(
      `weasel: ${kind} id "${id}" starts with reserved sigil "${id[0]}" ` +
      `(reserved set: ${[...RESERVED_ID_PREFIXES].join(' ')})`,
    );
  }
  if (RESERVED_ID_NAMES.has(id)) {
    throw new Error(
      `weasel: ${kind} id "${id}" collides with a reserved phase keyword ` +
      `(reserved: ${[...RESERVED_ID_NAMES].join(', ')})`,
    );
  }
}

/**
 * Build a `Tool` from a declarative `ToolDef`: validates the id, applies the
 * `cursor` default, and keeps the authored form on `Tool.def` for reflection.
 */
export function defineTool<TOverlay = KernelOverlay>(
  def: ToolDef<TOverlay>,
): Tool<TOverlay> {
  validateId(def.id, 'tool');

  const resolveCursor = (): CursorSpec => {
    if (def.cursor == null) return '';
    return typeof def.cursor === 'function' ? def.cursor() : def.cursor;
  };

  return {
    id: def.id,
    eligibility: {
      focus: true,
      capabilities: def.capabilities,
      ...(def.hotkey ? { offhand: def.hotkey } : {}),
    },
    actions: def.actions,
    menus: def.menus,
    def,
    presentation: def.presentation,
    keybinding: def.keybinding,
    onActivate: def.onActivate,
    onDeactivate: def.onDeactivate,
    cursor: resolveCursor,
    bindings: def.bindings,
    overlay: def.overlay,
    overlayPosition: def.overlayPosition,
  };
}
