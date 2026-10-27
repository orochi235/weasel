/**
 * The preview of an OS drag still in flight: while it hovers the canvas, the
 * action its drop would run shows what that would do, through `Action.preview`.
 * A dragover never invokes the action, so this is the only place it is asked.
 */
import { buildDepsFromRequires } from '../../actions/buildDeps';
import type { DispatcherContext, ResolveOnlyResult } from '../dispatcherApi';
import { immediateParams } from '../inputFacts';
import type { InputEvent } from '../matcher';

export interface DropPreview {
  /** Show `winner`'s preview of `event`, replacing what an earlier call showed.
   *  A repeat of the last call, which a stationary drag sends every few
   *  milliseconds, changes nothing. */
  show(event: Extract<InputEvent, { kind: 'drop' }>, winner: ResolveOnlyResult, ctx: DispatcherContext): void;
  /** Take the preview down. */
  end(): void;
}

function keyOf(event: Extract<InputEvent, { kind: 'drop' }>, winner: ResolveOnlyResult): string {
  const mods = [event.altKey, event.ctrlKey, event.metaKey, event.shiftKey].map(Number).join('');
  const mimes = event.items.map((it) => it.mime).join(',');
  return `${winner.actionId}|${event.x},${event.y}|${mods}|${mimes}`;
}

export function dropPreview(): DropPreview {
  let key: string | null = null;
  let stop: (() => void) | null = null;

  const end = () => {
    key = null;
    const s = stop;
    stop = null;
    if (!s) return;
    try {
      s();
    } catch (err) {
      console.error('weasel dispatcher: a drop preview threw as it ended', err);
    }
  };

  const show: DropPreview['show'] = (event, winner, ctx) => {
    const next = keyOf(event, winner);
    if (next === key) return;
    end();
    key = next;
    const { action } = winner;
    if (!action.preview) return;
    try {
      const out = action.preview(buildDepsFromRequires(action, ctx.depRegistry), immediateParams(event, winner.params));
      stop = typeof out === 'function' ? out : null;
    } catch (err) {
      console.error(`weasel dispatcher: preview of "${action.id}" threw`, err);
    }
  };

  return { show, end };
}
