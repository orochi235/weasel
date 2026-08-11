// src/tools/routing/defineTool.ts
import type { Tool, ToolCtx } from '../types';
import type { ToolDef } from './types';
import { RESERVED_ID_NAMES, RESERVED_ID_PREFIXES } from './routeGrammar';

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
 * Build a `Tool<TScratch>` from a declarative `ToolDef<TScratch>`.
 *
 * This used to be a translator: `ToolDef` carried `initial` / `engaged` phase
 * tables of hit-keyed route handlers, and `defineTool` compiled them into the
 * imperative `pointer` / `drag` / `keyboard` / `wheel` handlers the
 * tool-routing dispatcher called. Both ends of that are gone — tools declare
 * `bindings` and the gesture dispatcher routes them — so what remains is
 * identity plumbing plus the id check and the cursor resolver.
 *
 * It stays a function rather than becoming a spread because the id validation
 * and the `initScratch` / `cursor` defaults are worth applying uniformly, and
 * because `Tool.def` gives reflection a handle on the authored form.
 */
export function defineTool<TScratch = void>(
  def: ToolDef<TScratch>,
): Tool<TScratch> {
  validateId(def.id, 'tool');

  // Normalize `string | ((ctx) => string)` to the function form so callers
  // have one shape to deal with. Returns '' (not undefined) so the signature
  // satisfies `Tool.cursor: (ctx) => string`. `Contribution.cursor` isn't
  // parameterized by scratch, so this reads `def.cursor` through a cast.
  const resolveCursor = (ctx: ToolCtx): string => {
    if (def.cursor == null) return '';
    return typeof def.cursor === 'function' ? def.cursor(ctx as ToolCtx<TScratch>) : def.cursor;
  };

  return {
    id: def.id,
    eligibility: { focus: true, capabilities: def.capabilities },
    actions: def.actions,
    def,
    presentation: def.presentation as Tool<TScratch>['presentation'],
    keybinding: def.keybinding,
    onActivate: def.onActivate,
    onDeactivate: def.onDeactivate,
    initScratch: def.initScratch ?? (() => null as unknown as TScratch),
    cursor: resolveCursor,
    bindings: def.bindings,
    overlay: def.overlay,
  };
}
