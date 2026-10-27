/**
 * `useSnapDepSource` — wires the `snap` dep whose `begin` every snapping
 * gesture runs: a session over the snap sources `session` names, writing its
 * marks to the outcome store this hook returns.
 */
import { useDepSource } from '@weasel-js/routing/react';
import { useKitSettings, useLatest } from '@weasel-js/react';
import type { DebugSink } from '@weasel-js/routing';
import type { SnapDep } from 'interactions/actions/snapDep';
import { ownGeometryAt } from 'domains/paths/pathSnap/pathSnapSource';
import type { View } from 'core/viewport/view';
import type { Scene } from 'core/scene/types';
import type { DrawnBoxes } from 'interactions/actions/drawnBoxes';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { OriginProjection } from 'interactions/gestures/shared/originProjection';
import type { SnapOutcomeStore } from 'domains/snap/outcomeStore';
import type { SnapSourceRegistry } from 'domains/snap/registry';
import { assertSnapSourceIds, snapSourcesFor } from 'domains/snap/gather';
import { sceneSession2d } from 'domains/snap/sceneSession2d';
import { DEFAULT_SNAP_PX } from 'domains/snap/session2d';
import type { SnapReadoutDep } from 'domains/snap/readoutDep';
import { rotationSnapSource } from 'domains/snap/rotationSource';
import { pathSnapSource } from 'domains/paths/pathSnap/pathSnapSource';
import type { SnapSource } from 'domains/snap/types';

type Point = { x: number; y: number };

/** What `begin` reads: the scene its probes come from and the sources it asks. */
export interface SnapSessionSources {
  scene: Scene<unknown, string, unknown>;
  /** The boxes the subject is drawn with, read when a session begins. */
  boxes: () => DrawnBoxes;
  /** `<SceneCanvas snap.sources>`, then the presets' `snapSources`. */
  sources: readonly SnapSource[];
  /** Sources `useSnapSource` adds, after `sources`. */
  registry?: SnapSourceRegistry;
  /** Ids of the canvas's default sources to leave out. */
  omit?: readonly string[];
  /** Overrides the kit setting `targets.snapPx`. */
  reachPx?: number;
  /** How a node's rotation is read, for angle targets. */
  poseDescriptor?: PoseDescriptor<unknown>;
  /** How a pose's origin is read, for the `origin` probe. */
  originProjection?: OriginProjection<unknown>;
  /** The canvas's debug sink, read when a session begins: each frame's
   *  candidates are recorded into it. */
  debug?: () => DebugSink | null | undefined;
}

/** The sources every canvas asks after its own, unless `omit` names one:
 *  quarter turns and other nodes' angles for a rotate, and other nodes'
 *  anchors for a point gesture, under `pathSnapSource`'s own id, so a
 *  consumer's `pathSnapSource()` takes its place. */
const DEFAULT_SNAP_SOURCES: readonly SnapSource[] = [
  rotationSnapSource(),
  { ...pathSnapSource({ only: ['anchor'] }), gestures: ['point'] },
];

/** `listed`, which must not repeat an id, then each default whose id is
 *  neither listed nor in `omit`. */
function withDefaults(listed: readonly SnapSource[], omit: readonly string[] = []): SnapSource[] {
  assertSnapSourceIds(listed);
  const taken = new Set([...listed.map((s) => s.id), ...omit]);
  return [...listed, ...DEFAULT_SNAP_SOURCES.filter((s) => !taken.has(s.id))];
}

export function useSnapDepSource(
  viewRef: React.RefObject<View | null>,
  session: SnapSessionSources,
  /** The canvas's outcome store, which its readout layer draws. */
  store: SnapOutcomeStore,
): SnapOutcomeStore {
  const sessionRef = useLatest(session);
  const kitSettings = useKitSettings();
  useDepSource('snapReadout', (): SnapReadoutDep => ({ store }));

  useDepSource('snap', (): SnapDep => ({
    begin: (req) => {
      const s = sessionRef.current;
      const view = viewRef.current;
      const omit = new Set(req.omit);
      const sources = [
        ...withDefaults([...s.sources, ...(s.registry?.list() ?? [])], s.omit).filter((src) => !omit.has(src.id)),
        ...(req.sources ?? []),
      ];
      assertSnapSourceIds(sources);
      const wantsGeometry = snapSourcesFor(sources, req.gesture).some((src) => src.roles.includes('geometry'));
      const debug = s.debug?.() ?? undefined;
      const reachPx = s.reachPx ?? kitSettings.get('targets.snapPx') ?? DEFAULT_SNAP_PX;
      return sceneSession2d({
        req,
        scene: s.scene,
        boxes: s.boxes(),
        sources,
        ...(wantsGeometry ? { geometryAt: (press: Point, ids: readonly string[]) => ownGeometryAt(s.scene, press, ids, view?.scale ?? { x: 1, y: 1 }, reachPx) } : {}),
        view: () => viewRef.current,
        reachPx,
        ...(s.poseDescriptor ? { poseDescriptor: s.poseDescriptor } : {}),
        ...(s.originProjection ? { originProjection: s.originProjection } : {}),
        ...(debug ? { debug } : {}),
        store,
      });
    },
  }));
  return store;
}
