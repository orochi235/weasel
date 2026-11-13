import { ActionDisabledReason, type Action, type ActionDeps, type GestureBinding } from '@weasel-js/routing';
import { placedPagesOf } from 'core/pages/pageNodes';
import type { PlacedPage } from 'core/pages/pages';
import type { Contribution } from 'tools/overlayBinding';
import {
  stepPresentation, viewCamera, type PageRequest, type PresentationStepOptions,
} from './presentationStep';

/** The entry {@link createPresentationContribution} builds. */
export const PRESENTATION_ID = 'weasel-presentation';
/** Steps through the page order: params `{ by }` or `{ to: 'first' | 'last' }`, one variant each. */
export const PRESENT_STEP_ACTION_ID = 'present.step';
/** Shows one page: params `{ to }`, its id or its index. */
export const PRESENT_GO_ACTION_ID = 'present.go';

/** What {@link createPresentationContribution} takes. */
export interface PresentationOptions extends PresentationStepOptions {
  /** The pages, in order, where they sit in world space. Default the `scene` dep's page run (`placedPagesOf`). */
  pages?: (deps: ActionDeps) => readonly PlacedPage[];
  /** Bind the keys: Right, Down and Page Down step on, Left, Up and Page Up step back, Home and End go to
   *  either end. Default `true`. `false` registers the actions alone, for a host whose own input steps the
   *  show: a presentation runtime with a keymap of its own, which can also step a canvas handle directly with
   *  `stepPresentation(canvasCamera(api), …)`. */
  keys?: boolean;
  /** Told the page each step arrives at. */
  onPage?: (page: PlacedPage) => void;
}

const STEP_VARIANTS = [
  { key: 'next', label: 'Next Page', params: { by: 1 } },
  { key: 'previous', label: 'Previous Page', params: { by: -1 } },
  { key: 'first', label: 'First Page', params: { to: 'first' } },
  { key: 'last', label: 'Last Page', params: { to: 'last' } },
] as const;

const KEYS: readonly (readonly [variant: (typeof STEP_VARIANTS)[number]['key'], keys: readonly string[]])[] = [
  ['next', ['ArrowRight', 'ArrowDown', 'PageDown']],
  ['previous', ['ArrowLeft', 'ArrowUp', 'PageUp']],
  ['first', ['Home']],
  ['last', ['End']],
];

function requestOf(params: Readonly<Record<string, unknown>> | undefined, go: boolean): PageRequest | null {
  const to = params?.to;
  if (typeof to === 'string' || typeof to === 'number') return go || to === 'first' || to === 'last' ? { to } : null;
  const by = params?.by;
  return !go && typeof by === 'number' && Number.isFinite(by) ? { by } : null;
}

function presentationAction(id: string, label: string, go: boolean, opts: PresentationOptions): Action {
  const pagesOf = (deps: ActionDeps | undefined): readonly PlacedPage[] => {
    if (!deps) return [];
    if (opts.pages) return opts.pages(deps);
    return deps.scene ? placedPagesOf(deps.scene) : [];
  };
  return {
    id,
    label,
    group: 'presentation',
    ...(go ? {} : { variants: STEP_VARIANTS.map((v) => ({ ...v, params: { ...v.params } })) }),
    requires: ['view', 'scene'],
    // A canvas with no pages leaves the keys to whatever else binds them.
    enabled: (deps, _at, _carried, params) =>
      deps?.view && pagesOf(deps).length > 0 && requestOf(params, go) !== null ? true : ActionDisabledReason.NotApplicable,
    invoker: {
      timing: 'immediate',
      run(deps, params) {
        const request = requestOf(params, go);
        if (!deps.view || request === null) return;
        const page = stepPresentation(viewCamera(deps.view), pagesOf(deps), request, opts);
        if (page !== null) opts.onPage?.(page);
      },
    },
  };
}

function keyBindings(): GestureBinding[] {
  return KEYS.map(([variant, key]) => ({
    spec: { kind: 'key', key: [...key] },
    actionId: PRESENT_STEP_ACTION_ID,
    opts: {
      id: `${PRESENTATION_ID}.${variant}`,
      params: { ...STEP_VARIANTS.find((v) => v.key === variant)!.params },
    },
  }));
}

/**
 * Slide navigation over a document's pages, as one entry for
 * `<SceneCanvas ambient>`: `present.step` and `present.go` fit the view to a
 * page with `fitViewToPage`, gliding there through the `view` dep's animation,
 * and the keys step through the page order with `adjacentPage`. The page a
 * step starts from is the one the view shows, or is gliding to, so a pan or a
 * zoom in between is stepped on from where it left the view.
 *
 * The arrow keys are the ones the `nudge` preset binds, so a canvas that
 * presents leaves `nudge` off. Where there are no pages the actions are
 * disabled and the keys fall through.
 */
export function createPresentationContribution(opts: PresentationOptions = {}): Contribution {
  return {
    id: PRESENTATION_ID,
    eligibility: { always: true },
    actions: [
      presentationAction(PRESENT_STEP_ACTION_ID, 'Step Pages', false, opts),
      presentationAction(PRESENT_GO_ACTION_ID, 'Go to Page', true, opts),
    ],
    ...(opts.keys === false ? {} : { bindings: keyBindings() }),
  };
}
