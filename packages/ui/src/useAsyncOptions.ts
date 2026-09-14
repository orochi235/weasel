import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComboBoxOption } from './components/ComboBox/ComboBox';

type Key = string | number;

/** An option list keyed to the value type its combo box commits. */
export type AsyncOption<T extends Key> = ComboBoxOption & { value: T };

/** Options for {@link useAsyncOptions}. */
export type UseAsyncOptionsProps<T extends Key> = {
  /**
   * Fetches the options for a query. The signal aborts when a later keystroke
   * supersedes this call, so a `fetch` should forward it.
   */
  load: (query: string, signal: AbortSignal) => Promise<ReadonlyArray<AsyncOption<T>>>;
  /** Quiet period before a query is sent. */
  debounceMs?: number;
  /** Shorter queries are not sent, and empty the options. */
  minLength?: number;
};

/** What {@link useAsyncOptions} returns, shaped to spread into a `ComboBox`. */
export type AsyncOptionsResult<T extends Key> = {
  options: ReadonlyArray<AsyncOption<T>>;
  isLoading: boolean;
  loadError: unknown | null;
  inputValue: string;
  onInputChange: (next: string) => void;
};

/**
 * Drives a combo box whose options come from a server: debounces the query,
 * discards responses overtaken by a later one, and reports a failed load
 * separately from an empty result.
 *
 * `options` holds the last *resolved* list and is never emptied to mean
 * "working", so the previous results stay on screen — and stay arrowable —
 * while the next request is in flight.
 */
export function useAsyncOptions<T extends Key = string>({
  load,
  debounceMs = 150,
  minLength = 0,
}: UseAsyncOptionsProps<T>): AsyncOptionsResult<T> {
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<ReadonlyArray<AsyncOption<T>>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<unknown | null>(null);

  // Read through a ref: a consumer passing an inline arrow re-creates `load`
  // every render, and depending on it directly would refire the request.
  const loadRef = useRef(load);
  loadRef.current = load;

  // A monotonic id per request, and the highest one whose result has been
  // applied. A liveness flag cannot do this job: two requests from adjacent
  // keystrokes are both live, so the slower one overwrites the newer result
  // if it lands second.
  const issued = useRef(0);
  const applied = useRef(0);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    if (inputValue.length < minLength) {
      inFlight.current?.abort();
      inFlight.current = null;
      applied.current = issued.current;
      setOptions([]);
      setIsLoading(false);
      setLoadError(null);
      return;
    }

    const timer = setTimeout(() => {
      const mine = ++issued.current;
      const controller = new AbortController();
      inFlight.current?.abort();
      inFlight.current = controller;
      setIsLoading(true);

      loadRef.current(inputValue, controller.signal).then(
        (next) => {
          if (mine <= applied.current) return;
          applied.current = mine;
          setOptions(next);
          setLoadError(null);
          setIsLoading(false);
        },
        (error: unknown) => {
          if (controller.signal.aborted || mine <= applied.current) return;
          applied.current = mine;
          setLoadError(error);
          setIsLoading(false);
        },
      );
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [inputValue, debounceMs, minLength]);

  useEffect(() => () => inFlight.current?.abort(), []);

  const onInputChange = useCallback((next: string) => setInputValue(next), []);

  return { options, isLoading, loadError, inputValue, onInputChange };
}
