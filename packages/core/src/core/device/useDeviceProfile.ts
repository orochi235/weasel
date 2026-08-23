import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { DetectedDeviceFacts, DeviceProfile } from './types';
import { DEFAULT_DEVICE_PROFILE, resolveDeviceProfile } from './profile';

const COARSE_QUERY = '(pointer: coarse)';
const HOVER_QUERY = '(hover: hover)';

function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

function detectOnce(): DetectedDeviceFacts {
  // Density is read unconditionally: `devicePixelRatio` does not depend on
  // `matchMedia` existing. Only *watching* density needs a media query.
  // Gating this read behind `hasMatchMedia()` would report density 1 under
  // any environment without matchMedia — including jsdom, which would
  // silently break `useCanvasSize`'s existing DPR assertions.
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  if (!hasMatchMedia()) {
    return {
      coarsePointer: DEFAULT_DEVICE_PROFILE.coarsePointer,
      canHover: DEFAULT_DEVICE_PROFILE.canHover,
      dpr,
    };
  }
  return {
    coarsePointer: window.matchMedia(COARSE_QUERY).matches,
    canHover: window.matchMedia(HOVER_QUERY).matches,
    dpr,
  };
}

/**
 * Detect device facts and keep them live.
 *
 * Three subscriptions: pointer coarseness, hover capability, and pixel
 * density. The density one is special — `(resolution: Ndppx)` stops matching
 * as soon as density changes, so a single listener fires once and goes dead.
 * We re-arm a fresh query at the new density on every change.
 */
function useDetectedFacts(): DetectedDeviceFacts {
  const [facts, setFacts] = useState<DetectedDeviceFacts>(detectOnce);

  useEffect(() => {
    if (!hasMatchMedia()) return;

    const coarseMq = window.matchMedia(COARSE_QUERY);
    const hoverMq = window.matchMedia(HOVER_QUERY);

    const onCoarse = (e: MediaQueryListEvent | { matches: boolean }) =>
      setFacts((f) => ({ ...f, coarsePointer: e.matches }));
    const onHover = (e: MediaQueryListEvent | { matches: boolean }) =>
      setFacts((f) => ({ ...f, canHover: e.matches }));

    coarseMq.addEventListener('change', onCoarse as EventListener);
    hoverMq.addEventListener('change', onHover as EventListener);

    // Re-arming density watcher.
    let disposed = false;
    let densityMq: MediaQueryList | null = null;
    const onDensity = () => {
      if (disposed) return;
      const next = window.devicePixelRatio || 1;
      setFacts((f) => (f.dpr === next ? f : { ...f, dpr: next }));
      arm();
    };
    function arm(): void {
      if (disposed) return;
      densityMq?.removeEventListener('change', onDensity as EventListener);
      densityMq = window.matchMedia(
        `(resolution: ${window.devicePixelRatio || 1}dppx)`,
      );
      densityMq.addEventListener('change', onDensity as EventListener);
    }
    arm();

    // Re-sync once on mount: a query could have changed between the
    // useState initializer and the effect running.
    setFacts({
      coarsePointer: coarseMq.matches,
      canHover: hoverMq.matches,
      dpr: window.devicePixelRatio || 1,
    });

    return () => {
      disposed = true;
      coarseMq.removeEventListener('change', onCoarse as EventListener);
      hoverMq.removeEventListener('change', onHover as EventListener);
      densityMq?.removeEventListener('change', onDensity as EventListener);
    };
  }, []);

  return facts;
}

const DeviceProfileContext = createContext<DeviceProfile | null>(null);

/**
 * Read the ambient device profile.
 *
 * Uses the nearest {@link DeviceProfileProvider} when one exists, and
 * otherwise detects for itself — so a standalone overlay or a labkit panel
 * rendered outside a `<SceneCanvas>` still gets correct facts.
 *
 * `overrides` always wins over both, which is what makes tests and
 * force-touch-chrome demos possible without stubbing `matchMedia`.
 */
export function useDeviceProfile(overrides?: Partial<DeviceProfile>): DeviceProfile {
  const provided = useContext(DeviceProfileContext);
  const detected = useDetectedFacts();
  const base: DetectedDeviceFacts = provided ?? detected;
  const { coarsePointer, canHover, dpr, targetScale } = overrides ?? {};
  return useMemo(
    () =>
      resolveDeviceProfile(base, {
        ...(coarsePointer !== undefined ? { coarsePointer } : {}),
        ...(canHover !== undefined ? { canHover } : {}),
        ...(dpr !== undefined ? { dpr } : {}),
        ...(targetScale !== undefined ? { targetScale } : {}),
      }),
    [base, coarsePointer, canHover, dpr, targetScale],
  );
}

/** Props for `<DeviceProfileProvider>`. */
export interface DeviceProfileProviderProps {
  /** Partial override folded over detected facts. */
  value?: Partial<DeviceProfile>;
  children: ReactNode;
}

/**
 * Publish one resolved profile to a subtree. `<SceneCanvas>` renders this so
 * overlays, affordances, and consumer chrome all read the same object.
 */
export function DeviceProfileProvider({ value, children }: DeviceProfileProviderProps) {
  const profile = useDeviceProfile(value);
  return createElement(DeviceProfileContext.Provider, { value: profile }, children);
}
