import { hitPredicate, type Action, type NodeId, type Scene, type SurfaceContribution } from '@weasel-js/core';
import { bakeSymmetry, type BakeResult } from './bake';
import {
  editSymmetries, isSymmetryGroup, poseAtCenter, readGroup, specOfData, symmetryGroupOf,
  symmetryGroupSpec,
} from './group';
import { handleDragAction, SYMMETRY_HANDLE_ACTION_ID } from './handleDrag';
import { SYMMETRY_HANDLE_KIND, symmetryGuideLayer, type SymmetryGuideStyle } from './guide';
import type { SymmetrySpec } from './kinds';
import type { Point } from '@weasel-js/geom';


/** What changes on a group: its spec, its center, or both. */
export interface SymmetryChange {
  spec?: Partial<SymmetrySpec>;
  center?: Point;
}

/** Live symmetry on one scene: which group is being drawn into, the edits a
 *  group takes, and the canvas entry that wires it all up. */
export interface SymmetryController {
  readonly scene: Scene<unknown, string, unknown>;
  /** The group new shapes are drawn into, or null for none. Answers null
   *  once that group is gone, an undone create say. */
  active(): NodeId | null;
  setActive(id: NodeId | null): void;
  /** Hear that the active group, or anything about it, changed. */
  subscribe(listener: () => void): () => void;
  /** Add an empty group, one undo step, and make it the active one. Its layer
   *  defaults to the scene's first. */
  create(opts: { center: Point; symmetry?: Partial<SymmetrySpec>; layer?: string; parent?: NodeId | null }): NodeId;
  /** Group `id`'s spec and center, or null when it is not a symmetry group. */
  read(id: NodeId | null): { spec: SymmetrySpec; center: Point } | null;
  /** Change a group, one undo step. */
  update(id: NodeId, change: SymmetryChange, label?: string): void;
  /** Change a group with no undo step, for the frames of a drag. */
  preview(id: NodeId, change: SymmetryChange): void;
  /** Replace a group with a plain one holding real copies. See {@link bakeSymmetry}. */
  bake(id: NodeId): BakeResult | null;
  /**
   * The canvas entry, for `<SceneCanvas ambient>`: it draws the active
   * group's guide with handles that drag, puts drawn shapes into the active
   * group (the `insertInto` dep), and keeps a path that is its own image
   * under its group symmetric while its anchors are edited (the
   * `pathSymmetry` dep). Built once per controller.
   */
  readonly contribution: SurfaceContribution;
}

/** Options for {@link createSymmetry}. */
export interface CreateSymmetryOptions {
  guide?: SymmetryGuideStyle;
}

const GRAB_HANDLE_ID = 'symmetry.grabHandle';
const grabHandle: Action = {
  id: GRAB_HANDLE_ID,
  label: 'Grab symmetry handle',
  invoker: { timing: 'immediate', run: () => {} },
  enabled: () => true as const,
};

const MODS_ANY = { shift: 'optional', alt: 'optional', meta: 'optional', ctrl: 'optional' } as const;
const onHandle = hitPredicate((hit) => (hit as { kind?: string } | null | undefined)?.kind === SYMMETRY_HANDLE_KIND);

/** Live symmetry for `scene`. Pass `symmetryRegistry` to the scene too, so its groups save. */
export function createSymmetry(scene: Scene<unknown, string, unknown>, opts: CreateSymmetryOptions = {}): SymmetryController {
  let activeId: NodeId | null = null;
  const listeners = new Set<() => void>();
  const notify = () => { for (const l of [...listeners]) l(); };

  const write = (id: NodeId, change: SymmetryChange): void => {
    const node = scene.get(id);
    if (!node || !isSymmetryGroup(scene, id)) return;
    if (change.spec) scene.update(id, { data: { ...(node.data as object), symmetry: { ...specOfData(node.data), ...change.spec } } });
    if (change.center) scene.setPose(id, { ...(node.pose as object), ...poseAtCenter(change.center) });
  };

  const ctrl: SymmetryController = {
    scene,
    active: () => (isSymmetryGroup(scene, activeId) ? activeId : null),
    setActive(id) {
      activeId = id;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    create({ center, symmetry, layer, parent }) {
      const id = scene.add(symmetryGroupSpec({
        layer: layer ?? scene.layers[0]?.id ?? 'default', center, ...(symmetry ? { symmetry } : {}),
        ...(parent !== undefined ? { parent } : {}),
      }) as never);
      ctrl.setActive(id);
      return id;
    },
    read: (id) => readGroup(scene, id),
    update(id, change, label = 'Change symmetry') {
      scene.batch(label, () => write(id, change));
      notify();
    },
    preview(id, change) {
      scene.untracked(() => write(id, change));
      notify();
    },
    bake(id) {
      const out = bakeSymmetry(scene, id);
      notify();
      return out;
    },
    contribution: undefined as unknown as SurfaceContribution,
  };

  const guide = symmetryGuideLayer({
    current() {
      const id = ctrl.active();
      const g = readGroup(scene, id);
      return g === null || id === null ? null : { group: id, ...g };
    },
    subscribe: ctrl.subscribe,
  }, opts.guide);

  const action = handleDragAction(ctrl);
  (ctrl as { contribution: SurfaceContribution }).contribution = {
    id: 'weasel-symmetry',
    eligibility: { claimed: true },
    deps: {
      insertInto: () => ({ get: () => ctrl.active() }),
      pathSymmetry: () => ({ transforms: (pathId: string) => editSymmetries(scene, symmetryGroupOf(scene, pathId)) }),
    },
    actions: [action, grabHandle],
    bindings: [
      { spec: { kind: 'drag', target: { kindOf: onHandle }, mods: MODS_ANY }, actionId: SYMMETRY_HANDLE_ACTION_ID },
      // A handle's claim bars every other binding for the whole press, so its
      // pointer-down and a click that never becomes a drag need one too.
      { spec: { kind: 'pointerDown', target: `affordance:${SYMMETRY_HANDLE_KIND}` }, actionId: GRAB_HANDLE_ID },
      { spec: { kind: 'click', target: `affordance:${SYMMETRY_HANDLE_KIND}` }, actionId: GRAB_HANDLE_ID },
    ],
    attach: (api) => {
      const off = api.registerLayer(guide);
      api.requestRedraw();
      return off;
    },
  };
  return ctrl;
}

