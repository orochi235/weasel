import { isApplePlatform, type KeyHeldSpec, type KeySpec, type ModSpec } from '@weasel-js/gestures';

/** Options for {@link captureKey}. */
export interface CaptureKeyOptions {
  /** Capture the held form, `key-held`, rather than the keystroke. */
  held?: boolean;
  /** Stop listening and resolve `null`. */
  signal?: AbortSignal;
  /** Whether Cmd is Mod. Defaults to the detected platform. */
  apple?: boolean;
}

const MODIFIER_KEYS: ReadonlySet<string> = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock']);

/**
 * The next keystroke on `target` as a key spec, for a binding editor: its
 * modifiers with the platform's primary one as `mod`. A bare modifier is
 * waited past; Escape, or an abort, resolves `null`. The keystroke it takes is
 * `preventDefault`ed and stopped, so nothing else acts on it. Write the result
 * with `keySpecRoute` to persist it as a binding override.
 */
export function captureKey(target: EventTarget, opts: CaptureKeyOptions = {}): Promise<KeySpec | KeyHeldSpec | null> {
  const apple = opts.apple ?? isApplePlatform();
  return new Promise((resolve) => {
    const done = (spec: KeySpec | KeyHeldSpec | null): void => {
      target.removeEventListener('keydown', onKey as EventListener, true);
      opts.signal?.removeEventListener('abort', onAbort);
      resolve(spec);
    };
    const onAbort = (): void => { done(null); };
    const onKey = (e: KeyboardEvent): void => {
      if (MODIFIER_KEYS.has(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) { done(null); return; }
      const mods: ModSpec = {};
      if (apple ? e.metaKey : e.ctrlKey) mods.mod = true;
      if (e.shiftKey) mods.shift = true;
      if (e.altKey) mods.alt = true;
      if (apple ? e.ctrlKey : e.metaKey) mods[apple ? 'ctrl' : 'meta'] = true;
      const kind = opts.held ? 'key-held' : 'key';
      done(Object.keys(mods).length > 0 ? { kind, key: e.key, mods } : { kind, key: e.key });
    };
    if (opts.signal?.aborted) { resolve(null); return; }
    opts.signal?.addEventListener('abort', onAbort);
    target.addEventListener('keydown', onKey as EventListener, true);
  });
}
