/** Builds the `InvocationCtx` an action's invoker is handed for one event. */
import type { ActionDeps, AffordanceHit, InvocationCtx, Point2 } from '../actions/invoker';
import { resolveRoles } from '../actions/modifierRoles';
import type { GestureFacts } from './gestureFacts';
import type { InputEvent } from './matcher';

/** A context for an invocation no pointer event drives, where world and
 *  screen coordinates mean nothing: a UI-driven handle, or a cancel-all. */
export function uiInvocationCtx(deps: ActionDeps, params?: Record<string, unknown>): InvocationCtx {
  return {
    world: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps,
    ...(params !== undefined ? { params } : {}),
  };
}

// The pointer in client pixels, where the event carries it. Not every kind
// does, which is why `ctx.screen` is optional.
function clientPoint(ev: InputEvent): Point2 | undefined {
  const cx = (ev as { clientX?: number }).clientX;
  const cy = (ev as { clientY?: number }).clientY;
  return cx !== undefined && cy !== undefined ? { x: cx, y: cy } : undefined;
}

function pressDrag(
  event: InputEvent & { kind: 'pointerdown' | 'click' | 'doubleclick' | 'contextmenu' },
): Pick<InvocationCtx, 'world' | 'drag'> {
  // A click's own world point is `x`/`y` — the release — with the press
  // as the fallback for a consumer that wired neither.
  const sx = event.x ?? (event.kind === 'click' ? event.pressX : undefined) ?? 0;
  const sy = event.y ?? (event.kind === 'click' ? event.pressY : undefined) ?? 0;
  const affordance = event.kind === 'pointerdown' ? (event.affordance as AffordanceHit | undefined) : undefined;
  return {
    world: { x: sx, y: sy },
    drag: {
      start: { x: sx, y: sy },
      current: { x: sx, y: sy },
      delta: { x: 0, y: 0 },
      ...(affordance !== undefined ? { affordance } : {}),
    },
  };
}

function pumpDrag(
  event: InputEvent & { kind: 'pointermove' | 'pointerup' },
  facts: GestureFacts,
): Pick<InvocationCtx, 'world' | 'drag'> {
  const cx = event.x;
  const cy = event.y;
  const origin = facts.origin;
  const ox = origin?.x ?? cx;
  const oy = origin?.y ?? cy;
  // Live accumulator during the drag — copying it on every move would be
  // quadratic — but a snapshot on the last event, because `onEnd` is where
  // an action is entitled to keep the trail, and the dispatcher clears the
  // accumulator the moment it returns.
  const live = facts.points;
  const points = live && event.kind === 'pointerup' ? [...live] : live;
  // Screen-space delta — populated when both the event and origin carry
  // client coords. View-mutating drag actions must read this rather than
  // the world `delta` (world deltas are self-referential mid-pan).
  const eventClientX = event.clientX;
  const eventClientY = event.clientY;
  const hasClient =
    eventClientX !== undefined && eventClientY !== undefined
    && origin?.clientX !== undefined && origin?.clientY !== undefined;
  return {
    world: { x: cx, y: cy },
    drag: {
      start: { x: ox, y: oy },
      current: { x: cx, y: cy },
      delta: { x: cx - ox, y: cy - oy },
      ...(hasClient
        ? { screenDelta: { x: eventClientX! - origin!.clientX!, y: eventClientY! - origin!.clientY! } }
        : {}),
      ...(points !== undefined ? { points } : {}),
    },
  };
}

function multiTouchOf(
  event: InputEvent & { kind: 'multitouch' },
  facts: GestureFacts,
): NonNullable<InvocationCtx['multiTouch']> {
  const centroid = event.centroid ?? { x: 0, y: 0 };
  const spread = event.spread ?? 1;
  const { startSpread } = facts;
  return {
    centroid,
    spread,
    rotation: facts.rotation ?? 0,
    // Pinch geometry, on a move of a running gesture.
    ...(startSpread !== undefined && event.spread !== undefined
      ? { pinch: { startSpread, currentSpread: spread, centroid } }
      : {}),
  };
}

/**
 * The context for `event`. `viewId` is the view the input landed in, left
 * off when `undefined`; `facts` are what the dispatcher remembers of the
 * gesture the event belongs to.
 */
export function buildInvocationCtx(
  event: InputEvent,
  deps: ActionDeps,
  viewId: string | null | undefined,
  facts: GestureFacts = {},
): InvocationCtx {
  const base: InvocationCtx = {
    world: { x: 0, y: 0 },
    modifiers: { alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey },
    deps,
    ...(viewId !== undefined ? { viewId } : {}),
  };
  const screen = clientPoint(event);
  if (screen) base.screen = screen;
  // `'mod'` was resolved when the gesture began, so the platform is moot here.
  if (facts.roleKeys) base.roles = resolveRoles(facts.roleKeys, base.modifiers, false);

  if (event.kind === 'key') {
    base.key = { key: event.key, repeat: event.repeat ?? false };
  } else if (event.kind === 'key-held') {
    base.key = { key: event.key, repeat: false };
  } else if (event.kind === 'wheel') {
    base.wheel = { deltaX: event.deltaX, deltaY: event.deltaY, deltaZ: 0 };
  } else if (event.kind === 'pinch') {
    base.pinch = { scale: event.scale, rotation: event.rotation };
  } else if (
    event.kind === 'pointerdown'
    || event.kind === 'click'
    || event.kind === 'doubleclick'
    || event.kind === 'contextmenu'
  ) {
    Object.assign(base, pressDrag(event));
  } else if (event.kind === 'pointermove' || event.kind === 'pointerup') {
    Object.assign(base, pumpDrag(event, facts));
  } else if (event.kind === 'multitouch') {
    base.multiTouch = multiTouchOf(event, facts);
  }
  return base;
}
