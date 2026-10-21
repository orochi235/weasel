import type { KeyHeldSpec, KeySpec } from '@weasel-js/gestures';
import { captureGesture } from './captureGesture';

/** Options for {@link captureKey}. */
export interface CaptureKeyOptions {
  /** Capture the held form, `key-held`, rather than the keystroke. */
  held?: boolean;
  /** Stop listening and resolve `null`. */
  signal?: AbortSignal;
  /** Whether Cmd is Mod. Defaults to the detected platform. */
  apple?: boolean;
}

/**
 * The next keystroke on `target` as a key spec: {@link captureGesture} taking
 * a keystroke alone, and leaving the pointer to the page. A bare modifier is
 * waited past. Write the result with `keySpecRoute` to persist it as a binding
 * override.
 */
export function captureKey(target: EventTarget, opts: CaptureKeyOptions = {}): Promise<KeySpec | KeyHeldSpec | null> {
  return captureGesture(target, {
    kinds: [opts.held ? 'key-held' : 'key'],
    ...(opts.signal ? { signal: opts.signal } : {}),
    ...(opts.apple !== undefined ? { apple: opts.apple } : {}),
  }) as Promise<KeySpec | KeyHeldSpec | null>;
}
