import { useEffect, useState } from 'react';

const MODIFIER_CODE = /^(Shift|Control|Alt|Meta)(Left|Right)$/;

/**
 * The `KeyboardEvent.code`s of the keys held down on `target` (the window by default), for a
 * `KeyDiagram`'s `held`. Losing focus lets go of every key, since their key-ups go elsewhere.
 */
export function useHeldKeys(target?: EventTarget | null): ReadonlySet<string> {
  const [held, setHeld] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    const on = target === undefined ? (typeof window === 'undefined' ? null : window) : target;
    if (!on) return;
    const down = (e: Event) => {
      const { code, repeat } = e as KeyboardEvent;
      if (repeat || !code) return;
      setHeld((prev) => (prev.has(code) ? prev : new Set(prev).add(code)));
    };
    const up = (e: Event) => {
      const { code } = e as KeyboardEvent;
      setHeld((prev) => {
        if (!prev.has(code)) return prev;
        const next = new Set(prev);
        next.delete(code);
        // macOS sends no key-up for a key released while Command is down, so letting go of Command
        // lets go of everything but the other modifiers.
        if (code.startsWith('Meta')) for (const c of prev) if (!MODIFIER_CODE.test(c)) next.delete(c);
        return next;
      });
    };
    const clear = () => setHeld((prev) => (prev.size === 0 ? prev : new Set()));
    on.addEventListener('keydown', down);
    on.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      on.removeEventListener('keydown', down);
      on.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      clear();
    };
  }, [target]);
  return held;
}
