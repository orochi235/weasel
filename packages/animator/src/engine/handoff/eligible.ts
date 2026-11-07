import { bindingOf, COMPOSITOR_PROPERTIES, type ElementBinding } from '../../elementTarget';
import type { TargetState } from '../../target';
import type { CompositorMode } from '../../targetTypes';
import type { HandoffHost } from './handoffs';

/** What decides whether a call can be handed to the compositor. */
export interface Asking {
  compositor?: CompositorMode;
  onTick?: unknown;
  cancelKey?: string;
  interrupt?: boolean;
}

/** Why `o` on `s` must run on the main thread; null where it can go to the compositor once
 *  what holds its `cancelKey` is interrupted. */
export function refusal(host: HandoffHost, s: TargetState, o: Asking): string | null {
  const binding = bindingOf(s);
  if (!binding) return 'its target was not made by createElementTarget';
  if (typeof binding.element.animate !== 'function') return 'this environment has no Element.animate';
  if (o.onTick) return 'it has an onTick, which needs its value on the main thread every frame';
  if (s.row || s.held > 0 || s.beside) return 'a hold or a stopped animation still shows on its target';
  const interrupts = o.cancelKey != null && o.interrupt !== false;
  let mine = 0;
  for (const a of host.table.on(s)) {
    mine += 1;
    if (!interrupts || a.cancelKey !== o.cancelKey) return 'another animation is moving its target, and they add';
  }
  if ((s.live > 0 || s.handoff) && mine === 0) return 'another animator is moving its target';
  for (const key in binding.style(s.get())) {
    if (!COMPOSITOR_PROPERTIES.has(key)) return `its style sets \`${key}\`, which the compositor does not animate`;
  }
  return null;
}

/** `s`'s element, where `o` can be handed to the compositor; otherwise null, or with
 *  `compositor: 'require'` a throw saying why. */
export function eligible(host: HandoffHost, s: TargetState, o: Asking): ElementBinding | null {
  // Off unless asked for: the compositor is the slower path past a crossover the caller knows.
  if ((o.compositor ?? 'off') === 'off') return null;
  const why = refusal(host, s, o);
  if (why) return refuse(o, why);
  return bindingOf(s)!;
}

/** Null, or with `compositor: 'require'` a throw saying `why`. */
export function refuse(o: Asking, why: string): null {
  if (o.compositor === 'require') throw new Error(`animator: this animation cannot run on the compositor: ${why}`);
  return null;
}

/** Whether nothing but the new animation will move `s`, once the interrupt has run. */
export function free(host: HandoffHost, s: TargetState): boolean {
  for (const _ of host.table.on(s)) return false;
  return s.live === 0 && !s.handoff;
}
