/**
 * `useSnapDepSource` — wires the `snap` dep whose `begin` every snapping
 * gesture runs: a session over the snap sources `session` names, writing its
 * marks to the outcome store this hook returns.
 *
 * `point` / `toTargets` are the deprecated `<SceneCanvas toolOptions={{
 * pathSnap, snapTargets, snapPoint }} />`, which no kit action calls any more.
 *
 * Always registered (hooks can't be conditional); with neither source the
 * dep's `point` is the identity function, which is the same behavior actions
 * fall back to when the dep is absent entirely.
 */
import { useDepSource } from '@weasel-js/routing/react';
import { useKitSettings, useLatest } from '@weasel-js/react';
import type { SnapDep, SnapQuery } from 'interactions/actions/snapDep';
import type { PathSnapper } from 'features/paths/pathSnap/pathSnapper';
import { ownGeometryAt } from 'features/paths/pathSnap/pathSnapSource';
import type { View } from 'core/viewport/view';
import type { Scene } from 'core/scene/types';
import type { DrawnBoxes } from 'interactions/actions/drawnBoxes';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { SnapOutcomeStore } from 'features/snap/outcomeStore';
import type { SnapSourceRegistry } from 'features/snap/registry';
import { sceneSession2d } from 'features/snap/sceneSession2d';
import { DEFAULT_SNAP_PX } from 'features/snap/session2d';
import type { SnapReadoutDep } from 'features/snap/readoutDep';
import { rotationSnapSource } from 'features/snap/rotationSource';
import { pathSnapSource } from 'features/paths/pathSnap/pathSnapSource';
import type { SnapSource } from 'features/snap/types';

type Point = { x: number; y: number };

/** Where the `snap` dep's answers come from. */
export interface SnapSources {
  /** `toolOptions.snapPoint`: any rule over a point, applied when no path
   *  target is in range. */
  snapPoint?: (p: Point) => Point;
  /** `toolOptions.snapTargets`: points to lock to besides the scene's paths. */
  targets?: (p: Point, at?: SnapQuery) => Point | null;
  /** The canvas's path snapper, configured from `toolOptions.pathSnap`. */
  paths?: PathSnapper;
}

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
}

/** The sources every canvas asks after its own, unless `omit` names one:
 *  quarter turns and other nodes' angles for a rotate, and other paths'
 *  anchors for a point gesture (`'path-anchors'`). */
const DEFAULT_SNAP_SOURCES: readonly SnapSource[] = [
  rotationSnapSource(),
  { ...pathSnapSource({ only: ['anchor'] }), id: 'path-anchors', gestures: ['point'] },
];

/** `listed`, one source per id (the last one listed, where it stands),
 *  then each default whose id is neither listed nor in `omit`. */
function withDefaults(listed: readonly SnapSource[], omit: readonly string[] = []): SnapSource[] {
  const last = new Map(listed.map((s, i) => [s.id, i]));
  const taken = new Set([...last.keys(), ...omit]);
  return [...listed.filter((s, i) => last.get(s.id) === i), ...DEFAULT_SNAP_SOURCES.filter((s) => !taken.has(s.id))];
}

export function useSnapDepSource(
  sources: SnapSources,
  viewRef: React.RefObject<View | null>,
  session: SnapSessionSources | undefined,
  /** The canvas's outcome store, which its readout layer draws. */
  store: SnapOutcomeStore,
): SnapOutcomeStore {
  const ref = useLatest(sources);
  const sessionRef = useLatest(session);
  const kitSettings = useKitSettings();
  useDepSource('snapReadout', (): SnapReadoutDep => ({ store }));

  useDepSource('snap', (): SnapDep => {
    // A query naming `include` asks for those nodes' geometry, which no
    // free-standing target is.
    const toTargets: NonNullable<SnapDep['toTargets']> = (p, at) =>
      ref.current.paths?.snap(p, at, viewRef.current?.scale ?? { x: 1, y: 1 })
        ?? (at?.include ? null : ref.current.targets?.(p, at))
        ?? null;
    const s = sessionRef.current;
    return {
      point: (p, at) => toTargets(p, at) ?? ref.current.snapPoint?.(p) ?? p,
      toTargets,
      release: () => ref.current.paths?.release(),
      ...(s ? {
        begin: (req) => {
          const view = viewRef.current;
          const sources = withDefaults([...s.sources, ...(s.registry?.list() ?? [])], s.omit);
          const wantsGeometry = sources.some((src) => src.roles.includes('geometry'));
          return sceneSession2d({
            req,
            scene: s.scene,
            boxes: s.boxes(),
            sources,
            ...(wantsGeometry ? { geometryAt: (press: Point, ids: readonly string[]) => ownGeometryAt(s.scene, press, ids, view?.scale ?? { x: 1, y: 1 }) } : {}),
            view: () => viewRef.current,
            reachPx: s.reachPx ?? kitSettings.get('targets.snapPx') ?? DEFAULT_SNAP_PX,
            ...(s.poseDescriptor ? { poseDescriptor: s.poseDescriptor } : {}),
            store,
            onEnd: () => ref.current.paths?.release(),
          });
        },
      } : {}),
    };
  });
  return store;
}
