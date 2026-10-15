import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import type { DistortMode, EnvelopeMapping } from '@weasel-js/geom';
import type { Action, GestureBinding } from '@weasel-js/routing';
import { defineTool, type Tool } from '../../overlayBinding';
import type { CanvasExtensionApi } from 'canvas/canvasExtension';
import type { ContributionDepReader, SurfaceContribution } from 'canvas/surfaceContribution';
import {
  createAddPinAction, createRemovePinAction, createWarpDragAction, createWarpGrabAction, createWarpLive,
} from 'interactions/actions/warp/warpActions';
import type { WarpKind, WarpSettings } from 'interactions/actions/warp/warpTargets';
import { createWarpHandleLayer, warpLayerId } from './warpHandles';

/** A warp tool: a `Tool` that also registers the layer showing its controls. */
export type WarpTool = Tool & Pick<SurfaceContribution, 'attach'>;

/** Options every warp tool takes. */
interface WarpToolOptions {
  /** Palette label. */
  label?: string;
  /** How far, in world units, a warped path's refitted curves may stray from
   *  the exact warp. Default 0.5. */
  tolerance?: number;
}

/** Options for {@link useDistortTool}. */
export interface UseDistortToolOptions extends WarpToolOptions {
  /** The map a new distort starts with: `'free'` (bilinear, the default) or
   *  `'perspective'` (projective). */
  mode?: DistortMode;
}

/** Options for {@link useEnvelopeTool}. */
export interface UseEnvelopeToolOptions extends WarpToolOptions {
  /** Patch rows and columns of a new envelope's mesh. Default 3 each. */
  rows?: number;
  cols?: number;
  /** How a new envelope interpolates its mesh. Default `'bicubic'`. */
  mapping?: EnvelopeMapping;
}

/** Options for {@link usePuppetTool}. */
export type UsePuppetToolOptions = WarpToolOptions;

const ANY_MODS = { shift: 'optional', alt: 'optional', meta: 'optional', ctrl: 'optional' } as const;

function bindingsFor(kind: WarpKind, settings: () => Record<string, unknown>): GestureBinding[] {
  const target = `affordance:layer:${warpLayerId(kind)}` as const;
  const out: GestureBinding[] = [];
  if (kind === 'puppet') {
    out.push({ spec: { kind: 'click', target, mods: { alt: true } }, actionId: 'puppet.removePin' });
    out.push({ spec: { kind: 'click', target: 'selected-body' }, actionId: 'puppet.addPin', opts: { params: settings } });
  }
  out.push(
    { spec: { kind: 'drag', target }, actionId: `${kind}.drag`, opts: { params: settings } },
    { spec: { kind: 'pointerDown', target, mods: ANY_MODS }, actionId: `${kind}.grab` },
    { spec: { kind: 'click', target }, actionId: `${kind}.grab` },
  );
  return out;
}

const LABELS: Record<WarpKind, string> = { distort: 'Distort', envelope: 'Envelope', puppet: 'Puppet Warp' };

function useWarpTool(kind: WarpKind, label: string | undefined, settings: WarpSettings): WarpTool {
  const settingsRef = useLatest(settings);
  const state = useMemo(() => ({
    active: false,
    api: null as CanvasExtensionApi | null,
    deps: null as ContributionDepReader | null,
    live: createWarpLive(),
  }), []);

  const attach = useMemo(() => {
    const layer = createWarpHandleLayer({
      kind,
      active: () => state.active,
      settings: () => settingsRef.current,
      scene: () => state.deps?.get('scene') as never,
      live: state.live,
    });
    return (api: CanvasExtensionApi, deps: ContributionDepReader) => {
      state.api = api;
      state.deps = deps;
      const unregister = api.registerLayer(layer);
      const unlisten = state.live.subscribe(() => api.requestRedraw());
      return () => {
        unlisten();
        unregister();
        state.api = null;
        state.deps = null;
      };
    };
  }, [kind, settingsRef, state]);

  const actions = useMemo<Action[]>(() => [
    createWarpDragAction(kind, state.live),
    createWarpGrabAction(kind),
    ...(kind === 'puppet' ? [createAddPinAction(), createRemovePinAction()] : []),
  ], [kind, state]);

  return useMemo(() => {
    const tool = defineTool({
      id: kind,
      hookName: `use${kind[0].toUpperCase()}${kind.slice(1)}Tool`,
      capabilities: ['creates-shapes'],
      cursor: kind === 'puppet' ? 'crosshair' : 'default',
      actions,
      presentation: { label: label ?? LABELS[kind], group: 'warp' },
      onActivate: () => { state.active = true; state.api?.requestRedraw(); },
      onDeactivate: () => { state.active = false; state.api?.requestRedraw(); },
      bindings: bindingsFor(kind, () => ({ ...settingsRef.current })),
    });
    return Object.assign(tool, { attach });
  }, [actions, attach, kind, label, settingsRef, state]);
}

/**
 * Distort the selected paths by their box's four corners, each dragged on its
 * own. The first drag gives the selection a distort, kept on each path as
 * `data.warp` until it is expanded (`expandWarp`); selecting the paths again
 * with this tool shows its corners where they were left. `configureWarp`
 * switches a held distort between free and perspective.
 */
export function useDistortTool(options: UseDistortToolOptions = {}): WarpTool {
  const { label, mode, tolerance } = options;
  return useWarpTool('distort', label, { mode, tolerance });
}

/**
 * Warp the selected paths through a mesh of control points over their box:
 * drag any point and the shape bends smoothly around it. The mesh is held on
 * each path until it is expanded, and `configureWarp` changes its grid or its
 * interpolation.
 */
export function useEnvelopeTool(options: UseEnvelopeToolOptions = {}): WarpTool {
  const { label, rows, cols, mapping, tolerance } = options;
  return useWarpTool('envelope', label, { rows, cols, mapping, tolerance });
}

/**
 * Pin the selected paths where they are clicked, and drag a pin to bend them:
 * the rest of the shape follows as rigidly as the pins allow, and a pin left
 * alone holds its place. Alt-click a pin to take it out. The pins are held on
 * each path until it is expanded.
 */
export function usePuppetTool(options: UsePuppetToolOptions = {}): WarpTool {
  const { label, tolerance } = options;
  return useWarpTool('puppet', label, { tolerance });
}
