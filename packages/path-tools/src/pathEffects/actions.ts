/**
 * The path-effect actions: make a live blend, bend, repeat, or text along a
 * path from the selection; change one's settings; and expand one into ordinary paths.
 */
import { type Action, type ActionDeps, ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import { worldEditToStorage } from '@weasel-js/geom';
import {
  commitOps, createSetDataOp, deleteNode, derivedDepOf, hiddenSourceDeleteOps, insertAt, isTextData, type NodeId, type Op, type PathEffect, pathEffectNode, pathEffectOf, pathEffectParts, resolvePartPaint, registeredPathEffects, type Scene, type SceneNode as Node, slotOf, pathOperationTags,
} from '@weasel-js/core';
import { EFFECT_DEFAULTS, withEffectSettings } from './params';
import { hiddenOnItsOwn, hiddenOps } from './hiding';
import { icon } from '../icons.gen';
import { pathEffectSettingsForm } from './settingsForm';

type AnyScene = Scene<unknown, string, unknown>;
type AnyNode = Node<unknown, string, unknown>;

/** The `group` every path-effect action is in, for an `<ActionBar>`. */
export const PATH_EFFECTS_GROUP = 'pathEffects';

/** The selected leaves, in the order they were selected, when there are at
 *  least two. `null` too in a scene whose registry holds no path effects,
 *  which could not save one. */
function selectedLeaves(deps: ActionDeps | undefined): AnyNode[] | null {
  const scene = deps?.scene as AnyScene | undefined;
  if (!scene || registeredPathEffects(scene.registry) === null) return null;
  const leaves = (deps?.selection?.get() ?? [])
    .map((id) => scene.get(id as NodeId))
    .filter((n): n is AnyNode => n !== undefined && n.kind === 'mark');
  return leaves.length >= 2 ? leaves : null;
}

/** The selected nodes holding a path effect, of `kind` where given. */
export function selectedEffects(deps: ActionDeps | undefined, ids?: readonly string[], kind?: unknown): AnyNode[] {
  const scene = deps?.scene as AnyScene | undefined;
  if (!scene) return [];
  return (ids ?? deps?.selection?.get() ?? [])
    .map((id) => scene.get(id as NodeId))
    .filter((n): n is AnyNode => {
      const effect = n === undefined ? null : pathEffectOf(n);
      return effect !== null && (kind === undefined || effect.kind === kind);
    });
}

/** Whether the selection holds a path effect: what editing and expanding work on. */
function holdsEffect(deps?: ActionDeps): true | ActionDisabledReason {
  return selectedEffects(deps).length > 0 ? true : ActionDisabledReason.SelectionRequired;
}

interface CreateSpec {
  id: string;
  label: string;
  icon: Action['icon'];
  kind: PathEffect['kind'];
  key: string;
  code: string;
  /** Where the new node goes: between its two sources, or over both. */
  between: boolean;
  /** Take a third selected leaf as a source too. */
  third?: boolean;
  /** The selected leaves as sources, in order, or `null` where they cannot
   *  be; in selection order when absent. */
  order?(leaves: readonly AnyNode[]): AnyNode[] | null;
}

/** The sources `spec` makes from the selection, or `null` when it cannot. */
function sourcesFor(spec: CreateSpec, deps: ActionDeps | undefined): AnyNode[] | null {
  const leaves = selectedLeaves(deps);
  return leaves && spec.order ? spec.order(leaves) : leaves;
}

function createEffectAction(spec: CreateSpec): Action & { requires: string[] } {
  return {
    id: spec.id,
    label: spec.label,
    icon: spec.icon,
    tags: pathOperationTags('command'),
    group: PATH_EFFECTS_GROUP,
    // Alt+Shift, which no major browser takes for these letters (see
    // `BROWSER_RESERVED_CHORDS`); `code` too, since with Alt held on a Mac the
    // key reads as another glyph.
    defaultBinding: [{ spec: { kind: 'key', key: spec.key, code: spec.code, mods: { alt: true, shift: true } }, opts: { id: `${spec.id}.key` } }],
    eligible: { capability: 'creates-shapes' },
    requires: ['selection', 'scene', 'applyOps'],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const scene = deps.scene as AnyScene | undefined;
        const leaves = sourcesFor(spec, deps);
        if (!scene || !leaves) return;
        const derivations = registeredPathEffects(scene.registry)!;
        const [a, b, c] = leaves as [AnyNode, AnyNode, AnyNode?];
        const sources = spec.third && c ? [a.id, b.id, c.id] : [a.id, b.id];
        const settled = withEffectSettings(EFFECT_DEFAULTS[spec.kind], params as Record<string, unknown> | undefined);
        const foundHidden = settled.hideSources === true ? sources.flatMap((id, at) => (hiddenOnItsOwn(scene, id) ? [at] : [])) : [];
        const effect = foundHidden.length > 0 ? { ...settled, foundHidden } : settled;
        const sameParent = a.parent === b.parent;
        const slots = [slotOf(scene, a.id), slotOf(scene, b.id)];
        // Inserting at the upper source's slot puts the steps just under it.
        const index = !sameParent ? -1 : spec.between ? Math.max(...slots) : Math.max(...slots) + 1;
        const node = {
          ...pathEffectNode(effect, sources, a.layer, derivations),
          id: scene.mintId(),
          parent: sameParent ? a.parent : null,
        } as unknown as AnyNode;
        // Hiding a source after the insert, so undo shows it before the effect goes.
        const hide = effect.hideSources === true ? sources.flatMap((id) => hiddenOps(scene, id, true, spec.label)) : [];
        commitOps(deps, [insertAt(node, index, spec.label), ...hide], spec.label);
        deps.selection?.set([node.id] as never);
      },
    } satisfies ImmediateInvoker,
    enabled: (deps) => {
      const scene = deps?.scene as AnyScene | undefined;
      if (scene && registeredPathEffects(scene.registry) === null) return ActionDisabledReason.NotApplicable;
      if (sourcesFor(spec, deps)) return true;
      return selectedLeaves(deps) ? ActionDisabledReason.NotApplicable : ActionDisabledReason.SelectionRequired;
    },
  };
}

