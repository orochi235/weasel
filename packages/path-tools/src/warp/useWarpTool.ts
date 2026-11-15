import { ANY_MODS, bindAction } from '@weasel-js/routing';
import { useMemo } from 'react';
import type { IconRef } from '@weasel-js/icons';
import { useLatest } from '@weasel-js/react';
import type { PlaneMode, ClothMapping } from '@weasel-js/geom/warp';
import type { Action, ActionParamsOf, GestureBinding, ToolKeybinding } from '@weasel-js/routing';
import {
  type CanvasExtensionApi, type ContributionDepReader, defineTool, type SurfaceContribution, type Tool,
} from '@weasel-js/core';
import {
  createAddPinAction, createRemovePinAction, createWarpDragAction, createWarpGrabAction, createWarpLive,
} from './warpActions';
import { WARP_LABELS, type WarpKind, type WarpSettings } from './warpTargets';
import { createWarpHandleLayer, warpLayerId } from './warpHandles';
import { icon } from '../icons.gen';

const WARP_ICONS = { plane: icon('planeWarp'), cloth: icon('clothWarp'), pin: icon('pinWarp') } satisfies Record<WarpKind, IconRef>;

/** A warp tool: a `Tool` that also registers the layer showing its controls. */
export type WarpTool = Tool & Pick<SurfaceContribution, 'attach'>;

/** Options every warp tool takes. */
export interface WarpToolOptions {
  /** Palette label. */
  label?: string;
  /** Override the default keybinding (Plane Warp `F`, Cloth Warp `Shift+F`, Pin Warp
   *  `B`). Pass `null` to omit. */
  keybinding?: ToolKeybinding | null;
  /** How far, in world units, a warped path's refitted curves may stray from
   *  the exact warp. Default 0.5. */
  tolerance?: number;
}

/** Options for {@link usePlaneWarpTool}. */
export interface UsePlaneWarpToolOptions extends WarpToolOptions {
  /** The map a new plane warp starts with: `'free'` (bilinear, the default) or
   *  `'perspective'` (projective). */
  mode?: PlaneMode;
}

/** Options for {@link useClothWarpTool}. */
export interface UseClothWarpToolOptions extends WarpToolOptions {
  /** Patch rows and columns of a new cloth warp's mesh. Default 3 each. */
  rows?: number;
  cols?: number;
  /** How a new cloth warp interpolates its mesh. Default `'bicubic'`. */
  mapping?: ClothMapping;
}

/** Options for {@link usePinWarpTool}. */
export type UsePinWarpToolOptions = WarpToolOptions;

function bindingsFor(kind: WarpKind, settings: () => WarpSettings): GestureBinding[] {
  const target = `affordance:layer:${warpLayerId(kind)}` as const;
  const out: GestureBinding[] = [];
  if (kind === 'pin') {
    out.push({ spec: { kind: 'click', target, mods: { alt: true } }, actionId: 'pin.removePin', opts: { id: 'pin.removePin' } });
    out.push({ spec: { kind: 'click', target: 'selected-body' }, actionId: 'pin.addPin', opts: { id: 'pin.addPin', params: settings } });
  }
  out.push(
    bindAction({ kind: 'drag', target }, `${kind}.drag` as const, { id: `${kind}.drag`, params: settings }),
    { spec: { kind: 'pointerDown', target, mods: ANY_MODS }, actionId: `${kind}.grab`, opts: { id: `${kind}.grab` } },
    { spec: { kind: 'click', target }, actionId: `${kind}.grab`, opts: { id: `${kind}.grabClick` } },
  );
  return out;
}

/** `settings` without its unset keys, so `<SceneCanvas tune>` params fill them in. */
function definedOf(settings: WarpSettings): WarpSettings {
  return Object.fromEntries(Object.entries(settings).filter(([, v]) => v !== undefined)) as WarpSettings;
}

const KEYS: Record<WarpKind, ToolKeybinding> = { plane: { key: 'F' }, cloth: { key: 'F', shift: true }, pin: { key: 'B' } };

/** What a warp tool keeps between renders: whether it is active, the canvas
 *  it is attached to, and the in-flight drag its controls follow. */
