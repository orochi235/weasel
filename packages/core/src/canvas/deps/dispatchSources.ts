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
     *  is or is not selected, with its routing kind. Sourced by `<SceneCanvas>`;
     *  absent when it has no selection or picker to classify with. */
    hitAt?: (world: { x: number; y: number }) => { bodyTarget: BodyTarget; bodyKind?: string };
    /** A node's routing kind (`'rect'`, `'text'`), as `kind:` targets read it.
     *  Sourced by `<SceneCanvas>`; absent under `routing={[]}`. */
    kindOfNode?: (id: string) => string | undefined;
  }
}

type Classify = (world: { x: number; y: number }) => BodyClassification;

/** The `hitAt` answer for one view: its own classifier's verdict on a point. */
export function hitAtOf(classifyTarget: Classify): NonNullable<DepSchema['hitAt']> {
  return (world) => {
    const c = classifyTarget(world);
    return { bodyTarget: c.body, bodyKind: c.kind };
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
