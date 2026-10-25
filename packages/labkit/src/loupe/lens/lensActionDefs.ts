/**
 * The lens actions, and the Loupe keymap their keys live in. Every key is a
 * plain key inside the keymap, so a story's own typing never reaches a lens:
 * only the leader, Alt+L, opens it.
 *
 * Free of React so the actions can be tested without a DOM.
 */
import {
  type Action,
  ActionDisabledReason,
  createDeleteOp,
  createTransformOp,
  key,
  keymapContribution,
  type NodeId,
  type Op,
} from '@weasel-js/core';
import type { Contribution, GestureBinding } from '@weasel-js/routing';
import { lensClosure, lensesOf, lensIdsOf, setAimOps, setLensOps, settingsOf } from './lensScene';
import type {
  LensReadout,
  LensScene,
  LensSettings,
  LensSourceKind,
  LensView,
  LoupePoint,
} from './lensTypes';

/** What the lens actions do to the host's lenses. Every member is read on each
 *  invocation, so one stable object serves the life of the registration. */
export interface LensActionApi<C> {
  /** The focused or selected lens, else the most recently added; null with none up. */
  current(): string | null;
  /** Adds a lens, at `at` or wherever the host puts one; null when `MAX_LENSES` are up. */
  add(at?: LoupePoint): string | null;
  apply(ops: readonly Op[]): void;
  scene: LensScene<C>;
  /** Writes the current lens's reticle to the client point through `scene.overrides.hold()`. */
  follow(client: LoupePoint): void;
  /** Lets go of the lens's reticle that `follow` holds, leaving any other writer's override on it and every other
   *  lens's hold. */
  unfollow(lensId: string): void;
  /** `true`, or the reason the source is unavailable. */
  sourceAvailable(kind: LensSourceKind): true | string;
  openCompareMenu(lensId: string): void;
}

/** Each Live lens is a whole second render, so the count is capped. */
export const MAX_LENSES = 8;

/** Every lens action's id, by short name. */
export const LENS_ACTION_IDS = {
  add: 'loupe.add',
  close: 'loupe.close',
  pinned: 'loupe.aim.pinned',
  follow: 'loupe.aim.follow',
  glass: 'loupe.aim.glass',
  followMove: 'loupe.follow',
  seam: 'loupe.seam',
  live: 'loupe.source.live',
  pixels: 'loupe.source.pixels',
  dpr: 'loupe.dpr.next',
  swap: 'loupe.view.swap',
  split: 'loupe.view.split',
  difference: 'loupe.view.difference',
  opposite: 'loupe.compare.opposite',
  compareMenu: 'loupe.compare.menu',
  clearCompare: 'loupe.compare.clear',
  token: 'loupe.readout.token',
  contrast: 'loupe.readout.contrast',
  grid: 'loupe.readout.grid',
  zoomIn: 'loupe.factor.in',
  zoomOut: 'loupe.factor.out',
} as const;

type LensActionId = (typeof LENS_ACTION_IDS)[keyof typeof LENS_ACTION_IDS];

/** The Loupe keymap's keys, by action. */
export const LENS_KEYS: Partial<Record<LensActionId, string>> = {
  'loupe.add': 'l',
  'loupe.close': 'Shift+L',
  'loupe.aim.pinned': 'p',
  'loupe.aim.follow': 'f',
  'loupe.aim.glass': 'b',
  'loupe.source.live': 'v',
  'loupe.source.pixels': 'x',
  'loupe.dpr.next': 'r',
  'loupe.view.swap': 's',
  'loupe.view.split': '\\',
  'loupe.view.difference': 'd',
  'loupe.compare.opposite': 'o',
  'loupe.compare.menu': 'k',
  'loupe.compare.clear': 'Shift+O',
  'loupe.readout.token': 't',
  'loupe.readout.contrast': 'c',
  'loupe.readout.grid': 'g',
  'loupe.factor.in': '=',
  'loupe.factor.out': '-',
};

/** Matched by code: Alt changes the character a key produces on macOS. */
export const LOUPE_LEADER = { ...key('Alt+L'), code: 'KeyL' };

