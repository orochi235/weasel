/**
 * `useDispatchDepSources` — the deps that carry what the gesture dispatcher
 * knows about a press: the pending `longPress`, `hitAt`, its classification of
 * a world point, and `kindOfNode`, the routing kind behind it. An action that
 * must agree with the dispatcher about what is under a point reads these, not
 * a picker of its own.
 */
import type { BodyClassification, BodyTarget } from '@weasel-js/gestures';
import type { DepSchema, LongPressState } from '@weasel-js/routing';
import { useDepSource } from '@weasel-js/routing/react';

declare module '@weasel-js/routing' {
  interface DepSchema {
    /** What the dispatcher classifies a world point as: empty, or a body that
     *  is or is not selected, with its routing kind and id, and `doubleClick`,
     *  the same for the node a double-click there names where that is another
     *  (a hit member's group). Sourced by `<SceneCanvas>`; absent when it has
     *  no selection or picker to classify with. */
    hitAt?: (world: { x: number; y: number }) => HitAt & { doubleClick?: HitAt };
    /** A node's routing kind (`'rect'`, `'text'`), as `kind:` targets read it.
     *  Sourced by `<SceneCanvas>`; absent under `routing={[]}`. */
    kindOfNode?: (id: string) => string | undefined;
  }
}

/** One classified body, as `hitAt` reports it. */
export interface HitAt { bodyTarget: BodyTarget; bodyKind?: string; id?: string }

type Classify = (world: { x: number; y: number }) => BodyClassification;

const hitOf = (c: { body: BodyTarget; kind?: string; id?: string }): HitAt =>
  ({ bodyTarget: c.body, bodyKind: c.kind, ...(c.id !== undefined ? { id: c.id } : {}) });

/** The `hitAt` answer for one view: its own classifier's verdict on a point. */
export function hitAtOf(classifyTarget: Classify): NonNullable<DepSchema['hitAt']> {
  return (world) => {
    const c = classifyTarget(world);
    return { ...hitOf(c), ...(c.doubleClick ? { doubleClick: hitOf(c.doubleClick) } : {}) };
  };
}

export function useDispatchDepSources(
  longPress: LongPressState,
  classifyTarget: Classify | undefined,
  kindOfNode: { readonly current: ((id: string) => string | undefined) | undefined },
): void {
  useDepSource('longPress', () => longPress);
  useDepSource('hitAt', () => classifyTarget && hitAtOf(classifyTarget));
  useDepSource('kindOfNode', () => (id) => kindOfNode.current?.(id));
}
