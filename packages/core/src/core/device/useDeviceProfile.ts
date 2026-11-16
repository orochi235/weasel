import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { DetectedDeviceFacts, DeviceProfile } from './types';
import { DEFAULT_DEVICE_PROFILE, resolveDeviceProfile } from '@weasel-js/routing';
import { useMediaQuery } from '@weasel-js/react';
import { watchDevicePixelRatio } from './watchDevicePixelRatio';

const COARSE_QUERY = '(pointer: coarse)';
const HOVER_QUERY = '(hover: hover)';

const readDpr = (): number => (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
const serverDpr = (): number => 1;

/**
 * Detect device facts and keep them live.
 *
 * Three subscriptions: pointer coarseness, hover capability, and pixel
 * density. None while `watch` is false; the queries are then read only when the caller renders.
 */
function useDetectedFacts(watch: boolean): DetectedDeviceFacts {
  const coarsePointer = useMediaQuery(COARSE_QUERY, { fallback: DEFAULT_DEVICE_PROFILE.coarsePointer, follow: watch });
  const canHover = useMediaQuery(HOVER_QUERY, { fallback: DEFAULT_DEVICE_PROFILE.canHover, follow: watch });
  // Density does not need `matchMedia` to be read, only to be watched; gating the read would report 1 under jsdom.
  // A store, not state an effect sets: setting the density it already held re-rendered the provider alone after its next commit.
  const watchDpr = useCallback((onChange: () => void) => (watch ? watchDevicePixelRatio(onChange) : () => {}), [watch]);
  const dpr = useSyncExternalStore(watchDpr, readDpr, serverDpr);
  return useMemo(() => ({ coarsePointer, canHover, dpr }), [coarsePointer, canHover, dpr]);
}

const DeviceProfileContext = createContext<DeviceProfile | null>(null);

/**
 * Read the ambient device profile.
 *
 * Uses the nearest {@link DeviceProfileProvider} when one exists, watching
 * nothing of its own, and otherwise detects for itself — so a standalone overlay or a labkit panel
 * rendered outside a `<SceneCanvas>` still gets correct facts.
 *
 * `overrides` always wins over both, which is what makes tests and
 * force-touch-chrome demos possible without stubbing `matchMedia`.
 */
export function useDeviceProfile(overrides?: Partial<DeviceProfile>): DeviceProfile {
  const provided = useContext(DeviceProfileContext);
  const detected = useDetectedFacts(provided === null);
  const base: DetectedDeviceFacts = provided ?? detected;
  const { coarsePointer, canHover, dpr } = overrides ?? {};
  // A provider's scale may be its own override, which re-deriving it from the pointer would drop.
  const targetScale = overrides?.targetScale ?? (coarsePointer === undefined ? provided?.targetScale : undefined);
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
