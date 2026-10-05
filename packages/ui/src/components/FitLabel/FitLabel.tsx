import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { flushSync } from 'react-dom';

/**
 * A label's forms, longest first: the canonical name, then each shorter form a
 * surface may fall back to. `name` stays the control's accessible name whichever
 * form is shown.
 */
export function labelForms(name: ReactNode, short?: readonly ReactNode[]): readonly ReactNode[] {
  const head = name === undefined || name === null || name === '' ? [] : [name];
  return short === undefined ? head : [...head, ...short];
}

/** What a {@link FitScope} tells the labels inside it. */
export interface FitScopeValue {
  /** How many forms down every label in the scope steps. */
  readonly step: number;
  /** Counts a label holding `depth` forms toward the scope; returns its release. */
  readonly register: (depth: number) => () => void;
}

const FitContext = createContext<FitScopeValue | null>(null);

/** Hands a {@link useFitScope} result to the {@link FitLabel}s beneath it. */
export function FitScope({ value, children }: { value: FitScopeValue; children?: ReactNode }) {
  return <FitContext.Provider value={value}>{children}</FitContext.Provider>;
}

const overflows = (el: Element | null): boolean => el !== null && el.scrollWidth > el.clientWidth;

/**
 * Fits the {@link FitLabel}s under `ref` to the room they are given.
 *
 * Every label steps down together, one form at a time, until neither `ref`'s
 * element nor its parent overflows or no label has a shorter form left: the
 * element overflowing itself is a control squeezed below its content, and its
 * parent overflowing is one that will not shrink at all. Each label takes its
 * form at the step, or its last where it has fewer. The room growing past the
 * size it had when a step was taken starts again from the full forms.
 *
 * A scope nested in another steps at least as far as the outer one, so a
 * control inside a strip shortens along with the strip.
 */
export function useFitScope(ref: RefObject<HTMLElement | null>): FitScopeValue {
  const outer = useContext(FitContext);
  const [own, setOwn] = useState(0);
  const [labels, setLabels] = useState<readonly number[]>([]);
  const counted = useRef(new Map<symbol, number>());
  // Room sizes when the last step was taken: growing past them retries the
  // full forms, while the shrink a step itself causes does not.
  const steppedAt = useRef<{ self: number; parent: number } | null>(null);

  const depth = labels.reduce((max, d) => Math.max(max, d), 0);
  const outerRegister = outer?.register;
  const register = useCallback(
    (labelDepth: number) => {
      const id = Symbol('fit-label');
      counted.current.set(id, labelDepth);
      setLabels([...counted.current.values()]);
      const releaseOuter = outerRegister?.(labelDepth);
      return () => {
        counted.current.delete(id);
        setLabels([...counted.current.values()]);
        releaseOuter?.();
      };
    },
    [outerRegister],
  );

  const ownRef = useRef(own);
  useLayoutEffect(() => {
    ownRef.current = own;
  }, [own]);
  /** Whether the room overflows and a label has a shorter form left; records the room if so. */
  const shouldStep = useCallback((): boolean => {
    const el = ref.current;
    if (!el || ownRef.current >= depth - 1) return false;
    const parent = el.parentElement;
    if (!overflows(el) && !overflows(parent)) return false;
    steppedAt.current = { self: el.clientWidth, parent: parent?.clientWidth ?? 0 };
    return true;
  }, [ref, depth]);

  // A label set that changed may fit at a longer form than the old one did.
  const fittedFor = useRef(labels);
  useLayoutEffect(() => {
    if (fittedFor.current !== labels) {
      fittedFor.current = labels;
      steppedAt.current = null;
      if (own !== 0) {
        setOwn(0);
        return;
      }
    }
    if (shouldStep()) setOwn(own + 1);
  }, [labels, own, shouldStep]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || depth < 2 || typeof ResizeObserver === 'undefined') return;
    const parent = el.parentElement;
    const observer = new ResizeObserver(() => {
      const at = steppedAt.current;
      const grew =
        at !== null &&
        (el.clientWidth > at.self + 0.5 || (parent !== null && parent.clientWidth > at.parent + 0.5));
      if (grew) {
        steppedAt.current = null;
        flushSync(() => setOwn(0));
      } else if (shouldStep()) {
        flushSync(() => setOwn((s) => s + 1));
      }
    });
    observer.observe(el);
    if (parent) observer.observe(parent);
    return () => observer.disconnect();
  }, [ref, depth, shouldStep]);

  const step = Math.max(own, outer?.step ?? 0);
  return useMemo(() => ({ step, register }), [step, register]);
}

/**
 * One label that shortens to fit: the form at the enclosing {@link FitScope}'s
 * step, or its last where it has fewer. Outside any scope it shows the first.
 */
export function FitLabel({ forms }: { forms: readonly ReactNode[] }) {
  const scope = useContext(FitContext);
  const register = scope?.register;
  const depth = forms.length;
  useLayoutEffect(() => register?.(depth), [register, depth]);
  const step = scope?.step ?? 0;
  return <>{forms[Math.min(step, depth - 1)]}</>;
}