const DPR_CYCLE: readonly (readonly number[])[] = [[1], [2], [1, 2]];
/** The least and greatest factor a lens zooms to. */
export const FACTOR_MIN = 1;
export const FACTOR_MAX = 64;
/** The factors the zoom keys step through, and the rim's zoom stops at: every power of two between the two. */
export const FACTOR_STOPS: readonly number[] = Array.from(
  { length: Math.log2(FACTOR_MAX / FACTOR_MIN) + 1 },
  (_, i) => FACTOR_MIN * 2 ** i,
);

const ANY_MODS = {
  alt: 'optional',
  ctrl: 'optional',
  meta: 'optional',
  shift: 'optional',
} as const;

/** The DPR set after `dprs`: 1× → 2× → 1×|2× → 1×. */
function nextDprs(dprs: readonly number[]): readonly number[] {
  const at = DPR_CYCLE.findIndex(
    (d) => d.length === dprs.length && d.every((v, i) => v === dprs[i]),
  );
  return DPR_CYCLE[(at + 1) % DPR_CYCLE.length] as readonly number[];
}

/** One immediate action on the current lens, given its id and settings. */
type Run<C> = (lensId: string, settings: LensSettings<C>) => void;
type Patch<C> = (s: LensSettings<C>) => Partial<Omit<LensSettings<C>, 'aim'>>;

/** Builds actions that apply to the current lens, declining while none is up. */
function lensActionFactory<C>(api: LensActionApi<C>) {
  const lensUp = () => (api.current() === null ? ActionDisabledReason.NotApplicable : true);
  const on = (
    id: LensActionId,
    label: string,
    run: Run<C>,
    enabled: () => true | string = () => true,
  ): Action => ({
    id,
    label,
    group: 'loupe',
    enabled: () => {
      const up = lensUp();
      if (up !== true) return up;
      return enabled();
    },
    invoker: {
      timing: 'immediate',
      run() {
        const lensId = api.current();
        const settings = lensId === null ? null : settingsOf(api.scene, lensId);
        if (lensId !== null && settings !== null) run(lensId, settings);
      },
    },
  });
  const set = (id: LensActionId, label: string, patch: Patch<C>, enabled?: () => true | string) =>
    on(id, label, (lensId, s) => api.apply(setLensOps(api.scene, lensId, patch(s))), enabled);
  return { on, set };
}

const toggled = <T>(list: readonly T[], item: T): T[] =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

const stepped = (factor: number, by: number) =>
  Math.min(FACTOR_MAX, Math.max(FACTOR_MIN, factor * by));

/** Source, DPR, view, comparison, readout and factor: each a write to the lens's settings. */
function settingActions<C>(api: LensActionApi<C>, comparisons: { opposite: () => C }): Action[] {
  const { on, set } = lensActionFactory(api);
  const ids = LENS_ACTION_IDS;
  const readout =
    (r: LensReadout): Patch<C> =>
    (s) => ({ readouts: toggled(s.readouts, r) });
  const source = (kind: LensSourceKind) =>
    [() => ({ source: kind }), () => api.sourceAvailable(kind)] as const;
  const view =
    (v: LensView): Patch<C> =>
    () => ({ view: v });
  return [
    set(ids.live, 'Source: live', ...source('live')),
    set(ids.pixels, 'Source: pixels', ...source('pixels')),
    set(ids.dpr, 'Next DPR', (s) => ({ dprs: nextDprs(s.dprs) })),
    set(ids.swap, 'View: swap', view('swap')),
    set(ids.split, 'View: split', view('split')),
    set(ids.difference, 'View: difference', view('difference')),
    set(ids.opposite, 'Compare: opposite', () => ({ compare: comparisons.opposite() })),
    on(ids.compareMenu, 'Compare with…', (lensId) => api.openCompareMenu(lensId)),
    set(ids.clearCompare, 'Compare: clear', () => ({ compare: null })),
    set(ids.token, 'Readout: token', readout('token')),
    set(ids.contrast, 'Readout: contrast', readout('contrast')),
    set(ids.grid, 'Readout: grid', readout('grid')),
    set(ids.zoomIn, 'Zoom in', (s) => ({ factor: stepped(s.factor, 2) })),
    set(ids.zoomOut, 'Zoom out', (s) => ({ factor: stepped(s.factor, 0.5) })),
  ];
}

