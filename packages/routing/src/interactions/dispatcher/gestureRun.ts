/**
 * Running a gesture's ongoing handle: starting it for the candidate the walk
 * chose, feeding it the events that continue it, and ending it.
 */
import type { Action } from '../actions/action';
import type { ActionDeps, DragSample, InvocationCtx, OngoingHandle } from '../actions/invoker';
import { resolveParams } from '../actions/invoker';
import { platformRoleKeys, roleKeysOf } from '../actions/modifierRoles';
import type { DispatcherContext, KeyReach } from './dispatcherApi';
import type { GestureFactsStore } from './gestureFacts';
import { gestureIdFor, isMultiTouchGestureId } from './gestureIds';
import { isEmptyOngoingHandle, type InFlightGestures } from './inFlightGestures';
import { immediateParams } from './inputFacts';
import { deferredStart } from './deferredStart';
import { buildInvocationCtx, uiInvocationCtx } from './invocationCtx';
import type { InputEvent, MatchResult } from './matcher';
import type { AttemptResult } from './walk';

/** What one dispatcher's gestures run against. */
export interface GestureRun {
  inFlight: InFlightGestures;
  facts: GestureFactsStore;
  /** The view the input being handled landed in, so a pump of an in-flight
   *  gesture reports the view it is pinned to. */
  viewId(): string | null | undefined;
  /** Whether `'mod'` is Cmd, for the input being handled. */
  isMac(): boolean;
  /** The host's client-to-surface mapping, for the input being handled. */
  toLocal(): DispatcherContext['toLocal'];
  /** Each pointer drag in flight: the press that opened it, the action running it, and those that passed it on. */
  opened: Map<string, Opened>;
}

/** A pointer drag's press, its action, and the actions that handed it off. */
export interface Opened {
  event: InputEvent;
  action: string;
  passed: ReadonlySet<string>;
}

type Reason = 'commit' | 'cancel';
type Outcome = 'handled' | 'unhandled';
/** `'pass'`: the drag's handle handed it off (`OngoingHandle.onMove`), and the dispatcher must offer it on. */
export type Pumped = Outcome | 'pass';

const ctxFor = (run: GestureRun, event: InputEvent, deps: ActionDeps, gestureId: string): InvocationCtx =>
  buildInvocationCtx(event, deps, run.viewId(), run.facts.of(gestureId), run.toLocal());

function runOnEnd(gestureId: string, handle: OngoingHandle, endCtx: InvocationCtx, reason: Reason): void {
  try {
    handle.onEnd?.(endCtx, reason);
  } catch (err) {
    console.error(`weasel dispatcher: gesture "${gestureId}" threw on onEnd`, err);
  }
}

/** End one in-flight gesture. It is out of flight before its `onEnd` runs,
 *  so an `onEnd` that throws, or that reads the dispatcher, sees it gone. */
function endGesture(run: GestureRun, gestureId: string, event: InputEvent, reason: Reason): boolean {
  if (!run.inFlight.handles.has(gestureId)) return false;
  const endCtx = ctxFor(run, event, {}, gestureId);
  const handle = run.inFlight.take(gestureId)!;
  run.facts.drop(gestureId);
  run.opened.delete(gestureId);
  runOnEnd(gestureId, handle, endCtx, reason);
  return true;
}

/** A drag ended by a pass: the press that opened it, every action not to offer it to, and the trail it had drawn. */
export interface Passed {
  event: InputEvent;
  skip: Set<string>;
  trail: readonly DragSample[];
}

/** End a drag whose handle passed it. */
export function endPassed(run: GestureRun, event: InputEvent): Passed | null {
  const gestureId = gestureIdFor(event);
  const opened = run.opened.get(gestureId);
  if (opened === undefined) return null;
  // A copy: the passing handle's `onEnd` may keep the live trail it is handed.
  const trail = [...(run.facts.of(gestureId).points ?? [])];
  endGesture(run, gestureId, event, 'cancel');
  return { event: opened.event, skip: new Set([...opened.passed, opened.action]), trail };
}

/** If the drag `event` belongs to was taken, mark it never to go back to `passed.skip` and give it the trail drawn
 *  before `event`, which the taker is handed next and samples itself. */
