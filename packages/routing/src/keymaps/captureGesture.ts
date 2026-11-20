import { isApplePlatform } from '@weasel-js/gestures';
import { capturePointer, guardRelease, type CaptureThresholds, type PointerCapture } from './capturePointer';
import { specOf, take, type CaptureKind, type CapturedSpec } from './captureSpec';

export type { CaptureKind, CapturedSpec } from './captureSpec';

/** Options for {@link captureGesture}. */
export interface CaptureGestureOptions extends CaptureThresholds {
  /** The kinds to take; input of any other kind is waited past. A keystroke
   *  is taken as `key` when both `key` and `keyHeld` are listed. Defaults to
   *  `key`, `click`, `doubleClick`, `drag` and `contextMenu`. */
  kinds?: readonly CaptureKind[];
  /** Stop listening and resolve `null`. */
  signal?: AbortSignal;
  /** Whether Cmd is Mod. Defaults to the detected platform. */
  apple?: boolean;
  /** Travel that makes a press a drag, in CSS px: pass the `gestures.dragPx`
   *  kit setting. Defaults to `DRAG_THRESHOLD_PX`. */
  dragPx?: number;
  /** The `gestures.doubleClickMs` kit setting. Defaults to `DOUBLE_CLICK_MAX_MS`. */
  doubleClickMs?: number;
  /** The `gestures.doubleClickPx` kit setting. Defaults to `DOUBLE_CLICK_MAX_PX`. */
  doubleClickPx?: number;
}

const DEFAULT_KINDS: readonly CaptureKind[] = ['key', 'click', 'doubleClick', 'drag', 'contextMenu'];
const POINTER_KINDS: readonly CaptureKind[] = ['click', 'doubleClick', 'drag', 'contextMenu'];
const MODIFIER_KEYS: ReadonlySet<string> = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock']);

/**
 * The next input on `target` of one of `opts.kinds`, as a gesture spec, for a
 * binding editor: its modifiers with the platform's primary one as `mod`. A
 * press is told a click or a drag by the dispatcher's own recognizer, at its
 * drag threshold, and a middle or secondary drag keeps its `button`; a click
 * is held back for a double click only when both are asked for, and a key
 * pressed meanwhile settles on it. A bare modifier key is waited past. Escape,
 * or an abort, resolves `null`. What it takes is `preventDefault`ed and
 * stopped, the click a browser follows a press with included, and the rest of
 * a press still held when it settles, so nothing else acts on it. The pointer
 * is left alone when no pointer kind is asked for, and keys other than Escape
 * when no key kind is.
 */
export function captureGesture(target: EventTarget, opts: CaptureGestureOptions = {}): Promise<CapturedSpec | null> {
  const apple = opts.apple ?? isApplePlatform();
  const kinds = new Set(opts.kinds ?? DEFAULT_KINDS);
  const keyKind = kinds.has('key') ? 'key' : kinds.has('keyHeld') ? 'keyHeld' : null;
  const pointer = POINTER_KINDS.some((k) => kinds.has(k));

  return new Promise((resolve) => {
    if (opts.signal?.aborted) { resolve(null); return; }
    let settled = false;
    let capture: PointerCapture | null = null;
    const listeners: [string, (e: Event) => void][] = [];
    const listen = (type: string, fn: (e: Event) => void): void => {
      listeners.push([type, fn]);
      target.addEventListener(type, fn, true);
    };

    const done = (spec: CapturedSpec | null): void => {
      if (settled) return;
      settled = true;
      const held = capture?.stop() ?? new Set<number>();
      opts.signal?.removeEventListener('abort', onAbort);
      for (const [type, fn] of listeners) target.removeEventListener(type, fn, true);
      if (pointer) guardRelease(target, held);
      resolve(spec);
    };
    const onAbort = (): void => { done(null); };

    opts.signal?.addEventListener('abort', onAbort);
    listen('keydown', (e) => {
      const k = e as KeyboardEvent;
      if (MODIFIER_KEYS.has(k.key)) return;
      const escape = k.key === 'Escape' && !k.metaKey && !k.ctrlKey && !k.altKey && !k.shiftKey;
      // A click waiting out the double-click window came first; the key is not the capture's.
      if (!escape && capture?.flush()) return;
      if (!escape && !keyKind) return;
      take(k);
      done(escape || !keyKind ? null : { ...specOf(keyKind, k, apple), key: k.key });
    });
    if (pointer) capture = capturePointer(target, kinds, apple, opts, listen, done);
  });
}
