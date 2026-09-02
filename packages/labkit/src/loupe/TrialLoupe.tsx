import { type RefObject, useContext, useMemo } from 'react';
import { CanvasStackContext } from '../canvas/CanvasStackContext';
import type { WorldSpec } from '../canvas/worldSpec';
import type { ViewTransform } from '../instrument/types';
import { CanvasLoupe } from './CanvasLoupe';
import { sampleStack } from './canvasLens';
import { DomLoupe } from './DomLoupe';
import { LoupeBubble } from './LoupeBubble';
import type { ResolvedLoupe } from './types';
import { useHostSize } from './useHostSize';
import { useLoupe } from './useLoupe';

/** Props for `<TrialLoupe>`. */
export interface TrialLoupeProps {
  capability: ResolvedLoupe;
  /** Whether the trial's loupe is turned on. Hold-to-peek shows it anyway. */
  enabled: boolean;
  state: unknown;
  config: unknown;
  /** The trial's own camera. */
  view: ViewTransform;
  worldSpec?: WorldSpec;
  /** The element the lens tracks. A loupe mounted inside a `<CanvasStack>`
   *  takes the stack's own element instead, and this goes unused. */
  hostRef?: RefObject<HTMLElement | null>;
}

/** Stable stand-in, so a loupe with nothing to track does not re-bind its
 *  listeners on every render. */
const NO_HOST: RefObject<HTMLElement | null> = { current: null };

/**
 * A trial's loupe, painted by whichever painter suits its content: the canvas
 * stack it is mounted inside, or the instrument's own `render` at a magnified
 * camera.
 */
export function TrialLoupe({
  capability,
  enabled,
  state,
  config,
  view,
  worldSpec,
  hostRef,
}: TrialLoupeProps) {
  const stack = useContext(CanvasStackContext);
  const surface = capability.render ? undefined : stack?.surface;
  const host = surface?.element ?? hostRef ?? NO_HOST;

  const sample = useMemo(() => {
    if (!surface) return undefined;
    return (p: { x: number; y: number }): string | null => {
      const canvases = surface.canvases.current;
      return canvases ? sampleStack(surface.layers, canvases, p, surface.size.dpr) : null;
    };
  }, [surface]);

  const loupe = useLoupe({ capability, hostRef: host, enabled, sample });
  const measured = useHostSize(host);
  const size = surface?.size ?? measured;

  if (!loupe.visible) return null;

  return (
    <LoupeBubble aim={loupe.aim} diameter={capability.diameter}>
      {capability.render ? (
        <DomLoupe
          aim={loupe.aim}
          factor={loupe.factor}
          mode={loupe.mode}
          diameter={capability.diameter}
          size={size}
          view={view}
          frame={stack?.frame}
          state={state}
          config={config}
          render={capability.render}
        />
      ) : surface && stack ? (
        <CanvasLoupe
          aim={loupe.aim}
          factor={loupe.factor}
          mode={loupe.mode}
          diameter={capability.diameter}
          surface={surface}
          view={stack.view}
          frame={stack.frame}
          worldSpec={worldSpec}
        />
      ) : null}
    </LoupeBubble>
  );
}
