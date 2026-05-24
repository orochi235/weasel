/**
 * Test helper: invoke a Tool's initial.keyDown route for a given key +
 * modifiers. Bypasses the full dispatcher and only validates that the
 * tool's own channel maps the binding. Sufficient for unit tests
 * asserting which api method fires on which key.
 *
 * Reads from `tool.def.initial.keyDown` — `defineTool` attaches the
 * source `ToolDef` to `tool.def` for reflection consumers (see
 * `src/tools/types.ts:217`). Tests can therefore poke at the declarative
 * route table without spinning up a full dispatcher.
 */
import type { AnyTool } from '@orochi235/weasel';

interface KeyEvent {
  key: string;
  shift?: boolean;
  meta?: boolean;
  alt?: boolean;
  ctrl?: boolean;
}

export function dispatchKeyDown(tool: AnyTool, ev: KeyEvent): void {
  const def = (tool as unknown as {
    def?: { initial?: { keyDown?: Record<string, (ctx: unknown) => unknown> } };
  }).def;
  const handler = def?.initial?.keyDown?.[ev.key];
  if (!handler) return;
  handler({
    modifiers: {
      shift: ev.shift ?? false,
      meta: ev.meta ?? false,
      alt: ev.alt ?? false,
      ctrl: ev.ctrl ?? false,
    },
  });
}
