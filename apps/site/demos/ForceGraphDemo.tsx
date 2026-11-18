import { integer, present } from '@weasel-js/quantity';
import { useCallback, useMemo, useRef, useState } from 'react';
import { SceneCanvas, bodyPredicate, defineTool, createDragPanContribution, useScene, ellipsePath, linePath, viewPreset } from '@weasel-js/core';
import type {
  Action,
  Tool,
  InvocationCtx,
  OngoingHandle,
  RenderLayer,
  View,
} from '@weasel-js/core';
import type { RunningSimulation } from '@weasel-js/simulation';
import { useSimulation } from '@weasel-js/simulation/react';
import type { DrawCommand } from '@weasel-js/renderer';
import {
  GRAPH_SIZES, graphForces, makeGraph, type GraphLink, type GraphNode, type GraphSize,
} from './forceGraph/graph';
import { Button } from '@weasel-js/ui/components/Button';
import { Select } from '@weasel-js/ui/components/Select';
import { bakeGraphPoses, syncGraphPoses } from './forceGraph/overrides';
import s from './ForceGraphDemo.module.css';
import { DemoStage } from './DemoStage';
import { useSelection } from '@weasel-js/editing';

const W = 600, H = 400;
const BOUNDS = { width: W, height: H };

type LayerId = 'graph';
interface NodeData { group: number }
interface Pose { x: number; y: number; width: number; height: number }

const GROUP_COLORS = ['#e25c4c', '#4ca7e2', '#5cc46e', '#e2b34c', '#9c6cd4'];

const PAN_ON_DRAG = [createDragPanContribution()];

const leafOf = (n: GraphNode, radius: number) => ({
  id: n.id as never,
  kind: 'mark' as const,
  layer: 'graph' as const,
  pose: { x: n.x - radius, y: n.y - radius, width: radius * 2, height: radius * 2 },
  data: { group: n.group },
});

/** Edges read the sim's nodes, which the forces mutate in place; the redraw a
 *  tick's pose overrides cause is what re-runs this. */
function paintEdges(
  linksRef: { current: GraphLink[] },
): RenderLayer<unknown> {
  return {
    id: 'force-graph-edges',
    label: 'Edges',
    space: 'world',
    draw: (): DrawCommand[] => {
      const cmds: DrawCommand[] = [];
      for (const l of linksRef.current) {
        const src = typeof l.source === 'object' ? (l.source as GraphNode) : null;
        const tgt = typeof l.target === 'object' ? (l.target as GraphNode) : null;
        if (!src || !tgt) continue;
        cmds.push({
          kind: 'path',
          path: linePath({ x: src.x, y: src.y }, { x: tgt.x, y: tgt.y }),
          stroke: { paint: { color: '#aab' }, width: { px: 1 } },
        });
      }
      return cmds;
    },
  };
}

/** Drag-to-pin. Pinning writes the sim node's `fx`/`fy`, not the scene pose:
 *  the sim owns positions, and its tick syncs them into the scene. */
