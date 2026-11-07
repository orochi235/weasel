/**
 * The worker's half of the scene copy: a real `Scene`, brought to each delta the page sends,
 * so the worker walks and paints it exactly as the page would.
 */
import { sceneFromJSON } from '../../core/scene/scene';
import { reconcileSpecs } from '../../core/scene/reconcileSpecs';
import { specsFromSerialized } from '../../core/scene/serialization';
import type { AddNodeSpec, NodeId, Scene, SerializedLayer, SerializedScene } from '../../core/scene/types';
import type { SceneDelta, WireNode, WireOverride, WireScroll } from './protocol';

type AnyScene = Scene<unknown, string, unknown>;
type AnySpec = AddNodeSpec<unknown, string, unknown>;

/** What a worker's scene is built with beyond its saved form: the registry its node
 *  functions resolve against, and how poses compose. Match the page's scene. */
export type SceneMirrorOptions = NonNullable<Parameters<typeof sceneFromJSON<unknown, string, unknown>>[1]>;

export interface SceneMirror {
  /** The copy, or `null` before the first reset. */
  readonly scene: AnyScene | null;
  apply(delta: SceneDelta): void;
  setOverrides(entries: readonly WireOverride[]): void;
  setScroll(entries: readonly WireScroll[]): void;
}

export function createSceneMirror(options: SceneMirrorOptions = {}): SceneMirror {
  let scene: AnyScene | null = null;
  let layers: readonly SerializedLayer<string>[] = [];
  let nodes = new Map<string, WireNode>();
  let order: string[] = [];
  let specs = new Map<string, AnySpec>();
  let specList: AnySpec[] = [];

  const specsOf = (wire: readonly WireNode[]): AnySpec[] =>
    specsFromSerialized({ version: 3, systemLayers: layers, nodes: wire }, scene!.registry, options);

  const reset = (json: SerializedScene<unknown, string, unknown>): void => {
    layers = json.systemLayers;
    if (scene) scene.loadState(json);
    else scene = sceneFromJSON(json, options);
    nodes = new Map(json.nodes.map((n) => [n.id, n]));
    order = json.nodes.map((n) => n.id);
    specList = specsOf(json.nodes);
    specs = new Map(specList.map((s) => [s.id!, s]));
  };

  return {
    get scene() { return scene; },
    apply(delta) {
      if (delta.reset) return reset(delta.reset);
      if (!scene) throw new Error('weasel render worker: a scene delta arrived before the scene');
      for (const id of delta.removed ?? []) {
        nodes.delete(id);
        specs.delete(id);
      }
      const changed = delta.nodes ?? [];
      if (changed.length > 0) {
        const fresh = specsOf(changed);
        changed.forEach((n, i) => {
          nodes.set(n.id, n);
          specs.set(n.id, fresh[i]!);
        });
      }
      if (delta.order) order = delta.order;
      else if (delta.removed) order = order.filter((id) => nodes.has(id));
      const prev = specList;
      specList = order.map((id) => specs.get(id)!);
      reconcileSpecs(scene, prev, specList);
    },
    setScroll(entries) {
      if (!scene) return;
      scene.scroll.clearAll();
      for (const { id, ...offset } of entries) scene.scroll.set(id as NodeId, offset);
    },
    setOverrides(entries) {
      if (!scene) return;
      const { overrides } = scene;
      overrides.clearAll();
      for (const e of entries) {
        if (!scene.get(e.id as NodeId)) continue;
        const shown = e.data;
        overrides.set(e.id as NodeId, {
          ...(e.pose !== undefined ? { pose: e.pose } : {}),
          ...(e.alpha !== undefined ? { alpha: e.alpha } : {}),
          ...(e.path !== undefined ? { path: e.path as never } : {}),
          ...(e.shows ? { data: () => shown } : {}),
        });
      }
    },
  };
}

/** The scroll offsets a scene shows now, in the form they cross in. */
export function wireScroll(scene: AnyScene): WireScroll[] {
  const out: WireScroll[] = [];
  for (const id of scene.scroll.ids()) {
    const offset = scene.scroll.get(id);
    if (offset) out.push({ id, ...offset });
  }
  return out;
}

/** The pose overrides a scene shows now, in the form they cross in. */
export function wireOverrides(scene: AnyScene): WireOverride[] {
  const out: WireOverride[] = [];
  for (const id of scene.overrides.ids()) {
    const e = scene.overrides.read(id);
    const node = scene.get(id);
    if (!e || !node) continue;
    out.push({
      id,
      ...(e.pose !== undefined ? { pose: e.pose } : {}),
      ...(e.alpha !== undefined ? { alpha: e.alpha } : {}),
      ...(e.path !== undefined ? { path: e.path } : {}),
      ...(e.data ? { shows: true, data: e.data(node.data) } : {}),
    });
  }
  return out;
}
