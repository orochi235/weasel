/** Handing a drag off: what the dispatcher does when an in-flight drag's handle passes it on (`OngoingHandle.onMove`). */
import type { DispatcherContext } from './dispatcherApi';
import { endPassed, notePassed, pumpGesture, type GestureRun } from './gestureRun';
import type { InputEvent } from './matcher';
import { rank, walk, type Attempt } from './walk';

/** Offer the drag `event` moves, whose handle passed it, to the candidates its press had, less every action that
 *  passed it, and hand the taker `event`. Each pass skips one more action, so this ends. */
export function handOff(
  run: GestureRun,
  event: InputEvent,
  ctx: DispatcherContext,
  invoking: (event: InputEvent) => Attempt,
  engaged: () => ReadonlySet<string>,
): 'handled' {
  for (let passed = endPassed(run, event); passed !== null; passed = endPassed(run, event)) {
    const { event: press, skip } = passed;
    const invoke = invoking(press);
    walk(rank(press, ctx, engaged(), false), press, ctx, (match, action, deps) => (
      skip.has(action.id) ? 'empty-handle' : invoke(match, action, deps)
    ), false);
    notePassed(run, event, skip);
    if (pumpGesture(run, event) !== 'pass') break;
  }
  return 'handled';
}
