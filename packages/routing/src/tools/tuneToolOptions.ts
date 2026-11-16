/**
 * Tuning a tool's actions from its options' values (`ToolDef.options`).
 */
import type { ActionsRegistry } from '../interactions/actions/registry';
import type { DepRegistry } from '../interactions/actions/depNode';
import { keepToolOptions, toolOptionActionIds, toolOptionParams } from './toolOptions';
import type { Tool } from './types';

/** Tune the actions each tool's options are params of with every option's
 *  value, from the `toolOptionValues` dep or its default, while that tool is
 *  the live one (the newest held on its key, else the active one), read on every invocation. The tuning lies under every other
 *  (`ActionTuning.under`), so a host's own tuning of a param still wins. A
 *  tool's bindings name none of its options. Several tools
 *  can bind one action (every shape tool binds `insert`), and only the active
 *  tool's options reach it. The options and the action's last-operation panel
 *  are one setting: a value the panel sets is written back to the dep, for the
 *  tool whose options the action last read, active or not. The panel shows the live tool's options beside the
 *  action's own params (`ActionTuning.form`), so a shape's fill and stroke can be changed after it is drawn.
 *  Returns a release. */
export function tuneToolOptions(
  registry: Pick<ActionsRegistry, 'tune'>,
  deps: Pick<DepRegistry, 'get'> | null,
  tools: Iterable<Tool>,
): () => void {
  const releases: Array<() => void> = [];
  // The tool whose options each action last read: the one a panel change to its last run belongs to.
  const readBy = new Map<string, string>();
  const all = [...tools];
  const ids = new Set(all.map((t) => t.id));
  // The newest of these tools held on its key, else the active one, as routing walks them.
  const live = (): string | null => {
    const slot = deps?.get('activeTool');
    const stack = slot?.hotkeyStack ?? [];
    for (let i = stack.length - 1; i >= 0; i--) if (ids.has(stack[i]!)) return stack[i]!;
    return slot?.active ?? null;
  };
  for (const tool of all) {
    const options = tool.options;
    if (!options) continue;
    const active = () => live() === tool.id;
    for (const actionId of toolOptionActionIds(options)) {
      releases.push(registry.tune(actionId, {
        under: true,
        params: () => {
          if (!active()) return {};
          readBy.set(actionId, tool.id);
          return toolOptionParams(tool.id, options, deps?.get('toolOptionValues'));
        },
        form: () => (active() ? options.prefs : null),
        keep: (params) => {
          const values = deps?.get('toolOptionValues');
          if (values && (readBy.get(actionId) ?? (active() ? tool.id : null)) === tool.id) keepToolOptions(tool.id, options, values, params);
        },
      }));
    }
  }
  return () => { for (const r of releases) r(); };
}
