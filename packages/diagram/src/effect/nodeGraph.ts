import type { DiagramRouter } from '../fromData';
import {
  boxNode, drawableWires, exitLabel, isControl, kindOf, sceneStyles, typeColors, uniqueGroups, uniqueStages,
  wireEdge, wireStyle, type EffectLook,
} from './draw';
import { branchNode, type BranchChoice } from './symbols';

/** Options for the `nodeGraph` look. */
export interface NodeGraphOptions {
  /** Default `'bezier'`. */
  router?: DiagramRouter;
  nodeGap?: number;
  rankGap?: number;
  /** A color per value type, over the palette's own. */
  colors?: Readonly<Record<string, string>>;
  /** Whether a stage lists its `params`. Default true. A decision's symbol
   *  does not show params either way. */
  showParams?: boolean;
  /** Default `'auto'`. */
  branch?: BranchChoice;
}

/** The node-graph look: every port a named row on its stage, a wire from port
 *  to port in the color of what it carries, flowing left to right. */
export const nodeGraph: EffectLook<NodeGraphOptions> = (pipeline, options = {}) => {
  const color = typeColors(pipeline, options.colors);
  const stages = uniqueStages(pipeline);
  const nodes = stages.map((stage) => (kindOf(stage) === 'decision'
    ? { id: stage.id, ...branchNode(stage, pipeline, options.branch) }
    : boxNode(stage, { showParams: options.showParams !== false, rowPorts: true, ports: [] })));
  const edges = drawableWires(pipeline).map((d) => ({
    edge: wireEdge(d.wire.from, d.wire.to, exitLabel(d)),
    style: wireStyle(color(d.type), isControl(pipeline, d.type), d.problem),
  }));

  return {
    data: { nodes, edges: edges.map((e) => e.edge), groups: uniqueGroups(pipeline) },
    scene: {
      layout: 'layered',
      layoutOptions: {
        direction: 'right',
        ...(options.nodeGap !== undefined ? { nodeGap: options.nodeGap } : {}),
        ...(options.rankGap !== undefined ? { rankGap: options.rankGap } : {}),
      },
      router: options.router ?? 'bezier',
      ...sceneStyles(stages, edges),
    },
    color,
  };
};