/**
 * Steps between the first two selected shapes, in the order they were
 * selected: `params.steps` of them, each shape, fill, stroke and turn
 * interpolated, laid along a third selected path where there is one. The
 * blend is live — editing a source moves its steps — and goes just under the
 * upper of the first two. Its other params are `BlendEffect`'s.
 */
export const blendAction = createEffectAction({
  id: 'blend', label: 'Blend', icon: icon('blend'), kind: 'blend', key: 'b', code: 'KeyB', between: true, third: true,
});

/**
 * The first selected shape bent along the second, live: editing the spine
 * re-bends it. Params are `BendAlongEffect`'s.
 */
export const bendAlongAction = createEffectAction({
  id: 'bendAlong', label: 'Bend Along Path', icon: icon('bendAlong'), kind: 'bendAlong', key: 'w', code: 'KeyW', between: false,
});

/**
 * Copies of the first selected shape along the second, live. Params are
 * `RepeatAlongEffect`'s.
 */
export const repeatAlongAction = createEffectAction({
  id: 'repeatAlong', label: 'Repeat Along Path', icon: icon('repeatAlong'), kind: 'repeatAlong', key: 'r', code: 'KeyR', between: false,
});

/** Two leaves, the text one first. */
function textThenPath(leaves: readonly AnyNode[]): AnyNode[] | null {
  if (leaves.length !== 2) return null;
  const [a, b] = leaves as [AnyNode, AnyNode];
  if (isTextData(a.data) === isTextData(b.data)) return null;
  return isTextData(a.data) ? [a, b] : [b, a];
}

/**
 * A selected text laid along the other selected shape's outline, live: editing
 * either re-lays it. Takes exactly one text and one shape that is not, in
 * either order, goes just over the upper of the two, and hides both while it
 * shows them. Params are `TextAlongEffect`'s.
 */
export const textAlongAction = createEffectAction({
  id: 'textAlong', label: 'Text Along Path', icon: icon('textAlong'), kind: 'textAlong', key: 'x', code: 'KeyX', between: false,
  order: textThenPath,
});

const EDIT_LABEL = 'Edit Path Effect';

