import {
  createPathSnapIndex, type Path, type PathSnapIndex, type PathSnapTarget,
} from '@weasel-js/geom';
import type { Scene } from 'core/scene/types';
import { isAnnotationLayer } from 'core/scene/annotation';
import { nodeGates } from 'core/scene/nodeGates';
import type { SnapGeometry } from 'interactions/actions/snapDep';
import { nodeSnapGeometry } from './snapGeometry';

type SnapScene = Pick<Scene<unknown, string, unknown>, 'nodes' | 'layers' | 'getVersion'>;

/** A scene's paths indexed for snapping; `ids[i]` is the node path `i` came
 *  from, or null for a path of the query's own (`also`). */
export interface SceneSnapIndex {
  ids: (string | null)[];
  index: PathSnapIndex;
}

/** Indexes every leaf of `scene` with geometry (`nodeSnapGeometry`), but
 *  hidden ones (`nodeGates`) and those on an annotation layer, once per scene
 *  version, and again when a query brings geometry of its own. The scene
 *  alone and the scene with the last `also` are cached apart, so a query
 *  without geometry does not evict a gesture's. */
export function createSceneSnapIndexer(scene: SnapScene): (also?: SnapGeometry) => SceneSnapIndex {
  type Slot = { version: number; layers: unknown; also: SnapGeometry | undefined; built: SceneSnapIndex };
  const slots: { bare: Slot | null; also: Slot | null } = { bare: null, also: null };
  return (also) => {
    const version = scene.getVersion();
    const layers = scene.layers;
    const key = also ? 'also' : 'bare';
    const cached = slots[key];
    if (cached?.version === version && cached.layers === layers && cached.also === also) return cached.built;
    const notes = new Set(layers.filter(isAnnotationLayer).map((l) => l.id));
    const gates = nodeGates({ layers, get: (id) => scene.nodes.get(id) });
    const ids: (string | null)[] = [];
    const paths: Path[] = [];
    const extra: PathSnapTarget[] = [];
    for (const node of scene.nodes.values()) {
      if (node.kind !== 'mark' || notes.has(node.layer) || gates.hidden(node.id)) continue;
      const g = nodeSnapGeometry(node);
      if (!g) continue;
      for (const p of g.points) extra.push({ ...p, paths: [paths.length] });
      ids.push(node.id);
      paths.push(g.path);
    }
    for (const path of also?.paths ?? []) { ids.push(null); paths.push(path); }
    if (also?.anchors) {
      ids.push(null);
      for (const p of also.anchors) extra.push({ kind: 'anchor', x: p.x, y: p.y, paths: [paths.length] });
      paths.push({ kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' });
    }
    const built = { ids, index: createPathSnapIndex(paths, extra) };
    slots[key] = { version, layers, also, built };
    return built;
  };
}

const indexers = new WeakMap<object, ReturnType<typeof createSceneSnapIndexer>>();

/** {@link createSceneSnapIndexer}, one per scene, so every source over a
 *  scene shares its index. */
export function sceneSnapIndex(scene: SnapScene, also?: SnapGeometry): SceneSnapIndex {
  let indexer = indexers.get(scene);
  if (!indexer) indexers.set(scene, (indexer = createSceneSnapIndexer(scene)));
  return indexer(also);
}
