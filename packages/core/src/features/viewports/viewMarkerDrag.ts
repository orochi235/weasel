import { hitPredicate } from '@weasel-js/gestures';
import type { Action, InvocationCtx } from '@weasel-js/routing';
import type { SurfaceContribution } from 'canvas/surfaceContribution';
import type { ViewMarkerGrab } from './viewMarker';

/** The action id a drag on a view marker routes to. */
export const VIEW_MARKER_DRAG = 'view.marker.drag';

/** The id of the entry {@link createViewMarkerContribution} builds. */
export const VIEW_MARKER_ENTRY_ID = 'view-marker';

const MARKER_KIND_PREFIX = 'layer:view-marker:';

function grabIn(affordance: unknown): ViewMarkerGrab | null {
  return (affordance as { payload?: ViewMarkerGrab } | null | undefined)?.payload ?? null;
}

/** Drags the grabbed marker. There is nothing to commit, so a cancel ends where a release does. */
export function viewMarkerDragAction(): Action {
  return {
    id: VIEW_MARKER_DRAG,
    label: 'View marker — drag',
    invoker: {
      timing: 'ongoing',
      start: (ctx: InvocationCtx) => {
        const grab = grabIn(ctx.drag?.affordance);
        if (!grab) return {};
        return {
          kind: VIEW_MARKER_DRAG,
          onMove: (m: InvocationCtx) => { grab.moveTo(m.drag?.current ?? m.world); },
        };
      },
    },
  };
}

/**
 * The always-on entry (id `'view-marker'`) that binds a drag on any marker to {@link VIEW_MARKER_DRAG}.
 * A `<SceneCanvas>` installs it unless `actions={null}` or a `tools` takeover leaves it out; to turn marker
 * dragging back on there, pass it in `ambient`, or in the takeover's own `useTools` ambient list.
 */
export function createViewMarkerContribution(): SurfaceContribution {
  return {
    id: VIEW_MARKER_ENTRY_ID,
    eligibility: { always: true },
    actions: [viewMarkerDragAction()],
    bindings: [{
      spec: {
        kind: 'drag',
        target: { kindOf: hitPredicate((hit) => (hit as { kind?: string } | null | undefined)?.kind?.startsWith(MARKER_KIND_PREFIX) ?? false) },
      },
      actionId: VIEW_MARKER_DRAG,
      opts: { id: 'view-marker.drag' },
    }],
  };
}