/**
 * Change the settings of path effects: `params.ids` when given, else the
 * selected ones, and of those only the `params.kind` ones when given. Every
 * other param is a setting, laid over each effect's own, and one that would
 * change nothing commits nothing. Its settings form shows what the selection
 * holds. Consecutive edits
 * of one effect coalesce, so a slider dragged through many values is one
 * undo step where the scene coalesces.
 */
export const editPathEffectAction: Action & { requires: string[] } = {
  id: 'editPathEffect',
  label: EDIT_LABEL,
  icon: icon('core:tune'),
  requires: ['selection', 'scene', 'applyOps'],
  settings: pathEffectSettingsForm,
  enabled: holdsEffect,
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const p = params as Record<string, unknown> | undefined;
      const ids = Array.isArray(p?.ids) ? (p.ids as string[]) : undefined;
      const ops: Op[] = [];
      for (const node of selectedEffects(deps, ids, p?.kind)) {
        const effect = pathEffectOf(node)!;
        const next = withEffectSettings(effect, p);
        if (sameEffect(effect, next)) continue;
        ops.push(createSetDataOp({
          id: node.id,
          from: node.data,
          to: { ...(node.data as object), pathEffect: next },
          label: EDIT_LABEL,
          coalesceKey: `${EDIT_LABEL}:${node.id}`,
        }));
      }
      commitOps(deps, ops, EDIT_LABEL);
    },
  } satisfies ImmediateInvoker,
};

function sameEffect(a: PathEffect, b: PathEffect): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a as unknown as Record<string, unknown>)[k] !== (b as unknown as Record<string, unknown>)[k]) return false;
  }
  return true;
}

const EXPAND_LABEL = 'Expand to Paths';

/**
 * Turn each selected path effect into the ordinary paths it shows, in its
 * slot and in its paint, and select them. Its sources stay, and the paths no
 * longer follow them — except the sources an effect hid, which go with it
 * unless another effect still reads them.
 */
export const expandPathEffectAction: Action & { requires: string[] } = {
  id: 'expandPathEffect',
  label: EXPAND_LABEL,
  icon: icon('expand'),
  group: PATH_EFFECTS_GROUP,
  defaultBinding: [{ spec: { kind: 'key', key: 'e', code: 'KeyE', mods: { alt: true, shift: true } }, opts: { id: 'expandPathEffect.key' } }],
  eligible: { capability: 'creates-shapes' },
  requires: ['selection', 'scene', 'applyOps'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const scene = deps.scene as AnyScene | undefined;
      if (!scene) return;
      // Top slot first, so a delete cannot shift a later one's index.
      const effects = selectedEffects(deps)
        .map((node) => ({ node, at: slotOf(scene, node.id) }))
        .sort((x, y) => y.at - x.at);
      const ops: Op[] = [];
      const made: string[] = [];
      for (const { node, at } of effects) {
        const sources = (Array.isArray(node.dependsOn) ? node.dependsOn : []).map((id) => derivedDepOf(scene, id, node));
        const parts = pathEffectParts(node, sources) ?? [];
        ops.push(deleteNode(scene, node, EXPAND_LABEL));
        parts.forEach((part, k) => {
          const { pose, path } = worldEditToStorage({ x: 0, y: 0, width: 0, height: 0 }, part.path);
          const { fill, stroke } = resolvePartPaint(part, node.data as Parameters<typeof resolvePartPaint>[1]);
          const data = { path, ...(fill ? { fill } : {}), ...(stroke ? { stroke } : {}) };
          const copy = { id: scene.mintId(), kind: 'mark', layer: node.layer, parent: node.parent, pose, data } as AnyNode;
          ops.push(insertAt(copy, at < 0 ? at : at + k, EXPAND_LABEL));
          made.push(copy.id);
        });
      }
      if (ops.length === 0) return;
      // Last, so each delete finds its source's slot after the expansion.
      ops.push(...hiddenSourceDeleteOps(scene, effects.map((e) => e.node.id), EXPAND_LABEL));
      commitOps(deps, ops, EXPAND_LABEL);
      deps.selection?.set(made as never);
    },
  } satisfies ImmediateInvoker,
  enabled: holdsEffect,
};
