/**
 * Every binding the kit ships, loaded at once, with no two actions on one
 * input in one scope. The sweep is `kitSweep.fixture`'s; the route-conflict
 * check is the one `<SceneCanvas>` runs in dev, so a collision this reports is
 * one a canvas mounting both would warn about.
 *
 * A 3D canvas (`@weasel-js/kernel3d`) is a scope of its own: its camera
 * actions take the wheel and the pinch a 2D view's take, and the two never
 * mount on one canvas.
 */
import { describe, it, expect } from 'vitest';
import { actionBindings, reportRouteConflicts, type Action, type Contribution } from '@weasel-js/routing';
import { buildToolActivateBindings, createToolActivateAction, TOOL_ACTIVATE_ID, type ToolActivateBindingSpec } from 'interactions/actions/defaults/toolActivate';
import { sweepKit, type Sweep } from './kitSweep.fixture';

type Keybinding = { key: string | string[]; mod?: boolean; alt?: boolean; shift?: boolean };

/** One `tool.activate` carrying every tool's key, as `useKeybindings` registers it. */
function toolKeys(tools: readonly Contribution<unknown>[]): Action {
  const specs: ToolActivateBindingSpec[] = tools.flatMap((t) => {
    const kb = (t as { keybinding?: Keybinding }).keybinding;
    return kb ? [kb.key].flat().map((key) => ({ toolId: t.id, keyOpts: { ...kb, key } })) : [];
  });
  return createToolActivateAction(buildToolActivateBindings(specs));
}

const yields = (a: Action): boolean => actionBindings(a).some((b) => b.opts?.yields === true);

/** The conflicts in one scope. An action whose binding yields is meant to be registered ahead of the one it yields
 *  to (`opts.yields`), so it goes first here, as the host that mounts both registers it. */
function conflictsIn(sweep: Sweep, inScope: (where: string) => boolean, planted: readonly Contribution<unknown>[] = []): string[] {
  const whereOf = (c: Contribution<unknown>): string => sweep.entries.find((e) => e.entry === c)!.where;
  const tools = [...sweep.tools().filter((t) => inScope(whereOf(t))), ...planted];
  const ambient = sweep.ambient().filter((t) => inScope(whereOf(t)));
  const actions = [...sweep.actions.values()]
    .filter(({ action, where }) => action.id !== TOOL_ACTIVATE_ID && inScope(where))
    .map(({ action }) => action);
  actions.sort((a, b) => Number(yields(b)) - Number(yields(a)));
  actions.push(toolKeys(tools));
  const lines: string[] = [];
  reportRouteConflicts({ registry: tools, ambient, actions }, (m) => lines.push(m.split('\n')[1]!.trim()));
  return lines;
}

const in3d = (where: string): boolean => where.startsWith('kernel3d');

describe('kit binding collisions', () => {
  const sweep = sweepKit();

  it('reaches every tool key', () => {
    const keyed = sweep.tools().filter((t) => (t as { keybinding?: Keybinding }).keybinding);
    expect(keyed.length).toBeGreaterThan(20);
  });

  it('reports a planted collision', () => {
    const second = { id: 'planted', eligibility: { focus: true }, keybinding: { key: 'R' } } as unknown as Contribution<unknown>;
    expect(conflictsIn(sweep, (w) => !in3d(w), [second])).toEqual([expect.stringContaining('tool.activate')]);
  });

  it("puts no two of the 2D kit's actions on one input in one scope", () => {
    expect(conflictsIn(sweep, (w) => !in3d(w))).toEqual([]);
  });

  it("puts no two of the 3D kit's actions on one input in one scope", () => {
    expect(conflictsIn(sweep, in3d)).toEqual([]);
  });
});
