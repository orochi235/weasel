import { useCallback, useMemo, useRef, useState } from 'react';
import { forceManyBody, forceLink, forceCollide, forceCenter } from 'd3-force';
import {
  SceneCanvas,
  defineTool,
  useScene,
  useSelection,
  useSimulation,
  ellipsePath,
  linePath,
  meanScale,
} from '@weasel-js/core';
import type {
  Action,
  AnyTool,
  InvocationCtx,
  NodeAtPointDep,
  OngoingHandle,
  RenderLayer,
  Simulation,
  SimulationNode,
  View,
} from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { bakeGraphPoses, syncGraphPoses } from './forceGraph/overrides';

const W = 600, H = 400;
const NODE_R = 8;
const NODE_COUNT = 24;
const LINK_COUNT = 30;

type LayerId = 'graph';
interface NodeData { group: number }
interface Pose { x: number; y: number; width: number; height: number }

interface GraphNode extends SimulationNode {
  id: string;
  group: number;
}
interface GraphLink {
  source: GraphNode | number | string;
  target: GraphNode | number | string;
}

const GROUP_COLORS = ['#e25c4c', '#4ca7e2', '#5cc46e', '#e2b34c', '#9c6cd4'];

function makeInitial(): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    nodes.push({
      id: `n${i}`,
      group: i % GROUP_COLORS.length,
      x: W / 2 + (Math.random() - 0.5) * 200,
      y: H / 2 + (Math.random() - 0.5) * 200,
    });
  }
  const seen = new Set<string>();
  const links: GraphLink[] = [];
  while (links.length < LINK_COUNT) {
    const a = Math.floor(Math.random() * NODE_COUNT);
    const b = Math.floor(Math.random() * NODE_COUNT);
    if (a === b) continue;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ source: nodes[a].id, target: nodes[b].id });
  }
  return { nodes, links };
}

/**
 * Edge layer: reads positions directly from the sim's nodes array (which the
 * forces mutate in place). Nodes themselves are rendered as scene leaves via
 * SceneCanvas's `scene` slot — so each sim tick that calls `scene.setPose`
 * triggers the canvas to redraw, which re-runs this layer's `draw`.
 */
function paintEdges(
  linksRef: { current: GraphLink[] },
): RenderLayer<unknown> {
  return {
    id: 'force-graph-edges',
    label: 'Edges',
    space: 'world',
    draw: (_data, v): DrawCommand[] => {
      const edgeW = 1 / meanScale(v.scale);
      const cmds: DrawCommand[] = [];
      for (const l of linksRef.current) {
        const src = typeof l.source === 'object' ? (l.source as GraphNode) : null;
        const tgt = typeof l.target === 'object' ? (l.target as GraphNode) : null;
        if (!src || !tgt) continue;
        cmds.push({
          kind: 'path',
          path: linePath({ x: src.x, y: src.y }, { x: tgt.x, y: tgt.y }),
          stroke: { paint: { color: '#aab' }, width: edgeW },
        });
      }
      return cmds;
    },
  };
}

/**
 * Drag-to-pin tool. A tool is a declarative shell: this one binds a body-drag
 * to `forceGraph.pin` and does nothing else — the dispatcher owns the gesture,
 * the action owns the effect.
 *
 * The hit comes from the `nodeAtPoint` dep, which `<SceneCanvas>` sources from
 * the same picker the select tool uses. Pinning writes `fx`/`fy` on the sim
 * node rather than the scene pose, because the sim owns positions here — the
 * tick loop is what syncs them back into the scene.
 */
function usePinTool(
  nodesRef: { current: GraphNode[] },
  sim: Simulation<GraphNode>,
  onPin: () => void,
): AnyTool {
  const pinAction = useMemo<Action>(() => ({
    id: 'forceGraph.pin',
    label: 'Pin graph node',
    requires: ['nodeAtPoint'],
    cursor: 'grab',
    activeCursor: 'grabbing',
    invoker: {
      timing: 'ongoing' as const,
      start(ctx: InvocationCtx): OngoingHandle {
        const nodeAtPoint = ctx.deps.nodeAtPoint as NodeAtPointDep | undefined;
        const id = nodeAtPoint?.(ctx.world) ?? null;
        const node = id === null ? undefined : nodesRef.current.find((n) => n.id === id);
        if (!node) return {};
        node.fx = node.x;
        node.fy = node.y;
        onPin();
        sim.alphaTarget(0.3).restart();
        return {
          kind: 'pin',
          onMove(move: InvocationCtx): void {
            node.fx = move.world.x;
            node.fy = move.world.y;
          },
          onEnd(): void {
            node.fx = null;
            node.fy = null;
            sim.alphaTarget(0);
          },
        };
      },
    },
  }), [nodesRef, sim, onPin]);

  return useMemo(() => defineTool<null>({
    id: 'pin',
    hookName: 'usePinTool',
    cursor: 'grab',
    presentation: { label: 'Pin', group: 'select' },
    actions: [pinAction],
    // Body target rather than a catch-all drag, so a drag on empty canvas
    // falls through to the ambient viewport pan instead of being swallowed.
    bindings: [{
      spec: {
        kind: 'drag',
        target: {
          kindOf: (_hit: unknown, body?: string) =>
            body === 'selected-body' || body === 'unselected-body',
        },
      },
      actionId: 'forceGraph.pin',
    }],
  }), [pinAction]);
}