function createWarpToolState() {
  let active = false;
  let api: CanvasExtensionApi | null = null;
  let deps: ContributionDepReader | null = null;
  const live = createWarpLive();
  return {
    live,
    active: () => active,
    scene: () => deps?.get('scene') as never,
    outlines: () => deps?.get('createOutlinesAdapter'),
    /** What an invocation of `actionId` passing `given` starts with here,
     *  its tunings included. */
    paramsOf: <Id extends string>(actionId: Id, given: Partial<ActionParamsOf<Id>>) =>
      deps?.get('actionParams')?.(actionId, given) ?? given,
    setActive(next: boolean): void {
      active = next;
      api?.requestRedraw();
    },
    attachTo(nextApi: CanvasExtensionApi | null, nextDeps: ContributionDepReader | null): void {
      api = nextApi;
      deps = nextDeps;
    },
  };
}

function useWarpTool(kind: WarpKind, options: WarpToolOptions, settings: WarpSettings): WarpTool {
  const { label, keybinding = KEYS[kind] } = options;
  const settingsRef = useLatest(settings);
  const state = useMemo(() => createWarpToolState(), []);

  const attach = useMemo(() => {
    const layer = createWarpHandleLayer({
      kind,
      active: state.active,
      settings: () => state.paramsOf(`${kind}.drag` as const, definedOf(settingsRef.current)),
      scene: state.scene,
      outlines: state.outlines,
      live: state.live,
    });
    return (api: CanvasExtensionApi, deps: ContributionDepReader) => {
      state.attachTo(api, deps);
      const unregister = api.registerLayer(layer);
      const unlisten = state.live.subscribe(() => api.requestRedraw());
      return () => {
        unlisten();
        unregister();
        state.attachTo(null, null);
      };
    };
  }, [kind, settingsRef, state]);

  const actions = useMemo<Action[]>(() => [
    createWarpDragAction(kind, state.live),
    createWarpGrabAction(kind),
    ...(kind === 'pin' ? [createAddPinAction(), createRemovePinAction()] : []),
  ], [kind, state]);

  return useMemo(() => {
    const tool = defineTool({
      id: kind,
      ...(keybinding ? { keybinding } : {}),
      hookName: `use${kind[0].toUpperCase()}${kind.slice(1)}Tool`,
      capabilities: ['creates-shapes'],
      cursor: kind === 'pin' ? 'crosshair' : 'default',
      actions,
      presentation: { label: label ?? WARP_LABELS[kind], group: 'warp', icon: WARP_ICONS[kind] },
      // Its controls stand in for the selection's transform handles.
      hides: ['selection.resize-handles', 'selection.rotation-handle'],
      onActivate: () => state.setActive(true),
      onDeactivate: () => state.setActive(false),
      bindings: bindingsFor(kind, () => definedOf(settingsRef.current)),
    });
    return Object.assign(tool, { attach });
  }, [actions, attach, keybinding, kind, label, settingsRef, state]);
}

/**
 * Plane warp: warp the selected paths by their box's four corners, each dragged on its
 * own. The first drag gives the selection a plane warp, kept on each path as
 * `data.warp` until it is expanded (`expandWarp`); selecting the paths again
 * with this tool shows its corners where they were left. `configureWarp`
 * switches a held plane warp between free and perspective.
 */
export function usePlaneWarpTool(options: UsePlaneWarpToolOptions = {}): WarpTool {
  const { mode, tolerance } = options;
  return useWarpTool('plane', options, { mode, tolerance });
}

/**
 * Warp the selected paths through a mesh of control points over their box:
 * drag any point and the shape bends smoothly around it. The mesh is held on
 * each path until it is expanded, and `configureWarp` changes its grid or its
 * interpolation.
 */
export function useClothWarpTool(options: UseClothWarpToolOptions = {}): WarpTool {
  const { rows, cols, mapping, tolerance } = options;
  return useWarpTool('cloth', options, { rows, cols, mapping, tolerance });
}

/**
 * Pin the selected paths where they are clicked, and drag a pin to bend them:
 * the rest of the shape follows as rigidly as the pins allow, and a pin left
 * alone holds its place. Alt-click a pin to take it out. The pins are held on
 * each path until it is expanded.
 */
export function usePinWarpTool(options: UsePinWarpToolOptions = {}): WarpTool {
  return useWarpTool('pin', options, { tolerance: options.tolerance });
}
