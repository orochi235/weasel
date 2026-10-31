import { useMemo } from 'react';
import type { IconRef } from '@weasel-js/icons';
import { useLatest } from '@weasel-js/react';
import type { DistortMode, EnvelopeMapping } from '@weasel-js/geom/warp';
import type { Action, GestureBinding, ToolKeybinding } from '@weasel-js/routing';
import {
  type CanvasExtensionApi, type ContributionDepReader, defineTool, type SurfaceContribution, type Tool,
} from '@weasel-js/core';
import {
  createAddPinAction, createRemovePinAction, createWarpDragAction, createWarpGrabAction, createWarpLive,
} from './warpActions';
import { WARP_LABELS, type WarpKind, type WarpSettings } from './warpTargets';
import { createWarpHandleLayer, warpLayerId } from './warpHandles';
import { icon } from '../icons.gen';

const WARP_ICONS = { distort: icon('distort'), envelope: icon('envelope'), puppet: icon('puppetWarp') } satisfies Record<WarpKind, IconRef>;

/** A warp tool: a `Tool` that also registers the layer showing its controls. */
export type WarpTool = Tool & Pick<SurfaceContribution, 'attach'>;

/** Options every warp tool takes. */
export interface WarpToolOptions {
  /** Palette label. */
  label?: string;
  /** Override the default keybinding (Distort `F`, Envelope `M`, Puppet Warp
   *  `B`). Pass `null` to omit. */
  keybinding?: ToolKeybinding | null;
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
    out.push({ spec: { kind: 'click', target, mods: { alt: true } }, actionId: 'puppet.removePin', opts: { id: 'puppet.removePin' } });
    out.push({ spec: { kind: 'click', target: 'selected-body' }, actionId: 'puppet.addPin', opts: { id: 'puppet.addPin', params: settings } });
  }
  out.push(
    { spec: { kind: 'drag', target }, actionId: `${kind}.drag`, opts: { id: `${kind}.drag`, params: settings } },
    { spec: { kind: 'pointerDown', target, mods: ANY_MODS }, actionId: `${kind}.grab`, opts: { id: `${kind}.grab` } },
    { spec: { kind: 'click', target }, actionId: `${kind}.grab`, opts: { id: `${kind}.grabClick` } },
  );
  return out;
}

/** `settings` without its unset keys, so `<SceneCanvas tune>` params fill them in. */
function definedOf(settings: WarpSettings): Record<string, unknown> {
  return Object.fromEntries(Object.entries(settings).filter(([, v]) => v !== undefined));
}

const KEYS: Record<WarpKind, ToolKeybinding> = { distort: { key: 'F' }, envelope: { key: 'F', shift: true }, puppet: { key: 'B' } };

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
    paramsOf: (actionId: string, given: Record<string, unknown>) => deps?.get('actionParams')?.(actionId, given) ?? given,
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
      settings: () => state.paramsOf(`${kind}.drag`, definedOf(settingsRef.current)) as WarpSettings,
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
    ...(kind === 'puppet' ? [createAddPinAction(), createRemovePinAction()] : []),
  ], [kind, state]);

  return useMemo(() => {
    const tool = defineTool({
      id: kind,
      ...(keybinding ? { keybinding } : {}),
      hookName: `use${kind[0].toUpperCase()}${kind.slice(1)}Tool`,
      capabilities: ['creates-shapes'],
      cursor: kind === 'puppet' ? 'crosshair' : 'default',
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
 * Distort the selected paths by their box's four corners, each dragged on its
 * own. The first drag gives the selection a distort, kept on each path as
 * `data.warp` until it is expanded (`expandWarp`); selecting the paths again
 * with this tool shows its corners where they were left. `configureWarp`
 * switches a held distort between free and perspective.
 */
export function useDistortTool(options: UseDistortToolOptions = {}): WarpTool {
  const { mode, tolerance } = options;
  return useWarpTool('distort', options, { mode, tolerance });
}

/**
 * Warp the selected paths through a mesh of control points over their box:
 * drag any point and the shape bends smoothly around it. The mesh is held on
 * each path until it is expanded, and `configureWarp` changes its grid or its
 * interpolation.
 */
export function useEnvelopeTool(options: UseEnvelopeToolOptions = {}): WarpTool {
  const { rows, cols, mapping, tolerance } = options;
  return useWarpTool('envelope', options, { rows, cols, mapping, tolerance });
}

/**
 * Pin the selected paths where they are clicked, and drag a pin to bend them:
 * the rest of the shape follows as rigidly as the pins allow, and a pin left
 * alone holds its place. Alt-click a pin to take it out. The pins are held on
 * each path until it is expanded.
 */
export function usePuppetTool(options: UsePuppetToolOptions = {}): WarpTool {
  return useWarpTool('puppet', options, { tolerance: options.tolerance });
}