export function ForceGraphDemo() {
  const initial = useMemo(makeInitial, []);
  const nodesRef = useRef<GraphNode[]>(initial.nodes);
  const linksRef = useRef<GraphLink[]>(initial.links);
  const [settled, setSettled] = useState(false);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  // Scene mirrors the sim's nodes: one leaf per graph node, pose = AABB around
  // the node center. The sim writes per-frame positions as ephemeral pose
  // overrides and bakes the settled layout into the document once.
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'graph' }],
    initial: initial.nodes.map((n) => ({
      id: n.id as never,
      kind: 'leaf' as const,
      layer: 'graph',
      pose: { x: n.x - NODE_R, y: n.y - NODE_R, width: NODE_R * 2, height: NODE_R * 2 },
      data: { group: n.group },
    })),
  });
  const selection = useSelection();

  const forces = useMemo(
    () => [
      forceManyBody<GraphNode>().strength(-80),
      forceLink<GraphNode, GraphLink>(linksRef.current)
        .id((n) => n.id)
        .distance(60)
        .strength(0.5),
      forceCollide<GraphNode>(NODE_R + 2),
      forceCenter<GraphNode>(W / 2, H / 2),
    ],
    [],
  );

  const sim = useSimulation<GraphNode>({
    nodes: nodesRef.current,
    forces,
    onTick: () => {
      // Per-frame positions are presentation, not a document edit: they go in
      // as ephemeral overrides, so a settle records nothing.
      syncGraphPoses(scene, nodesRef.current, NODE_R);
    },
    onEnd: () => {
      bakeGraphPoses(scene, nodesRef.current, NODE_R);
      setSettled(true);
    },
  });

  const unsettle = useCallback(() => setSettled(false), []);
  const pinTool = usePinTool(nodesRef, sim, unsettle);
  const tools = useMemo(() => ({ pin: pinTool }), [pinTool]);

  const edgesLayer = useMemo(
    () => paintEdges(linksRef),
    [],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => { setSettled(false); sim.alpha(1).restart(); }}>
          Reheat
        </button>
        <button onClick={() => {
          const fresh = makeInitial();
          nodesRef.current = fresh.nodes;
          linksRef.current = fresh.links;
          scene.overrides.clearAll();
          // Rebuild scene leaves to mirror the new nodes.
          for (const oldId of Array.from(scene.nodes.keys())) {
            scene.remove(oldId);
          }
          for (const n of fresh.nodes) {
            scene.add({
              id: n.id as never,
              kind: 'leaf',
              layer: 'graph',
              pose: { x: n.x - NODE_R, y: n.y - NODE_R, width: NODE_R * 2, height: NODE_R * 2 },
              data: { group: n.group },
            });
          }
          sim.setNodes(fresh.nodes);
          sim.setForces([
            forceManyBody<GraphNode>().strength(-80),
            forceLink<GraphNode, GraphLink>(linksRef.current)
              .id((n) => n.id)
              .distance(60)
              .strength(0.5),
            forceCollide<GraphNode>(NODE_R + 2),
            forceCenter<GraphNode>(W / 2, H / 2),
          ]);
          setSettled(false);
          sim.alpha(1).restart();
        }}>
          Regenerate
        </button>
        <button onClick={() => setView({ x: 0, y: 0, scale: { x: 1, y: 1 } })}>
          Reset view
        </button>
        <span style={{ fontFamily: 'monospace', color: '#555' }}>
          zoom {view.scale.x.toFixed(2)}× {settled ? '· settled' : ''}
        </span>
        <span style={{ color: '#888' }}>
          drag node to pin · ctrl/⌘+wheel zoom · wheel pan · H drag to pan · ⌘+0 reset
        </span>
      </div>
      <div style={{ display: 'inline-block' }}>
        <SceneCanvas
          width={W}
          height={H}
          className="ckd-canvas"
          scene={scene}
          selection={selection}
          selectionMode="none"
          // Only hand + pin: the default select/rotate affordances draw
          // cubic-Bezier handles, which overflow the flattener when poses
          // change every frame (see D3SortableDemo).
          defaultTools={['hand']}
          tools={tools}
          initialActiveTool="pin"
          view={view}
          onViewChange={setView}
          viewport={{}}
          layers={{
            scene: {
              drawOne: (n, p, v): DrawCommand[] => [{
                kind: 'path',
                path: ellipsePath(p),
                fill: { fill: 'solid', color: GROUP_COLORS[n.data.group] },
                stroke: { paint: { color: '#fff' }, width: 1.5 / meanScale(v.scale) },
              }],
            },
            selectionOverlay: { handles: false },
            edges: { layer: edgesLayer, before: 'scene' },
          }}
        />
      </div>
    </div>
  );
}
