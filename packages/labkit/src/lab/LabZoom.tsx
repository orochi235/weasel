import {
  type Action,
  ActionDisabledReason,
  type ActionsRegistry,
  type ImmediateInvoker,
  makeViewportZoomAction,
  useActionsRegistry,
  useLatest,
  type ViewApi,
} from '@weasel-js/core';
import { Icon } from '@weasel-js/ui/components/Icon';
import { useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useStore } from 'zustand/react';
import type { CameraView } from '../canvas/CameraInput';
import { CameraRegistryContext } from '../canvas/cameraRegistry';
import { atScale, viewMiddle } from '../canvas/cameraZoom';
import { icon } from '../icons.gen';
import { formatShortcut } from '../passthrough/weasel-ui';
import { Toolbar } from '@weasel-js/ui/components/Toolbar';
import { LabStoreContext } from '../state/context';
import { LabActions, useInLabActions } from './LabActions';
import { useLabCommands } from './LabContext';

const ZOOM_ID = 'lab.zoom';

type ZoomKind = 'in' | 'out' | 'reset';

interface KeyBinding {
  spec: { kind: string; key?: string; mods?: { mod?: boolean; shift?: boolean | 'optional' } };
  opts?: { id?: string; params?: { kind?: string } };
}

// Core's zoom with only its keys: the wheel and pinch belong to each trial's
// own dispatcher. The clamp is left to the camera, which knows its range.
const BASE = makeViewportZoomAction({ min: 1e-9, max: Number.POSITIVE_INFINITY });
const KEY_BINDINGS = (BASE.defaultBinding as KeyBinding[])
  .filter((b) => b.spec.kind === 'key')
  .map((b) => ({ ...b, opts: { ...b.opts, id: `${ZOOM_ID}.${b.opts?.params?.kind}` } }));
const BASE_RUN = (BASE.invoker as ImmediateInvoker).run;
const VARIANTS = [
  { key: 'in', label: 'Zoom in', params: { kind: 'in' } },
  { key: 'out', label: 'Zoom out', params: { kind: 'out' } },
  { key: 'reset', label: 'Actual size', params: { kind: 'reset' } },
] as const;

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
 * focus. The percentage resets to actual size. They run `lab.zoom` — core's
 * zoom on the focused trial's camera, with its keys Mod+=, Mod+- and Mod+0 —
 * on the lab's actions registry, so the buttons and the keys are one path.
 * Outside a `<Lab>` it brings a registry of its own. Over a trial with no
 * camera the group stays, disabled, so the header does not reflow as the
 * focus moves.
 */
export function LabZoom() {
  if (useInLabActions()) return <LabZoomControls />;
  return (
    <LabActions>
      <LabZoomControls />
    </LabActions>
  );
}

function LabZoomControls() {
  const registry = useActionsRegistry() as ActionsRegistry;
  const { focusedTrialId } = useLabCommands();
  const cameras = useContext(CameraRegistryContext);
  const storeCtx = useContext(LabStoreContext);
  if (!storeCtx) throw new Error('[labkit] <LabZoom> requires <LabStoreProvider>');

  const camera = useSyncExternalStore(cameras?.subscribe ?? noSubscribe, () =>
    cameras && focusedTrialId ? cameras.get(focusedTrialId) : null,
  );
  const view = useStore(storeCtx.store, (s) => s.trials.find((t) => t.id === focusedTrialId)?.view);
  const zoom = camera?.zoomOf(view) ?? null;

  const live = zoom !== null && camera !== null;
  const zoomView = useMemo(() => (camera ? forZoom(camera) : null), [camera]);
  const viewRef = useLatest(live ? zoomView : null);

  useEffect(() => {
    const action: Action = {
      ...BASE,
      id: ZOOM_ID,
      requires: ['debug'],
      defaultBinding: KEY_BINDINGS as Action['defaultBinding'],
      variants: VARIANTS,
      enabled: () => (viewRef.current ? true : ActionDisabledReason.NotApplicable),
      invoker: {
        timing: 'immediate',
        run: (deps, params) => {
          const view = viewRef.current;
          if (view) BASE_RUN({ ...deps, view }, params);
        },
      },
    };
    return registry.register(action);
  }, [registry, viewRef]);

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
          <Icon name={icon('ui:zoomOut')} size={16} />
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
          <Icon name={icon('ui:zoomIn')} size={16} />
        </Toolbar.Button>
      </Toolbar.Group>
    </Toolbar>
  );
}

const noSubscribe = (): (() => void) => () => {};
