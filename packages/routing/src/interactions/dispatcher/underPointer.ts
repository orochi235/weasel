import type { BodyKind, BodyTarget, DoubleClickBody, EventModifiers } from '@weasel-js/gestures';
import type { AffordanceHit } from '../actions/invoker';
import type { DispatcherViewTarget } from './gestureDispatcherOptions';

/** The modifiers held and what sits under the pointer, as a pointer event carries them. */
export type UnderPointer = EventModifiers & {
  affordance?: AffordanceHit;
  bodyTarget?: BodyTarget;
  bodyKind?: BodyKind;
  doubleClickBody?: DoubleClickBody;
};

/** Hit-test `view` at the world point `w`, for a pointer holding `mods`. */
export function underPointer(view: DispatcherViewTarget, mods: EventModifiers, w: { x: number; y: number }): UnderPointer {
  const affordance = view.affordanceAt?.(w) ?? undefined;
  const body = view.classifyTarget?.(w);
  return {
    altKey: mods.altKey, ctrlKey: mods.ctrlKey, metaKey: mods.metaKey, shiftKey: mods.shiftKey,
    ...(affordance !== undefined ? { affordance } : {}),
    ...(body?.body !== undefined ? { bodyTarget: body.body } : {}),
    ...(body?.kind !== undefined ? { bodyKind: body.kind } : {}),
    ...(body?.doubleClick !== undefined ? { doubleClickBody: doubleClickBodyOf(body.doubleClick) } : {}),
  };
}

function doubleClickBodyOf(named: { body: BodyTarget; kind?: BodyKind }): DoubleClickBody {
  return { bodyTarget: named.body, ...(named.kind !== undefined ? { bodyKind: named.kind } : {}) };
}