function usePinTool(
  nodesRef: { current: GraphNode[] },
  sim: RunningSimulation<GraphNode>,
  onPin: () => void,
): Tool {
  const pinAction = useMemo<Action>(() => ({
    id: 'forceGraph.pin',
    label: 'Pin graph node',
    requires: ['nodeAtPoint'],
    cursor: 'grab',
    activeCursor: 'grabbing',
    invoker: {
      timing: 'ongoing' as const,
      start(ctx: InvocationCtx): OngoingHandle {
        const nodeAtPoint = ctx.deps.nodeAtPoint;
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

  return useMemo(() => defineTool({
    id: 'pin',
    hookName: 'usePinTool',
    cursor: 'grab',
    presentation: { label: 'Pin', group: 'select' },
    actions: [pinAction],
    // Body target rather than a catch-all drag, so a drag on empty canvas
    // falls through to the canvas's `createDragPanContribution` instead of being swallowed.
    bindings: [{
      spec: {
        kind: 'drag',
        target: {
          kindOf: bodyPredicate((body) =>
            body === 'selected-body' || body === 'unselected-body'),
        },
      },
      actionId: 'forceGraph.pin',
    }],
  }), [pinAction]);
}

export function ForceGraphDemo() {
  const [size, setSize] = useState<GraphSize>(GRAPH_SIZES[0]);
  const sizeRef = useRef(size);
  const [initial] = useState(() => makeGraph(GRAPH_SIZES[0], BOUNDS));
  const nodesRef = useRef<GraphNode[]>(initial.nodes);
  const linksRef = useRef<GraphLink[]>(initial.links);
  const [settled, setSettled] = useState(false);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'graph' }],
    initial: initial.nodes.map((n) => leafOf(n, GRAPH_SIZES[0].radius)),
  });
  const selection = useSelection({ scene });

  const [forces] = useState(() => graphForces(GRAPH_SIZES[0], initial.links, BOUNDS));

  const sim = useSimulation<GraphNode>({
    nodes: nodesRef.current,
    forces,
    onTick: () => {
      syncGraphPoses(scene, nodesRef.current, sizeRef.current.radius);
    },
    onEnd: () => {
      bakeGraphPoses(scene, nodesRef.current, sizeRef.current.radius);
      setSettled(true);
    },
  });

  /** Throw the graph away and settle a fresh one of `next` size. */
  const regenerate = (next: GraphSize): void => {
    const fresh = makeGraph(next, BOUNDS);
    nodesRef.current = fresh.nodes;
    linksRef.current = fresh.links;
    sizeRef.current = next;
    setSize(next);
    scene.overrides.clearAll();
    scene.removeMany([...scene.nodes.keys()]);
    for (const n of fresh.nodes) scene.add(leafOf(n, next.radius));
    sim.setNodes(fresh.nodes);
    sim.setForces(graphForces(next, fresh.links, BOUNDS));
    setSettled(false);
    sim.alpha(1).restart();
  };

  const unsettle = useCallback(() => setSettled(false), []);
  const pinTool = usePinTool(nodesRef, sim, unsettle);
  const tools = useMemo(() => ({ pin: pinTool }), [pinTool]);

  const edgesLayer = useMemo(
    () => paintEdges(linksRef),
    [],
  );

  return (
    <div className={s.stack}>
      <div className={s.controls}>
        <Select
          label="Nodes"
          orientation="row"
          width="fit"
          options={GRAPH_SIZES.map((g) => ({ value: String(g.count), label: present(g.count, integer()).text }))}
          selectedKey={String(size.count)}
          onSelectionChange={(count) => regenerate(GRAPH_SIZES.find((g) => String(g.count) === count)!)}
        />
        <Button onClick={() => { setSettled(false); sim.alpha(1).restart(); }}>Reheat</Button>
        <Button onClick={() => regenerate(size)}>Regenerate</Button>
        <Button onClick={() => setView({ x: 0, y: 0, scale: { x: 1, y: 1 } })}>Reset view</Button>
        <span className={s.readout}>
          {present(size.links, integer()).text} edges · zoom {view.scale.x.toFixed(2)}×{settled ? ' · settled' : ''}
        </span>
      </div>
      <div className={s.canvas}>
        <DemoStage width={W} height={H}>
          <SceneCanvas features={[viewPreset]}
            className="ckd-canvas"
            scene={scene}
            selection={selection}
            selectable={false}
            tools={tools}
            defaultActiveTool="pin"
            ambient={PAN_ON_DRAG}
            view={view}
            onViewChange={setView}
            layers={{
              scene: {
                drawOne: (n, p): DrawCommand[] => [{
                  kind: 'path',
                  path: ellipsePath(p),
                  fill: { paint: { kind: 'solid', color: GROUP_COLORS[n.data.group] } },
                  stroke: { paint: { color: '#fff' }, width: { px: Math.min(1.5, p.width / 8) } },
                }],
              },
              edges: { layer: edgesLayer, before: 'scene' },
            }}
          />
        </DemoStage>
      </div>
    </div>
  );
}
