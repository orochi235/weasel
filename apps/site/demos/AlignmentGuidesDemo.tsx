import { useMemo, useRef, useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
  rectPath,
  solid,
} from '@weasel-js/core';
import { alignInsertBehavior, alignMoveBehavior, createGuidesLayer, deriveAlignmentGuides } from '@weasel-js/guides';
import type { Guide, SpacingGap } from '@weasel-js/guides';
import type { FillStyle, NodeId, Path, ToolsApi } from '@weasel-js/core';
import { ToolPalette } from '@weasel-js/ui';

// The same `{ path, fill }` shape the rect tool's insert dep mints, so the
// kit's path painter draws both without a custom drawOne.
interface NodeData { path: Path; fill: FillStyle }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 460, H = 320;
const PAGE = { x: 0, y: 0, width: W, height: H };

const rect = (id: string, pose: Pose, color: string) => ({
  id: id as NodeId, kind: 'leaf' as const, layer: 'default' as const, pose,
  data: { path: rectPath(0, 0, pose.width, pose.height), fill: solid(color) },
});

export function AlignmentGuidesDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      rect('a', { x: 30, y: 50, width: 70, height: 60 }, '#7fb069'),
      rect('d', { x: 140, y: 40, width: 50, height: 60 }, '#d9c36f'),
      rect('b', { x: 300, y: 130, width: 80, height: 80 }, '#d98f6f'),
      rect('c', { x: 150, y: 230, width: 120, height: 50 }, '#6f9fd9'),
      rect('drag', { x: 240, y: 60, width: 70, height: 70 }, '#b07fd0'),
    ],
  });
  // Multi-select so shift-clicking several rects and dragging snaps the
  // selection's union box, not just one rect.
  const selection = useSelection({ mode: 'multi' });
  const [tools, setTools] = useState<ToolsApi | null>(null);

  // Active guides live in a ref so the layer reads them each draw without a
  // React re-render per pointer-move.
  const activeRef = useRef<readonly Guide[]>([]);
  const gapsRef = useRef<readonly SpacingGap[]>([]);

  const { selectTool, toolOptions } = useMemo(() => {
    const setActiveGuides = (g: readonly Guide[]) => { activeRef.current = g; };
    const setActiveGaps = (g: readonly SpacingGap[]) => { gapsRef.current = g; };
    const poses = (exclude: ReadonlySet<NodeId>) =>
      [...scene.nodes.values()].filter((n) => !exclude.has(n.id)).map((n) => n.pose as Pose);
    // Candidates come from every node not in `exclude`, plus the page.
    const candidates = (exclude: ReadonlySet<NodeId>) => deriveAlignmentGuides(poses(exclude), { page: PAGE });
    return {
      selectTool: { move: { behaviors: [alignMoveBehavior<Pose>({
        tolerance: 6,
        getCandidates: () => candidates(new Set(selection.get())),
        setActiveGuides,
        // Equal-spacing snaps measure the gaps between the same siblings.
        getSpacingTargets: () => poses(new Set(selection.get())),
        setActiveGaps,
      })] } },
      // The rect being drawn is not in the scene yet, so every node counts.
      toolOptions: { insert: { behaviors: [alignInsertBehavior({
        tolerance: 6,
        getCandidates: () => candidates(new Set()),
        setActiveGuides,
      })] } },
    };
  }, [scene, selection]);

  const guidesLayer = useMemo(
    () => createGuidesLayer({ getGuides: () => activeRef.current, getGaps: () => gapsRef.current, color: '#e0397f' }),
    [],
  );

  return (
    <div className="ckd-shape-tools-demo">
      {tools && <ToolPalette tools={tools} orientation="horizontal" />}
      <SceneCanvas features={['pick', 'move']}
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        selectTool={selectTool}
        defaultTools={['rect']}
        toolOptions={toolOptions}
        onToolsCreated={setTools}
        viewport={{}}
        layers={{ guides: { layer: guidesLayer } }}
      />
    </div>
  );
}
