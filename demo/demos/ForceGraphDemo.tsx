import React, { useMemo, useRef, useState } from 'react';
import { forceManyBody, forceLink, forceCollide, forceCenter } from 'd3-force';
import {
  SceneCanvas,
  useScene,
  useSelection,
  useHandTool,
  useSimulation,
  ellipsePath,
  linePath,
  meanScale,
} from '../../src';
import type { SimulationNode } from '../../src';
import type { View } from '../../src/core/viewport/view';
import type { RenderLayer } from '../../src/core/layers/render';
import type { DrawCommand } from '../../src/renderer';

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

export function ForceGraphDemo() {
  const initial = useMemo(makeInitial, []);
  const nodesRef = useRef<GraphNode[]>(initial.nodes);
  const linksRef = useRef<GraphLink[]>(initial.links);
  const draggingRef = useRef<string | null>(null);
  const [settled, setSettled] = useState(false);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });
  const viewRef = useRef(view);
  viewRef.current = view;

  // Scene mirrors the sim's nodes: one leaf per graph node, pose = AABB around
  // the node center. Sim writes positions via scene.setPose each tick;
  // SceneCanvas re-renders on scene mutations (no React-state churn from the
  // host component).
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
      // Sync sim positions into the scene. Wrap in a batch so the 24 setPose
      // calls coalesce into one history entry per tick — without batching,
      // a 5-second settle produces ~7000 undo entries (24 nodes × 60Hz × 5s).
      scene.batch('sim-tick', () => {
        for (const n of nodesRef.current) {
          scene.setPose(n.id as never, {
            x: n.x - NODE_R,
            y: n.y - NODE_R,
            width: NODE_R * 2,
            height: NODE_R * 2,
          });
        }
      });
    },
    onEnd: () => {
      setSettled(true);
    },
  });

  // Pointer handling on the stable wrapper for drag-to-pin.
  const containerRef = useRef<HTMLDivElement>(null);
  const screenToWorld = (cx: number, cy: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: cx, y: cy };
    const v = viewRef.current;
    return {
      x: (cx - rect.left) / v.scale.x + v.x,
      y: (cy - rect.top) / v.scale.y + v.y,
    };
  };
  const pickNode = (px: number, py: number): GraphNode | null => {
    const { x, y } = screenToWorld(px, py);
    let best: GraphNode | null = null;
    let bestDistSq = (NODE_R + 4) * (NODE_R + 4);
    for (const n of nodesRef.current) {
      const dx = n.x - x;
      const dy = n.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        best = n;
      }
    }
    return best;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const n = pickNode(e.clientX, e.clientY);
    if (!n) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = n.id;
    n.fx = n.x;
    n.fy = n.y;
    setSettled(false);
    sim.alphaTarget(0.3).restart();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const id = draggingRef.current;
    if (!id) return;
    const n = nodesRef.current.find((m) => m.id === id);
    if (!n) return;
    const w = screenToWorld(e.clientX, e.clientY);
    n.fx = w.x;
    n.fy = w.y;
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const id = draggingRef.current;
    if (!id) return;
    draggingRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
    const n = nodesRef.current.find((m) => m.id === id);
    if (n) {
      n.fx = null;
      n.fy = null;
    }
    sim.alphaTarget(0);
  };

  const edgesLayer = useMemo(
    () => paintEdges(linksRef),
    [],
  );

  // Wheel pan/zoom and keyboard zoom handled by viewport descriptors (Phase 8.5).
  const hand = useHandTool();
  const ambient = useMemo(
    () => [hand],
    [hand],
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
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ display: 'inline-block' }}
      >
        <SceneCanvas
          width={W}
          height={H}
          className="ckd-canvas"
          scene={scene}
          selection={selection}
          selectionMode="none"
          view={view}
          onViewChange={setView}
          ambient={ambient}
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
