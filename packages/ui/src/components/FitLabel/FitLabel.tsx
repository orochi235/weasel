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
import { useScaleStage, type FitScale, type FitScaleOptions } from './fitScale';
import { prepareRoom, settleSpent, type FitRoom } from './fitRoom';

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
  /** The scale stage of the nearest scope that runs one, or null. */
  readonly scale?: FitScale | null;
}

const FitContext = createContext<FitScopeValue | null>(null);

/** Hands a {@link useFitScope} result to the {@link FitLabel}s beneath it. */
export function FitScope({ value, children }: { value: FitScopeValue; children?: ReactNode }) {
  return <FitContext.Provider value={value}>{children}</FitContext.Provider>;
}

/** Calls `onLoad` with `ref`'s element each time a web font finishes loading in its document. */
function useFontLoads(ref: RefObject<HTMLElement | null>, onLoad: (el: HTMLElement) => void): void {
  useLayoutEffect(() => {
    const el = ref.current;
    const fonts: FontFaceSet | undefined = el?.ownerDocument.fonts;
    if (!el || typeof fonts?.addEventListener !== 'function') return;
    const loaded = (): void => onLoad(el);
    fonts.addEventListener('loadingdone', loaded);
    return () => fonts.removeEventListener('loadingdone', loaded);
  }, [ref, onLoad]);
}

const overflows = (el: Element): boolean => el.scrollWidth > el.clientWidth;

/**
 * Steps a scope's labels again whenever its element is resized. Only the element is observed: its parent can be
 * resized by any observer deeper in the page, which turns watching it into a ResizeObserver loop. A step leaves the
 * element's box as it was, since its CSS holds the box to its room; marking it spent can move it, so that waits for
 * `recheck`'s render, outside the observer's delivery.
 */
function useRoomObserver(
  ref: RefObject<HTMLElement | null>,
  depth: number,
  roomRef: RefObject<FitRoom>,
  shouldStep: () => boolean,
  recheck: () => void,
  setOwn: (next: number | ((s: number) => number)) => void,
): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || depth < 1 || typeof ResizeObserver === 'undefined') return;
    const room = roomRef.current;
    const observer = new ResizeObserver(() => {
      const at = room.steppedAt;
      if (depth >= 2 && at !== null && el.clientWidth > at + 0.5) {
        room.steppedAt = null;
        flushSync(() => setOwn(0));
      } else if (depth >= 2 && shouldStep()) {
        flushSync(() => setOwn((s) => s + 1));
      }
      if (room.spentAt !== null || overflows(el)) recheck();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, depth, roomRef, shouldStep, recheck, setOwn]);
}

/**
 * Fits the {@link FitLabel}s under `ref` to the room they are given.
 *
 * Every label steps down together, one form at a time, until `ref`'s element
 * no longer overflows or no label has a shorter form left. Each label takes its
 * form at the step, or its last where it has fewer. The element growing past
 * the width it had when a step was taken starts again from the full forms, and
 * so does a web font finishing loading.
 *
 * Only the element is measured, never its parent, so its box has to take the
 * shape of its room whatever forms it shows: it fills the room, or it is
 * clamped to it. While it holds labels the element carries `data-fit-room`, and
 * `--fit-natural` holds its width at the full forms, for the component's
 * CSS to keep a box sized to its content at that width within its room as the
 * labels shorten: `min-inline-size: min(var(--fit-natural, 0px), 100%)`
 * beside `max-inline-size: 100%`.
 *
 * A scope nested in another steps at least as far as the outer one, so a
 * control inside a strip shortens along with the strip.
 *
 * Once every label is at its last form and the element still overflows, it
 * carries `data-fit-spent`, for a layout to give it more room, until it grows
 * wider than it was with that room.
 *
 * Given `scale` when it mounts, the scope also runs a scale stage: members that
 * join it through {@link useFitScale} each fit a form to their own room by
 * measurement, and every one sharing the scope's scale prints at the smallest
 * any of them needs, floored at `scale.min`, published on the element as
 * `scale.property`. A nested scope without one passes its outer scope's on.
 */
export function useFitScope(
  ref: RefObject<HTMLElement | null>,
  { scale: scaleOptions }: { scale?: FitScaleOptions } = {},
): FitScopeValue {
  const outer = useContext(FitContext);
  const scale = useScaleStage(ref, scaleOptions) ?? outer?.scale ?? null;
  const [own, setOwn] = useState(0);
  const [labels, setLabels] = useState<readonly number[]>([]);
  const [check, setCheck] = useState(0);
  const recheck = useCallback(() => setCheck((c) => c + 1), []);
  const counted = useRef(new Map<symbol, number>());
  const roomRef = useRef<FitRoom>({ steppedAt: null, spentAt: null, measured: false });

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
  /** Whether the element overflows and a label has a shorter form left; records the room if so. */
  const shouldStep = useCallback((): boolean => {
    const el = ref.current;
    if (!el || ownRef.current >= depth - 1 || !overflows(el)) return false;
    roomRef.current.steppedAt = el.clientWidth;
    return true;
  }, [ref, depth]);

  // A label set that changed may fit at a longer form than the old one did.
  const fittedFor = useRef(labels);
  useLayoutEffect(() => {
    const room = roomRef.current;
    if (fittedFor.current !== labels) {
      fittedFor.current = labels;
      room.steppedAt = null;
      room.measured = false;
      if (own !== 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- measures layout
        setOwn(0);
        return;
      }
    }
    const el = ref.current;
    if (!el) return;
    prepareRoom(el, room, depth, own === 0);
    if (shouldStep()) setOwn(own + 1);
    else settleSpent(el, room, depth > 0 && own >= depth - 1);
  }, [ref, depth, labels, own, check, shouldStep]);

  // Labels set in a fallback font may have stepped further than the face that loads needs, with no change in
  // the room to say so.
  const refit = useCallback(
    (el: HTMLElement): void => {
      roomRef.current.steppedAt = null;
      roomRef.current.spentAt = null;
      roomRef.current.measured = false;
      el.removeAttribute('data-fit-spent');
      setOwn(0);
      setCheck((c) => c + 1);
    },
    [],
  );
  useFontLoads(ref, refit);

  useRoomObserver(ref, depth, roomRef, shouldStep, recheck, setOwn);

  const step = Math.max(own, outer?.step ?? 0);
  return useMemo(() => ({ step, register, scale }), [step, register, scale]);
}

/** The scale stage of the nearest {@link FitScope} that runs one, or null. */
export function useFitScale(): FitScale | null {
  return useContext(FitContext)?.scale ?? null;
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