export function notePassed(run: GestureRun, event: InputEvent, passed: Passed): void {
  const gestureId = gestureIdFor(event);
  const opened = run.opened.get(gestureId);
  if (opened === undefined) return;
  opened.passed = new Set([...opened.passed, ...passed.skip]);
  run.facts.resumeTrail(gestureId, passed.trail.slice(0, -1));
}

function endMultiTouch(run: GestureRun, event: InputEvent, reason: Reason, except?: string): boolean {
  let ended = false;
  for (const id of [...run.inFlight.handles.keys()]) {
    if (isMultiTouchGestureId(id) && id !== except) ended = endGesture(run, id, event, reason) || ended;
  }
  return ended;
}

/** End every gesture in flight, with a context that carries no event. */
export function endAllGestures(run: GestureRun, reason: Reason): void {
  const stubCtx = uiInvocationCtx({});
  const ending = run.inFlight.takeAll();
  run.facts.clear();
  run.opened.clear();
  for (const [gestureId, handle] of ending) runOnEnd(gestureId, handle, stubCtx, reason);
}

/**
 * Feed `event` to the gesture it continues. `undefined` when it continues
 * none and may start one. A key's release that carries `reach` ends only a
 * gesture whose binding that reach covers, as its press would have started one.
 */
export function pumpGesture(run: GestureRun, event: InputEvent, reach?: KeyReach): Pumped | undefined {
  const { inFlight } = run;
  const ended = (reason: Reason): Outcome =>
    (endGesture(run, gestureIdFor(event), event, reason) ? 'handled' : 'unhandled');

  if (event.kind === 'key-held' && event.phase === 'up') {
    if (reach !== undefined && !(inFlight.openedOver(gestureIdFor(event)) ? reach.over : reach.held)) return 'unhandled';
    return ended('commit');
  }

  // A key-held DOWN for an already-engaged key is a no-op. Autorepeat
  // keydowns would otherwise fire `start()` again — each start pushes an
  // offhand hotkey, only one keyup ever fires onEnd, so the stack would leak.
  if (event.kind === 'key-held' && event.phase === 'down') {
    return inFlight.handles.has(gestureIdFor(event)) ? 'handled' : undefined;
  }

  if (event.kind === 'pointermove') {
    const gestureId = gestureIdFor(event);
    const handle = inFlight.handles.get(gestureId);
    if (!handle) return 'unhandled';
    run.facts.sample(gestureId, event);
    if (!handle.onMove) return 'unhandled';
    const said = handle.onMove(ctxFor(run, event, {}, gestureId));
    return said === 'pass' && run.opened.has(gestureId) ? 'pass' : 'handled';
  }

  // A wheel continues no gesture of its own, but one in flight may claim it.
  // The newest first, as with the cursor.
  if (event.kind === 'wheel') {
    for (const [gestureId, handle] of [...inFlight.handles].reverse()) {
      if (handle.onWheel?.(ctxFor(run, event, {}, gestureId)) === true) return 'handled';
    }
    return undefined;
  }

  if (event.kind === 'carry') return pumpCarry(run, event);

  if (event.kind === 'pointerup') return ended('commit');
  if (event.kind === 'pointercancel') return ended('cancel');

  // The id carries the finger count the gesture opened with, which the hand
  // has just left, so a multitouch gesture ends by prefix.
  if (event.kind === 'multitouch' && event.end !== undefined) {
    return endMultiTouch(run, event, event.end) ? 'handled' : 'unhandled';
  }

  if (event.kind === 'multitouch' && event.centroid !== undefined) {
    const gestureId = gestureIdFor(event);
    const handle = inFlight.handles.get(gestureId);
    if (handle?.onMove) {
      run.facts.turn(gestureId, event);
      handle.onMove(ctxFor(run, event, {}, gestureId));
      return 'handled';
    }
    // A hand is doing one multitouch gesture at a time, but the gesture id
    // carries the finger count — so a finger landing mid-gesture names a
    // different one, and the handle the hand has left is canceled here. (A
    // finger lifting arrives as an `end` event, above.)
    endMultiTouch(run, event, 'cancel', gestureId);
    // With no handle in flight, the first multitouch event can start one.
  }
  return undefined;
}