/** Commits a Follow reticle's held pose as one step with the switch to Pinned. */
function pinOps<C>(scene: LensScene<C>, lensId: string, from: LensSettings<C>): Op[] {
  const ops = setAimOps(scene, lensId, 'pinned');
  const reticleId = lensIdsOf(scene, `${lensId}:body`)?.reticle;
  const reticle = reticleId === undefined ? undefined : scene.get(reticleId);
  const held = reticleId === undefined ? undefined : scene.overrides.read(reticleId)?.pose;
  if (from.aim === 'follow' && reticle && held) {
    const to = { ...held };
    ops.push(createTransformOp({ id: reticle.id, from: reticle.pose, to, label: 'set lens aim' }));
  }
  return ops;
}

/** Add, close, and the aims. */
function lensLifeActions<C>(api: LensActionApi<C>): Action[] {
  const { scene } = api;
  const { on } = lensActionFactory(api);
  const add: Action = {
    id: LENS_ACTION_IDS.add,
    label: 'Add lens',
    group: 'loupe',
    enabled: () =>
      lensesOf(scene).length >= MAX_LENSES ? `At most ${MAX_LENSES} lenses at once` : true,
    invoker: { timing: 'immediate', run: () => void api.add() },
  };
  const close = on(LENS_ACTION_IDS.close, 'Close lens', (lensId, s) => {
    // Leader first: it depends on both of the others.
    const ids = lensClosure(scene, [`${lensId}:body`]).reverse();
    const nodes = ids.flatMap((id) => scene.get(id as NodeId) ?? []);
    api.apply(nodes.map((node) => createDeleteOp({ node, label: 'close lens' })));
    // A Follow reticle's held pose would otherwise outlive the node.
    if (s.aim === 'follow') api.unfollow(lensId);
  });
  const pinned = on(LENS_ACTION_IDS.pinned, 'Aim: pinned', (lensId, s) => {
    api.apply(pinOps(scene, lensId, s));
    // After the write lands, or the scene answers with the old pose in between.
    if (s.aim === 'follow') api.unfollow(lensId);
  });
  const follow = on(LENS_ACTION_IDS.follow, 'Aim: follow', (lensId) =>
    api.apply(setAimOps(scene, lensId, 'follow')),
  );
  const glass = on(LENS_ACTION_IDS.glass, 'Aim: glass', (lensId, s) => {
    api.apply(setAimOps(scene, lensId, 'glass'));
    if (s.aim === 'follow') api.unfollow(lensId);
  });
  // `held`: the reticle keeps following through a drag, which a plain hover stands down for.
  const followMove: Action = {
    id: LENS_ACTION_IDS.followMove,
    label: 'Follow the pointer',
    group: 'loupe',
    defaultBinding: [{ spec: { kind: 'hover', held: 'optional', mods: ANY_MODS }, opts: {} }],
    enabled: () => {
      const lensId = api.current();
      const aim = lensId === null ? null : settingsOf(scene, lensId)?.aim;
      return aim === 'follow' ? true : ActionDisabledReason.NotApplicable;
    },
    invoker: {
      timing: 'immediate',
      run(_deps, params) {
        api.follow({ x: params?.clientX as number, y: params?.clientY as number });
      },
    },
  };
  return [add, close, pinned, follow, glass, followMove];
}

/** The lens actions over `api`; `comparisons.opposite` is what the opposite-mode preset compares against. */
export function createLensActions<C>(
  api: LensActionApi<C>,
  comparisons: { opposite: () => C },
): readonly Action[] {
  return [...lensLifeActions(api), ...settingActions(api, comparisons)];
}

/** The Loupe keymap and its leader, carrying `actions`. Each binding's id is
 *  its action's id, which is what a host rebinds it by. */
export function createLoupeKeymap(actions: readonly Action[]): Contribution<never>[] {
  const bindings: GestureBinding[] = [];
  for (const a of actions) {
    const k = LENS_KEYS[a.id as LensActionId];
    if (k !== undefined) bindings.push({ spec: key(k), actionId: a.id, opts: { id: a.id } });
  }
  return keymapContribution({
    id: 'loupe',
    label: 'Loupe',
    leader: LOUPE_LEADER,
    bindings,
    actions,
  });
}
