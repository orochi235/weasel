/** The answer to each devtools read, for one root. Steering requests live in the session, which owns the override. */
import type { Node, NodeId, Scene } from 'core/scene/types';
import type { DebugConfig } from '../debug/types';
import type { DevtoolsRoot } from './root';
import type {
  DevtoolsNodeDetail, DevtoolsNodeSummary, DevtoolsOverlays, DevtoolsRootState, DevtoolsTraceSlice,
} from './protocol';
import { serialize } from './serialize';

type AnyScene = Scene<unknown, string, unknown>;
type AnyNode = Node<unknown, string, unknown>;

function sceneOf(root: DevtoolsRoot): AnyScene {
  const scene = root.source.scene();
  if (!scene) throw new Error('scene not mounted yet');
  return scene;
}

function summaryOf(node: AnyNode): DevtoolsNodeSummary {
  return {
    id: node.id,
    kind: node.kind,
    layer: node.layer,
    childCount: node.kind === 'container' ? node.children.length : 0,
    hidden: node.hidden === true,
    locked: node.locked === true,
    pickable: node.pickable !== false,
  };
}

function nodeOf(scene: AnyScene, id: string): AnyNode {
  const node = scene.get(id as NodeId);
  if (!node) throw new Error(`no node "${id}"`);
  return node;
}

export function childrenOf(root: DevtoolsRoot, nodeId: string | undefined): DevtoolsNodeSummary[] {
  const scene = sceneOf(root);
  const ids = nodeId === undefined ? scene.roots : (nodeOf(scene, nodeId), scene.childrenOf(nodeId as NodeId));
  return ids.map((id) => summaryOf(nodeOf(scene, id)));
}

export function nodeDetail(root: DevtoolsRoot, nodeId: string): DevtoolsNodeDetail {
  const node = nodeOf(sceneOf(root), nodeId);
  return {
    ...summaryOf(node),
    parent: node.parent ?? null,
    pose: serialize(node.pose),
    data: serialize(node.data),
  };
}

/** The on/off features of a debug config, leaving out its theme and strokes. */
export function overlayFlags(config: DebugConfig | null): DevtoolsOverlays {
  const flags: DevtoolsOverlays = {};
  if (!config) return flags;
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'boolean') (flags as Record<string, boolean>)[key] = value;
  }
  return flags;
}

export function rootState(root: DevtoolsRoot): DevtoolsRootState {
  const { source } = root;
  const probes: DevtoolsRootState['probes'] = {};
  for (const [name, read] of root.probes) {
    try {
      probes[name] = serialize(read());
    } catch (err) {
      probes[name] = `[threw: ${(err as Error).message}]`;
    }
  }
  return {
    selection: [...source.selection()],
    view: serialize(source.view()),
    activeTool: source.activeTool(),
    tools: [...source.tools()],
    overlays: overlayFlags(source.overlays()),
    probes,
  };
}

export function traceSlice(root: DevtoolsRoot, cursor: number, coordCursor: number | undefined): DevtoolsTraceSlice {
  const { trace, coords } = root.source;
  const slice = trace.since(cursor);
  const out: DevtoolsTraceSlice = {
    entries: slice.entries.map((e) => serialize(e)),
    cursor: slice.cursor,
    live: serialize(trace.live()),
  };
  if (coordCursor !== undefined) {
    const c = coords.since(coordCursor);
    out.coords = { entries: c.entries.map((e) => serialize(e)), cursor: c.cursor };
  }
  return out;
}
