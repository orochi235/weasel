/**
 * Tuning a tool's actions from its options' values (`ToolDef.options`).
 */
import type { ActionsRegistry } from '../interactions/actions/registry';
import type { DepRegistry } from '../interactions/actions/depNode';
import { keepToolOptions, liveTool, toolOptionActionIds, toolOptionParams } from './toolOptions';
import { LIVE_TOOL_PARAM, toolOptionStepIds } from './toolOptionSteps';
import type { Tool } from './types';

/** Tune the actions each tool's options are params of with every option's
 *  value, from the `toolOptionValues` dep or its default, while that tool is
 *  the live one (the newest held on its key, else the active one), read on every invocation. The tuning lies under every other
 *  (`ActionTuning.under`), so a host's own tuning of a param still wins. A
 *  tool's bindings name none of its options. Several tools
 *  can bind one action (every shape tool binds `insert`), and only the active
 *  tool's options reach it. The options and the action's last-operation panel
 *  are one setting: a value the panel sets is written back to the dep, for the
 *  tool whose options the panel's run showed, active or not. The panel shows the live tool's options beside the
 *  action's own params (`ActionTuning.form`), so a shape's fill and stroke can be changed after it is drawn.
 *  `routed`, when given, names the tool input routes to (`ToolsApi.routed`), so a held tool the active mode leaves
 *  out tunes nothing, as it routes nothing. Returns a release. */
export function tuneToolOptions(
  registry: Pick<ActionsRegistry, 'tune'>,
  deps: Pick<DepRegistry, 'get'> | null,
  tools: Iterable<Tool>,
  routed?: () => string | null,
): () => void {
  const releases: Array<() => void> = [];
  // The tool whose options each action's last held run showed, `null` for none: the one a panel change belongs to.
  // Taken from `form`, read once per run the panel may hold, not `params`, which a cursor or an enabled check reads too.
  const readBy = new Map<string, string | null>();
  const all = [...tools];
  const ids = new Set(all.map((t) => t.id));
  const live = routed
    ? (): string | null => { const id = routed(); return id !== null && ids.has(id) ? id : null; }
    : (): string | null => liveTool(deps?.get('activeTool'), ids);
  for (const tool of all) {
    const options = tool.options;
    if (!options) continue;
    const active = () => live() === tool.id;
    for (const stepId of toolOptionStepIds(tool.id, options)) {
      releases.push(registry.tune(stepId, { under: true, params: () => ({ [LIVE_TOOL_PARAM]: live() }) }));
    }
    for (const actionId of toolOptionActionIds(options)) {
      releases.push(registry.tune(actionId, {
        under: true,
        params: () => (active() ? toolOptionParams(tool.id, options, deps?.get('toolOptionValues')) : {}),
        form: () => {
          if (active()) readBy.set(actionId, tool.id);
          else if (readBy.get(actionId) === tool.id) readBy.set(actionId, null);
          return active() ? options.prefs : null;
        },
        keep: (params) => {
          const values = deps?.get('toolOptionValues');
          const reader = readBy.has(actionId) ? readBy.get(actionId) : active() ? tool.id : null;
          if (values && reader === tool.id) keepToolOptions(tool.id, options, values, params);
        },
      }));
    }
  }
  return () => { for (const r of releases) r(); };
}