/** A carry's moves, release and leave go to the handle it started. A move or
 *  a release with none in flight may still be taken by the walk. */
function pumpCarry(run: GestureRun, event: InputEvent & { kind: 'carry' }): Outcome | undefined {
  if (event.stage === 'enter') return undefined;
  const gestureId = gestureIdFor(event);
  const handle = run.inFlight.handles.get(gestureId);
  if (!handle) return event.stage === 'leave' ? 'unhandled' : undefined;
  if (event.stage === 'move') {
    handle.onMove?.(ctxFor(run, event, {}, gestureId));
    return 'handled';
  }
  return endGesture(run, gestureId, event, event.stage === 'drop' ? 'commit' : 'cancel') ? 'handled' : 'unhandled';
}

/** Whether a carry's stage is one an action of this timing runs at: an
 *  ongoing action starts as the carry comes over or moves onto its target,
 *  an immediate one fires on the release. */
function carryStageFits(event: InputEvent, timing: 'immediate' | 'ongoing'): boolean {
  if (event.kind !== 'carry') return true;
  return timing === 'immediate' ? event.stage === 'drop' : event.stage === 'enter' || event.stage === 'move';
}

/** Run the candidate the walk chose. */
export function invokeAction(
  run: GestureRun,
  event: InputEvent,
  match: MatchResult,
  action: Action,
  deps: ActionDeps,
): AttemptResult {
  if (action.invoker && !carryStageFits(event, action.invoker.timing)) return 'empty-handle';

  if (action.invoker?.timing === 'immediate') {
    try {
      const params = immediateParams(event, resolveParams(match.binding.opts?.params));
      if (action.invoker.run(deps, params) === 'pass') return 'empty-handle';
    } catch (err) {
      console.error(`weasel dispatcher: action "${action.id}" invoker threw`, err);
    }
    return 'fired';
  }

  if (action.invoker?.timing === 'ongoing') {
    // A `pointerDown` binding fires at press time, on the same
    // `pointer-<id>` gesture id the drag will use. Letting an ongoing
    // action open its handle here would make the drag's own dispatch find
    // a handle already in flight and silently no-op.
    if (event.kind === 'hover' || (event.kind === 'pointerdown' && event.stage === 'press')) {
      const spec = event.kind === 'hover' ? 'hover spec, which has no press to own' : 'pointerDown spec, which fires at press time';
      console.error(
        `weasel dispatcher: action "${action.id}" has an ongoing invoker but is bound to a `
        + `${spec}. Bind it to a drag spec, or give the action an immediate invoker.`,
      );
      return 'misbound';
    }
    const gestureId = gestureIdFor(event);
    const roleKeys = roleKeysOf(action.modifierRoles, match.binding.opts?.roles);
    run.facts.begin(gestureId, event, roleKeys && platformRoleKeys(roleKeys, run.isMac()));
    const { invoker } = action;
    const pressCtx = ctxFor(run, event, deps, gestureId);
    const begin = () => invoker.start(pressCtx, match.binding.opts);
    const threshold = match.binding.opts?.dragThresholdPx ?? invoker.dragThresholdPx;
    const handle = event.kind === 'pointerdown' && threshold !== undefined && threshold > 0
      ? deferredStart(begin, threshold)
      : begin();
    // Empty handle = "matched at the binding level but decided at runtime
    // not to handle this gesture" (missing dep, wrong affordance, wrong
    // selection kind, etc.). The widely-used early-return-empty pattern
    // depends on the dispatcher falling through to the next match —
    // otherwise the binding silently swallows the gesture.
    if (isEmptyOngoingHandle(handle)) {
      // A later match, still on the same event, starts from a fresh slate.
      run.facts.drop(gestureId);
      return 'empty-handle';
    }
    run.inFlight.open(gestureId, handle, match.ownerId, action, match.binding.opts?.over === true);
    if (event.kind === 'pointerdown') run.opened.set(gestureId, { event, action: action.id, passed: new Set() });
    return 'fired';
  }

  // No invoker — action is registered but has nothing to do for this
  // matched binding. Treat as handled (the binding consumed the gesture
  // and the no-op is intentional) to keep dispatch deterministic.
  return 'fired';
}
