import { useCallback, useMemo, type RefObject } from 'react';
import { useLatest } from '@weasel-js/react';
import type { Dispatcher, RuleCtx } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { never, useHoverTracking, type HoverTracking, type VisibilityRules } from 'features/chrome-caps';
import {
  useChromeCaps,
  type ChromeCaps,
  type ChromeCapsSource,
  type ViewRuleInputs,
} from 'features/chrome-caps/useChromeCaps';
import type { CanvasExtensionApi } from '../canvasExtension';
import { useOptionalViewRegistry } from '../viewRegistry';
import { presetChromeRules, type EnabledPresets } from './features';
import { PRESET_OWNED_CHROME } from './presets/chrome';
import type { NodeAtPoint } from './useNodeAtPoint';
import { worldPointAt } from './worldPointAt';

/**
 * The node under the pointer, for `RuleCtx.hover`. One lookup, not a
 * client-to-world thunk beside a picker: the point and the camera its
 * tolerance converts against have to come from the same view. Hover has no
 * pointer to capture, so whichever view is under the cursor owns the point.
 */
export function useSceneHover(args: {
  canvasApiRef: RefObject<Pick<CanvasExtensionApi, 'clientToWorld'> | null>;
  /** The surface's own camera, for a point no declared view claims. */
  viewRef: { readonly current: View };
  nodeAtPointRef: { readonly current: NodeAtPoint | undefined };
  enabled: boolean;
  onChange?: (id: NodeId | null) => void;
}): HoverTracking {
  const { canvasApiRef, viewRef, nodeAtPointRef, enabled, onChange } = args;
  const surfaceViewRegistry = useOptionalViewRegistry();
  return useHoverTracking({
    nodeAtClientPoint: (clientX, clientY) => {
      const api = canvasApiRef.current;
      if (!api) return null;
      const target = surfaceViewRegistry?.resolver.at(null, clientX, clientY);
      const view = target?.view ?? viewRef.current;
      const [x, y] = worldPointAt(api, target, clientX, clientY);
      // A view judges its own layers; the surface's gate is the picker's default.
      const reg = target?.id != null
        ? surfaceViewRegistry?.list().find((r) => r.id === target.id)
        : undefined;
      const hit = nodeAtPointRef.current?.(
        x, y, reg ? { scale: view.scale, layerIsPainted: reg.layerIsPainted } : view,
      );
      return hit ? { id: hit.id as NodeId } : null;
    },
    enabled,
    ...(onChange ? { onChange } : {}),
  });
}

/**
 * The surface's chrome-visibility rules: the presets' defaults under the
 * consumer's `chromeVisibility`, which wins.
 *
 * An unselectable canvas hides the marquee and lasso by default: every
 * selection write no-ops there, so the select tool's empty-drag binding still
 * claims the gesture, keeping it from falling through to an ambient drag such
 * as insert, but paints nothing.
 */
export function useChromeRules(args: {
  enabled: EnabledPresets;
  selectable: boolean;
  chromeVisibility: VisibilityRules | undefined;
}): VisibilityRules {
  const { enabled, selectable, chromeVisibility } = args;
  return useMemo(() => {
    const defaults = presetChromeRules(enabled, PRESET_OWNED_CHROME);
    if (!selectable) {
      defaults['action.marquee'] = never;
      defaults['action.lasso'] = never;
    }
    return { ...defaults, ...chromeVisibility };
  }, [chromeVisibility, selectable, enabled]);
}

/** The chrome-caps answers for the surface's own view. */
export function useSurfaceChromeCaps(args: {
  source: ChromeCapsSource;
  /** The selection as rendered. `SelectionApi.current` can be a live getter
   *  that runs ahead of the commit the painted chrome was built from. */
  selection: readonly NodeId[];
  viewRef: { readonly current: View };
  dispatcher: Pick<Dispatcher, 'getActiveAction'>;
}): {
  chromeCaps: ChromeCaps;
  getIsVisible: () => (id: string) => boolean;
  getRuleCtx: () => RuleCtx | undefined;
} {
  const { viewRef, dispatcher } = args;
  const chromeCaps = useChromeCaps(args.source);
  const committedSelectionRef = useLatest(args.selection);
  const currentRuleInputs = useCallback((): ViewRuleInputs => ({
    selection: committedSelectionRef.current,
    view: viewRef.current,
    action: dispatcher.getActiveAction(),
  }), [dispatcher, committedSelectionRef, viewRef]);
  const getIsVisible = useCallback(
    (): ((id: string) => boolean) => chromeCaps.isVisible(currentRuleInputs()),
    [chromeCaps, currentRuleInputs],
  );
  const getRuleCtx = useCallback(
    () => chromeCaps.ruleCtx(currentRuleInputs()),
    [chromeCaps, currentRuleInputs],
  );
  return { chromeCaps, getIsVisible, getRuleCtx };
}

/**
 * The surface's chrome: hover tracking, the visibility rules, and the chrome-caps answers they
 * feed. `source` is the chrome-caps source minus the parts built here.
 */
export function useSceneCanvasChrome(args: {
  source: Omit<ChromeCapsSource, 'rules' | 'getHover'>;
  rules: Parameters<typeof useChromeRules>[0];
  hover: Omit<Parameters<typeof useSceneHover>[0], 'enabled' | 'viewRef'>;
  selection: readonly NodeId[];
  viewRef: { readonly current: View };
  dispatcher: Pick<Dispatcher, 'getActiveAction'>;
}) {
  const { rules, viewRef } = args;
  const { getHover, canvasRef: trackHoverOn } = useSceneHover({
    ...args.hover, viewRef, enabled: rules.chromeVisibility !== undefined || args.hover.onChange !== undefined,
  });
  const chromeRules = useChromeRules(rules);
  const caps = useSurfaceChromeCaps({
    source: { rules: chromeRules, getHover, ...args.source },
    selection: args.selection,
    viewRef,
    dispatcher: args.dispatcher,
  });
  return { ...caps, trackHoverOn };
}
