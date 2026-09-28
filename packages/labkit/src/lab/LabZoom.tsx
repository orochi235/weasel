import {
  type Action,
  ActionDisabledReason,
  ActionsProvider,
  type ActionsRegistry,
  ActiveToolContextProvider,
  DepRegistryProvider,
  makeViewportZoomAction,
  type Tool,
  useActionsRegistry,
  useDepSource,
  useGestureDispatcher,
  type ViewApi,
} from '@weasel-js/core';
import { ZoomInIcon, ZoomOutIcon } from '@weasel-js/ui';
import { useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useStore } from 'zustand/react';
import type { CameraView } from '../canvas/CameraInput';
import { CameraRegistryContext } from '../canvas/cameraRegistry';
import { atScale, viewMiddle } from '../canvas/cameraZoom';
import { formatShortcut } from '../passthrough/weasel-ui';
import { Toolbar } from '../primitives/Toolbar';
import { LabStoreContext } from '../state/context';
import { as2DView } from '../state/view';
import { useLabContext } from './LabContext';

const ZOOM_ID = 'viewport.zoom';
const NO_TOOLS: ReadonlyMap<string, Tool> = new Map();
const CHANNELS = { contextMenu: false, ingest: false } as const;
const NO_ELEMENT = { current: null };

type ZoomKind = 'in' | 'out' | 'reset';

interface KeyBinding {
  spec: { kind: string; key?: string; mods?: { mod?: boolean; shift?: boolean | 'optional' } };
  opts?: { params?: { kind?: string } };
}

// Core's zoom with only its keys: the wheel and pinch belong to each trial's
// own dispatcher. The clamp is left to the camera, which knows its range.
const BASE = makeViewportZoomAction({ min: 1e-9, max: Number.POSITIVE_INFINITY });
const KEY_BINDINGS = (BASE.defaultBinding as KeyBinding[]).filter((b) => b.spec.kind === 'key');

function shortcutFor(kind: ZoomKind): string | undefined {
  const spec = KEY_BINDINGS.find((b) => b.opts?.params?.kind === kind)?.spec;
  return spec?.key ? formatShortcut({ key: spec.key, mod: spec.mods?.mod }) : undefined;
}

/** The focused trial's camera, with the zoom's reset meaning actual size about
 *  the middle of the view. */
function forZoom(camera: CameraView): ViewApi {
  return {
    get: camera.get,
    set: camera.set,
    hostSize: camera.hostSize,
    recenter: () => atScale(camera.get(), 1, viewMiddle(camera)),
  };
}

const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });

/**
 * Zoom out, the zoom as a percentage, and zoom in, for whichever trial has the
 * focus. The percentage resets to actual size. They route through core's
 * `viewport.zoom` action, on a dispatcher of their own that listens for its
 * keys — Mod+=, Mod+- and Mod+0 — so the buttons and the keys are one path.
 * Over a trial with no camera the group stays, disabled, so the header does not
 * reflow as the focus moves.
 */
export function LabZoom() {
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>
          <LabZoomControls />
        </ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>
  );
}

function LabZoomControls() {
  const registry = useActionsRegistry() as ActionsRegistry;
  const { focusedTrialId } = useLabContext();
  const cameras = useContext(CameraRegistryContext);
  const storeCtx = useContext(LabStoreContext);
  if (!storeCtx) throw new Error('[labkit] <LabZoom> requires <LabStoreProvider>');

  const camera = useSyncExternalStore(cameras?.subscribe ?? noSubscribe, () =>
    cameras && focusedTrialId ? cameras.get(focusedTrialId) : null,
  );
  const zoom = useStore(storeCtx.store, (s) => {
    const record = s.trials.find((t) => t.id === focusedTrialId);
    return as2DView(record?.view)?.zoom ?? null;
  });

  const live = zoom !== null && camera !== null;
  const view = useMemo(() => (camera ? forZoom(camera) : null), [camera]);
  const viewRef = useRef(view);
  viewRef.current = live ? view : null;

  useDepSource('view', () => viewRef.current as ViewApi);

  useEffect(() => {
    const action: Action = {
      ...BASE,
      defaultBinding: KEY_BINDINGS as Action['defaultBinding'],
      enabled: () => (viewRef.current ? true : ActionDisabledReason.NotApplicable),
    };
    return registry.register(action);
  }, [registry]);

  // First, so a story's own zoom keys do not also fire over a trial with a
  // camera; over one without, the action is disabled and the keys pass on.
  useGestureDispatcher({
    canvasRef: NO_ELEMENT,
    actions: registry,
    toolsById: NO_TOOLS,
    channels: CHANNELS,
    keyboard: 'first',
  });

  const range = camera?.zoomRange();
  // A step that lands within rounding of a limit has reached it.
  const canIn = zoom !== null && range !== undefined && zoom < range.max * (1 - 1e-9);
  const canOut = zoom !== null && range !== undefined && zoom > range.min * (1 + 1e-9);
  const run = (kind: ZoomKind) => () => {
    registry.trigger(ZOOM_ID, { kind });
  };
  const hint = (label: string, kind: ZoomKind): string => {
    const keys = shortcutFor(kind);
    return keys ? `${label} (${keys})` : label;
  };
  const shown = live && zoom !== null ? percent.format(zoom) : null;

  return (
    <Toolbar aria-label="Zoom">
      <Toolbar.Group aria-label="Zoom">
        <Toolbar.Button
          iconOnly
          aria-label="Zoom out"
          title={hint('Zoom out', 'out')}
          disabled={!canOut}
          onClick={run('out')}
        >
          <ZoomOutIcon size={16} />
        </Toolbar.Button>
        <Toolbar.Button
          aria-label={shown ? `Zoom ${shown} — reset to actual size` : 'Zoom unavailable'}
          title={live ? hint('Actual size', 'reset') : 'This trial has no camera'}
          disabled={!live}
          onClick={run('reset')}
        >
          <span className="lk-lab-zoom__readout">{shown ?? '–'}</span>
        </Toolbar.Button>
        <Toolbar.Button
          iconOnly
          aria-label="Zoom in"
          title={hint('Zoom in', 'in')}
          disabled={!canIn}
          onClick={run('in')}
        >
          <ZoomInIcon size={16} />
        </Toolbar.Button>
      </Toolbar.Group>
    </Toolbar>
  );
}

const noSubscribe = (): (() => void) => () => {};
