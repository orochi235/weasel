import { useMemo, useRef, useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
  createGuidesLayer,
  deriveAlignmentGuides,
  alignMoveBehavior,
  alignInsertBehavior,
  rectPath,
  solid,
} from '@weasel-js/core';
import type { FillStyle, Guide, NodeId, Path, ToolsApi } from '@weasel-js/core';
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
      rect('a', { x: 60, y: 50, width: 90, height: 60 }, '#7fb069'),
      rect('b', { x: 300, y: 130, width: 80, height: 80 }, '#d98f6f'),
      rect('c', { x: 150, y: 230, width: 120, height: 50 }, '#6f9fd9'),
      rect('drag', { x: 200, y: 60, width: 70, height: 70 }, '#b07fd0'),
    ],
  });
  // Multi-select so shift-clicking several rects and dragging snaps the
  // selection's union box, not just one rect.
  const selection = useSelection({ mode: 'multi' });
  const [tools, setTools] = useState<ToolsApi | null>(null);

  // Active guides live in a ref so the layer reads them each draw without a
  // React re-render per pointer-move.
  const activeRef = useRef<readonly Guide[]>([]);

  // Keyed on `selection.get`: the selection object is new each render, and
  // rebuilt tools would loop through onToolsCreated -> setTools.
  const getSelection = selection.get;
  const { selectTool, toolOptions } = useMemo(() => {
    const setActiveGuides = (g: readonly Guide[]) => { activeRef.current = g; };
    // Candidates come from every node not in `exclude`, plus the page.
    const candidates = (exclude: ReadonlySet<NodeId>) => deriveAlignmentGuides(
      [...scene.nodes.values()].filter((n) => !exclude.has(n.id)).map((n) => n.pose as Pose),
      { page: PAGE },
    );
    return {
      selectTool: { move: { behaviors: [alignMoveBehavior<Pose>({
        tolerance: 6,
        getCandidates: () => candidates(new Set(getSelection())),
        setActiveGuides,
      })] } },
      // The rect being drawn is not in the scene yet, so every node counts.
      toolOptions: { insert: { behaviors: [alignInsertBehavior({
        tolerance: 6,
        getCandidates: () => candidates(new Set()),
        setActiveGuides,
      })] } },
    };
  }, [scene, getSelection]);

  const guidesLayer = useMemo(
    () => createGuidesLayer({ getGuides: () => activeRef.current, color: '#e0397f' }),
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
