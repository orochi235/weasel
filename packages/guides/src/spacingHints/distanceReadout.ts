import { sceneMagnification, type Action, type GestureBinding, type ModSpec, type NodeId, type Scene, type SnapMark, type SnapOutcomeStore, type SurfaceContribution } from '@weasel-js/core';
import { measureDistances, type DistanceReadout } from './distance';
import { worldBoundsOf, worldUnionOf } from '../guides/alignment/sceneBounds';
import type { ImmediateParams } from '@weasel-js/core';


/** Options for `distanceReadout`. */
export interface DistanceReadoutOptions {
  /** The key held to show the readout. Default `'alt'`. */
  modifier?: 'alt' | 'ctrl' | 'meta' | 'shift';
  /** The color of the marks it writes. Default: the readout layer's. */
  color?: string;
  /** Contribution id, and the prefix of its action's. Default `'distanceReadout'`. */
  id?: string;
}

/** The readout as snap marks: a `distance` per gap, its value divided by the
 *  magnification its ends are drawn at, and a `line` per leader. */
function marksOf(r: DistanceReadout, color: string | undefined, magnification: number): SnapMark[] {
  const c = color === undefined ? {} : { color };
  return [
    ...r.gaps.map((g): SnapMark => {
      const value = (g.max - g.min) / magnification;
      return g.axis === 'x'
        ? { kind: 'distance', from: { x: g.min, y: g.at }, to: { x: g.max, y: g.at }, value, ...c }
        : { kind: 'distance', from: { x: g.at, y: g.min }, to: { x: g.at, y: g.max }, value, ...c };
    }),
    ...r.leaders.flatMap((l): SnapMark[] => {
      if (l.span === undefined) return [];
      return [l.axis === 'x'
        ? { kind: 'line', from: { x: l.offset, y: l.span.min }, to: { x: l.offset, y: l.span.max }, ...c }
        : { kind: 'line', from: { x: l.span.min, y: l.offset }, to: { x: l.span.max, y: l.offset }, ...c }];
    }),
  ];
}

/** What `distanceReadout` returns: a surface contribution, plus a read of
 *  what it is showing. */
export interface DistanceReadoutContribution extends SurfaceContribution {
  /** The distances on screen now; empty while hidden. */
  read(): DistanceReadout;
}

const EMPTY: DistanceReadout = { gaps: [], leaders: [] };
const MODIFIERS: readonly NonNullable<DistanceReadoutOptions['modifier']>[] = ['alt', 'ctrl', 'meta', 'shift'];

/** The ids and every node under them: what the pick under the pointer skips. */
function subtreeOf(scene: Scene<unknown, string, unknown>, ids: readonly NodeId[]): Set<NodeId> {
  const out = new Set<NodeId>();
  const stack = [...ids];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    stack.push(...scene.childrenOf(id));
  }
  return out;
}

/**
 * Distance readouts on hover: while `modifier` is held over a shape, the
 * distances from the selection's box to that shape's, on each axis where they
 * separate, measured by `measureDistances` and drawn as labeled gaps. Pass it
 * in `<SceneCanvas ambient>`. It runs on `hover` bindings, so it claims no
 * input, and it reads the canvas's `selection`, `scene`, `nodeAtPoint`,
 * `poseDescriptor`, and `snapReadout` deps. A press hides it.
 */
export function distanceReadout(opts: DistanceReadoutOptions = {}): DistanceReadoutContribution {
  const id = opts.id ?? 'distanceReadout';
  const modifier = opts.modifier ?? 'alt';
  let shown: DistanceReadout = EMPTY;
  let store: SnapOutcomeStore | null = null;
  const show = (next: DistanceReadout, magnification = 1): void => {
    if (next === shown || (next.gaps.length === 0 && shown.gaps.length === 0)) return;
    shown = next;
    store?.set(marksOf(next, opts.color, magnification));
  };

  const action: Action = {
    id: `${id}.measure`,
    label: 'Measure distance to the shape under the pointer',
    requires: ['selection', 'scene', 'nodeAtPoint', 'poseDescriptor', 'snapReadout'],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const p = params as (ImmediateParams & { show?: boolean }) | undefined;
        const { selection, scene, nodeAtPoint, poseDescriptor, snapReadout } = deps;
        if (snapReadout !== undefined) store = snapReadout.store;
        const ids = selection?.get() ?? [];
        if (p?.show !== true || p.world === undefined
          || scene === undefined || nodeAtPoint === undefined || ids.length === 0) {
          show(EMPTY);
          return;
        }
        const hit = nodeAtPoint(p.world, subtreeOf(scene, ids));
        const from = worldUnionOf(scene, ids, { poseDescriptor });
        const [to] = hit === null ? [] : worldBoundsOf(scene, [hit], { poseDescriptor });
        if (from === null || to === undefined) show(EMPTY);
        else show(measureDistances(from, to), sceneMagnification(scene, [...ids, hit!]));
      },
    },
  };

  const mods = (held: boolean): ModSpec => Object.fromEntries(
    MODIFIERS.map((m) => [m, m === modifier ? held : 'optional']),
  );
  const bindings: GestureBinding[] = [
    { spec: { kind: 'hover', mods: mods(true) }, actionId: action.id, opts: { id: `${id}.show`, params: { show: true } } },
    { spec: { kind: 'hover', mods: mods(false) }, actionId: action.id, opts: { id: `${id}.hide`, params: { show: false } } },
    { spec: { kind: 'hover', motion: 'leave' }, actionId: action.id, opts: { id: `${id}.leave`, params: { show: false } } },
  ];

  return {
    id,
    eligibility: { always: true },
    actions: [action],
    bindings,
    attach: (api) => {
      const el = api.element;
      const hide = (): void => show(EMPTY);
      el?.addEventListener('pointerdown', hide, true);
      return () => {
        el?.removeEventListener('pointerdown', hide, true);
        show(EMPTY);
        store = null;
      };
    },
    read: () => shown,
  };
}
