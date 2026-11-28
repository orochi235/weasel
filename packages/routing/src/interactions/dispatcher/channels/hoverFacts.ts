/**
 * What the hover channel reports: a `hover` for each move a binding hears, each naming what the last
 * one found under the pointer as its `from`, and the hover-off when the pointer leaves.
 */
import type { EventModifiers, HoverWhere } from '@weasel-js/gestures';
import type { DispatchCore } from '../dispatchCore';
import { underPointer, type UnderPointer } from '../underPointer';

export type Hover = EventModifiers & { clientX: number; clientY: number };

/** What a hover found under the pointer, and the view it was routed to. */
type Facts = { at: Hover; where: UnderPointer; view: string | null };

const whereOf = ({ affordance, bodyTarget, bodyKind }: UnderPointer): HoverWhere => ({
  ...(affordance !== undefined ? { affordance } : {}),
  ...(bodyTarget !== undefined ? { bodyTarget } : {}),
  ...(bodyKind !== undefined ? { bodyKind } : {}),
});

type Core = Pick<DispatchCore, 'toWorld' | 'target' | 'dispatch' | 'routedView' | 'setRoutedView'>;

export function hoverReports(core: Core, pointersHeld: () => number) {
  const { toWorld, target, dispatch } = core;
  let facts: Facts | null = null;
  /** Whether the pointer moved under a press no binding heard since `facts` were taken. */
  let stale = false;

  const factsAt = (at: Hover): Facts => ({ at, where: underPointer(target(), at, toWorld(at.clientX, at.clientY)), view: core.routedView() });

  return {
    /** What the last hover found under `at`, if it was taken there. */
    whereAt: (at: Hover): UnderPointer | undefined => (facts?.at === at ? facts.where : undefined),
    /** Report a hover at `at`. */
    hover(at: Hover): void {
      const next = factsAt(at);
      const w = toWorld(at.clientX, at.clientY);
      const from = facts ? { from: whereOf(facts.where) } : {};
      const held = pointersHeld() > 0 ? { held: true } : {};
      facts = next;
      stale = false;
      dispatch({ kind: 'hover', x: w.x, y: w.y, clientX: at.clientX, clientY: at.clientY, ...next.where, ...from, ...held });
    },
    /** The pointer moved under a press no binding hears. */
    unheard(): void { if (facts) stale = true; },
    /** The pointer let go at `at`: the next hover's `from` is there, not where it was pressed. */
    released(at: Hover): void {
      if (!stale) return;
      facts = factsAt(at);
      stale = false;
    },
    /** The pointer, last at `at`, left: report the hover-off to the view it last hovered in. */
    leave(at: Hover | null): void {
      const f = stale && at ? factsAt(at) : facts;
      facts = null;
      stale = false;
      if (!f) return;
      const routed = core.routedView();
      core.setRoutedView(f.view);
      try {
        const w = toWorld(f.at.clientX, f.at.clientY);
        dispatch({ kind: 'hover', off: true, x: w.x, y: w.y, clientX: f.at.clientX, clientY: f.at.clientY, ...f.where, from: whereOf(f.where) });
      } finally { core.setRoutedView(routed); }
    },
    forget(): void {
      facts = null;
      stale = false;
    },
  };
}
