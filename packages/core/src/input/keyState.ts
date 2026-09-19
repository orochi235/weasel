/**
 * Which physical keys are down right now — the poll a game loop or character
 * controller reads each step. This is raw input state, not routing: it sees
 * every key whether or not a binding claims it, and a binding claiming a key
 * does not hide it from here.
 */

import { isEditableTarget } from '@weasel-js/routing';

export interface KeyModifiers {
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
}

export interface KeyStateAttachOptions {
  /** Ignore presses whose target is an input, textarea or contenteditable
   *  element. Their releases are always taken. Default `true`. */
  skipInEditable?: boolean;
  /** `KeyboardEvent.code`s whose keydown and keyup have their default
   *  prevented — the keys a game owns, so Space and the arrows stop scrolling
   *  the page. */
  preventDefault?: readonly string[];
}

export interface KeyState {
  /** Whether any of these physical keys, by `KeyboardEvent.code`
   *  (`'KeyA'`, `'Space'`, `'ArrowLeft'`), is down. Codes name positions, so
   *  WASD stays in place on any layout. */
  isDown(code: string | readonly string[]): boolean;
  /** Whether a key down produced any of these `KeyboardEvent.key` values when
   *  it was pressed. Single characters compare case-insensitively. */
  isKeyDown(key: string | readonly string[]): boolean;
  /** Whether any of these codes was freshly pressed since it was last taken;
   *  clears them. Autorepeat is not a press. A press is taken once, so two
   *  readers of the same code see it once between them. */
  take(code: string | readonly string[]): boolean;
  /** Every code down. The set is live — copy it to keep it. */
  codes(): ReadonlySet<string>;
  modifiers(): KeyModifiers;
  /** Called on every change of what is down. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Mark everything up and drop untaken presses. */
  release(): void;
  /**
   * Listen on `target` — `window`, or an element whose subtree has focus.
   * Everything is released when the keyups can no longer arrive: the window
   * blurs, the document hides, focus leaves an element target, or Meta is
   * released (macOS delivers no keyup for a key released while Cmd is held).
   * Returns the detach, which also releases.
   */
  attach(target: Window | HTMLElement, options?: KeyStateAttachOptions): () => void;
}

const MODIFIER_CODES: Record<keyof KeyModifiers, readonly string[]> = {
  shift: ['ShiftLeft', 'ShiftRight'],
  ctrl: ['ControlLeft', 'ControlRight'],
  alt: ['AltLeft', 'AltRight'],
  meta: ['MetaLeft', 'MetaRight'],
};
const MODIFIER_SET = new Set(Object.values(MODIFIER_CODES).flat());

const fold = (key: string): string => (key.length === 1 ? key.toLowerCase() : key);
const list = (v: string | readonly string[]): readonly string[] => (typeof v === 'string' ? [v] : v);

export function createKeyState(): KeyState {
  // code → the folded key it produced when pressed
  const down = new Map<string, string>();
  const codeSet = new Set<string>();
  const presses = new Set<string>();
  const mods: KeyModifiers = { shift: false, ctrl: false, alt: false, meta: false };
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const l of [...listeners]) l();
  };

  const remove = (code: string): boolean => {
    codeSet.delete(code);
    return down.delete(code);
  };

  const release = () => {
    const changed = down.size > 0 || presses.size > 0 || mods.shift || mods.ctrl || mods.alt || mods.meta;
    down.clear();
    codeSet.clear();
    presses.clear();
    mods.shift = mods.ctrl = mods.alt = mods.meta = false;
    if (changed) notify();
  };

  // A modifier's keyup can land in another window (alt-tab, cmd-tab), so trust
  // the flags every event carries over the keys we saw go down.
  const reconcile = (e: KeyboardEvent): boolean => {
    let changed = false;
    const flags: KeyModifiers = { shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey, meta: e.metaKey };
    for (const m of Object.keys(MODIFIER_CODES) as Array<keyof KeyModifiers>) {
      if (mods[m] !== flags[m]) {
        mods[m] = flags[m];
        changed = true;
      }
      if (!flags[m]) for (const code of MODIFIER_CODES[m]) changed = remove(code) || changed;
    }
    return changed;
  };

  const state: KeyState = {
    isDown: (code) => list(code).some((c) => codeSet.has(c)),
    isKeyDown: (key) => {
      const want = new Set(list(key).map(fold));
      for (const k of down.values()) if (want.has(k)) return true;
      return false;
    },
    take: (code) => {
      let hit = false;
      for (const c of list(code)) hit = presses.delete(c) || hit;
      return hit;
    },
    codes: () => codeSet,
    modifiers: () => ({ ...mods }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    release,
    attach: (target, options = {}) => {
      const skipInEditable = options.skipInEditable ?? true;
      const owned = new Set(options.preventDefault ?? []);

      const onKeyDown = (event: Event) => {
        const e = event as KeyboardEvent;
        if (skipInEditable && isEditableTarget(e.target)) return;
        if (owned.has(e.code)) e.preventDefault();
        let changed = reconcile(e);
        if (!down.has(e.code)) {
          down.set(e.code, fold(e.key));
          codeSet.add(e.code);
          changed = true;
        }
        if (!e.repeat && !presses.has(e.code)) {
          presses.add(e.code);
          changed = true;
        }
        if (changed) notify();
      };

      const onKeyUp = (event: Event) => {
        const e = event as KeyboardEvent;
        if (owned.has(e.code)) e.preventDefault();
        let changed = reconcile(e);
        changed = remove(e.code) || changed;
        if (MODIFIER_CODES.meta.includes(e.code)) {
          for (const code of [...codeSet]) if (!MODIFIER_SET.has(code)) changed = remove(code) || changed;
        }
        if (changed) notify();
      };

      const onVisibility = () => {
        if (document.hidden) release();
      };

      const onFocusOut = (event: Event) => {
        const next = (event as FocusEvent).relatedTarget;
        if (!(next instanceof Node) || !(target as HTMLElement).contains(next)) release();
      };

      target.addEventListener('keydown', onKeyDown);
      target.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', release);
      document.addEventListener('visibilitychange', onVisibility);
      const isElement = target !== window;
      if (isElement) target.addEventListener('focusout', onFocusOut);

      return () => {
        target.removeEventListener('keydown', onKeyDown);
        target.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', release);
        document.removeEventListener('visibilitychange', onVisibility);
        if (isElement) target.removeEventListener('focusout', onFocusOut);
        release();
      };
    },
  };
  return state;
}
