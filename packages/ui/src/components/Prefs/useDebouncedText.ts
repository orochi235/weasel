import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Live text held locally between debounced commits, so typing into a control that writes as it changes does
 * not write on every keystroke; `PARAMS_TEXT_WAIT_MS` says how long each surface waits. Locally controlled
 * between commits, which means it has to notice the value changing underneath it.
 */
export function useDebouncedText(
  value: string,
  write: (value: string) => void,
  debounceMs: number,
): { local: string; type: (next: string) => void } {
  const [local, setLocal] = useState(value);
  const lastExternal = useRef(value);
  // The text typed since the last write, and the timer that will write it.
  const pending = useRef<{ text: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const latestWrite = useRef(write);
  useEffect(() => {
    latestWrite.current = write;
  });

  const settle = useCallback((commit: boolean): void => {
    const waiting = pending.current;
    if (waiting === null) return;
    pending.current = null;
    clearTimeout(waiting.timer);
    if (!commit) return;
    lastExternal.current = waiting.text;
    latestWrite.current(waiting.text);
  }, []);

  useEffect(() => {
    if (value !== lastExternal.current) {
      // Replaced from outside (a reset): text still waiting would overwrite it.
      settle(false);
      lastExternal.current = value;
      setLocal(value);
    }
  }, [value, settle]);

  // A row that unmounts inside the debounce window (a closing popover, a tab
  // switch) still owes its last keystrokes.
  useEffect(() => () => settle(true), [settle]);

  return {
    local,
    type: (next) => {
      setLocal(next);
      settle(false);
      pending.current = { text: next, timer: setTimeout(() => settle(true), debounceMs) };
      if (debounceMs === 0) settle(true);
    },
  };
}
