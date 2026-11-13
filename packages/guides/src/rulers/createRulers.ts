import { hitPredicate, type CanvasExtensionApi, type GestureBinding, type SurfaceContribution, type UnitScope, type View } from '@weasel-js/core';
import type { UnitValue } from '@weasel-js/quantity';
import { createEmitter } from '@weasel-js/registry';
import { createGuidesLayer } from '../guides/layer';
import type { GuideStore } from '../guides/ops';
import type { Guide } from '../guides/types';
import { rulersGuideAction, rulersPointerAction } from './actions';
import { rulersHitLayer } from './hit';
import { rulersLayout, type RulersLayout, type RulersState } from './layout';
import { documentRulerFrame } from './reading';

type Point = { x: number; y: number };

/** Options for {@link createRulers}. */
export interface RulersOptions {
  /** The guides a drag off a ruler adds to, and a drag on one moves or
   *  removes: `useGuides()` is one. */
  guides: GuideStore;
  /** The document's unit scope: what the labels read in outside every frame
   *  that declares its own. */
  root: UnitScope;
  /** The world point the document reads 0 at. Default world zero. */
  origin?: Point;
  /** How thick each ruler is, in CSS px. Default 20. */
  size?: number;
  /** The most screen px between labeled ticks. Default 100. */
  majorPx?: number;
  /** The least screen px between unlabeled ticks. Default 6. */
  minorPx?: number;
  /** The lengths a labeled step chooses among, as `scaleBar` takes them. */
  lengths?: readonly UnitValue[];
  /** The color of the guide a drag is placing. Default the guides layer's. */
  guideColor?: string;
  /** Contribution id, and the prefix of its layers' and actions'. Default `'rulers'`. */
  id?: string;
  /** Mints a placed guide's id. Default a fresh id per guide. */
  newGuideId?: () => string;
}

/** What {@link createRulers} returns: the canvas half, and the state the drawn
 *  rulers read. */
export interface Rulers {
  /** Install with `<SceneCanvas ambient={[…]}>`. */
  readonly contribution: SurfaceContribution;
  /** Each ruler's thickness in CSS px. */
  readonly size: number;
  get(): RulersState;
  subscribe(listener: () => void): () => void;
  /** Both rulers' ticks as the state stands, or `null` before the first paint. */
  layout(): RulersLayout | null;
  /** `guides` less the one a drag is moving, which the rulers draw where it
   *  is going: what a guides layer's `getGuides` draws. */
  settled(guides: readonly Guide[]): readonly Guide[];
}

const MODS_ANY = { shift: 'optional', alt: 'optional', meta: 'optional', ctrl: 'optional' } as const;
let minted = 0;

const sameView = (a: View | null, b: View): boolean =>
  a !== null && a.x === b.x && a.y === b.y && a.scale.x === b.scale.x && a.scale.y === b.scale.y;

/**
 * Rulers along a canvas's top and left edges, for a 2D view. The contribution
 * follows the view and the pointer, claims presses on the strips the rulers
 * cover, and turns a drag off one into a guide; the rulers themselves are
 * chrome drawn over the canvas from {@link Rulers.layout} — `<Rulers>` in
 * `@weasel-js/ui` draws them. Labels read in the unit scopes of the frame
 * under the pointer, falling back to `root`.
 *
 * One instance serves one canvas: its state is that canvas's view, size and
 * pointer. Build one per canvas; attaching an instance to a second canvas
 * while the first is mounted throws.
 */
export function createRulers(opts: RulersOptions): Rulers {
  const id = opts.id ?? 'rulers';
  const size = opts.size ?? 20;
  const changed = createEmitter();
  // The canvas repaints on this one: only for the draft guide it draws, not every pointer move.
  const draftChanged = createEmitter();
  let state: RulersState = { view: null, width: 0, height: 0, pointer: null, frame: documentRulerFrame(opts.root, opts.origin), draft: null };
  const set = (patch: Partial<RulersState>): void => {
    if (Object.entries(patch).every(([k, v]) => state[k as keyof RulersState] === v)) return;
    const draftMoved = 'draft' in patch && patch.draft !== state.draft;
    state = { ...state, ...patch };
    changed.emit();
    if (draftMoved) draftChanged.emit();
  };
  const subscribe = (listener: () => void) => changed.subscribe(listener);
  const spacing = {
    ...(opts.majorPx === undefined ? {} : { majorPx: opts.majorPx }),
    ...(opts.minorPx === undefined ? {} : { minorPx: opts.minorPx }),
    ...(opts.lengths === undefined ? {} : { lengths: opts.lengths }),
  };
  const actx = {
    id, size, guides: opts.guides, root: opts.root, ...(opts.origin ? { origin: opts.origin } : {}),
    newGuideId: opts.newGuideId ?? (() => `${id}-${Date.now().toString(36)}-${minted++}`),
    get: () => state, set,
  };
  const pointer = rulersPointerAction(actx);
  const guide = rulersGuideAction(actx);
  const hitLayerId = `${id}-hit`;
  const onRuler = hitPredicate((hit) => (hit as { kind?: string } | null | undefined)?.kind === `layer:${hitLayerId}`);
  const bindings: GestureBinding[] = [
    { spec: { kind: 'hover', mods: MODS_ANY }, actionId: pointer.id, opts: { id: `${id}.hover`, params: { over: true } } },
    { spec: { kind: 'hover', motion: 'leave' }, actionId: pointer.id, opts: { id: `${id}.leave`, params: { over: false } } },
    { spec: { kind: 'drag', target: { kindOf: onRuler }, mods: MODS_ANY }, actionId: guide.id, opts: { id: `${id}.drag` } },
  ];
  const draftLayer = createGuidesLayer({
    getGuides: () => (state.draft ? [state.draft] : []), extent: 'full', id: `${id}-draft`, label: 'Guide being placed',
    subscribe: (listener) => draftChanged.subscribe(listener),
    ...(opts.guideColor ? { color: opts.guideColor } : {}),
  });
  let api: CanvasExtensionApi | null = null;

  const contribution: SurfaceContribution = {
    id,
    eligibility: { always: true },
    actions: [pointer, guide],
    bindings,
    layers: [draftLayer, rulersHitLayer(hitLayerId, size, opts.guides.getGuides)],
    attach: (canvas) => {
      if (api !== null) throw new Error(`[guides] rulers '${id}' are attached to a canvas already; createRulers serves one canvas, so build one per canvas`);
      api = canvas;
      canvas.requestRedraw();
      return () => {
        api = null;
      };
    },
    beforePaint: ({ view }) => {
      const rect = api?.getSurfaceRect();
      set({ ...(sameView(state.view, view) ? {} : { view }), ...(rect ? { width: rect.width, height: rect.height } : {}) });
    },
  };

  const settled = (guides: readonly Guide[]): readonly Guide[] => {
    const moving = state.draft?.id;
    return moving === undefined || !guides.some((g) => g.id === moving) ? guides : guides.filter((g) => g.id !== moving);
  };
  return { contribution, size, get: () => state, subscribe, layout: () => rulersLayout(state, spacing), settled };
}
