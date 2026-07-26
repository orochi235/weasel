import { useMemo, useRef, useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
  createGuidesLayer,
  deriveAlignmentGuides,
  alignMoveBehavior,
} from '@weasel-js/core';
import type { Guide, View } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';

interface NodeData { color: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 460, H = 320;
const PAGE = { x: 0, y: 0, width: W, height: H };

export function AlignmentGuidesDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      { id: 'a' as never, kind: 'leaf', layer: 'default', pose: { x: 60, y: 50, width: 90, height: 60 }, data: { color: '#7fb069' } },
      { id: 'b' as never, kind: 'leaf', layer: 'default', pose: { x: 300, y: 130, width: 80, height: 80 }, data: { color: '#d98f6f' } },
      { id: 'c' as never, kind: 'leaf', layer: 'default', pose: { x: 150, y: 230, width: 120, height: 50 }, data: { color: '#6f9fd9' } },
      { id: 'drag' as never, kind: 'leaf', layer: 'default', pose: { x: 200, y: 60, width: 70, height: 70 }, data: { color: '#b07fd0' } },
    ],
  });
  // Multi-select so shift-clicking several rects and dragging snaps the
  // selection's union box, not just one rect.
  const selection = useSelection({ mode: 'multi' });
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  // Active guides live in a ref so the layer reads them each draw without a
  // React re-render per pointer-move.
  const activeRef = useRef<readonly Guide[]>([]);

  const behaviors = useMemo(() => [
    alignMoveBehavior<Pose>({
      tolerance: 6,
      getView: () => view,
      // Derive from every node EXCEPT the one(s) being dragged, plus the page.
      getCandidates: () => {
        const dragged = new Set(selection.get());
        const targets = [...scene.nodes.values()]
          .filter((n) => !dragged.has(n.id))
          .map((n) => n.pose as Pose);
        return deriveAlignmentGuides(targets, { page: PAGE });
      },
      setActiveGuides: (g) => { activeRef.current = g; },
    }),
  ], [scene, selection, view]);

  const guidesLayer = useMemo(
    () => createGuidesLayer({ getGuides: () => activeRef.current, color: '#e0397f' }),
    [],
  );

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selection={selection}
      selectionMode="multi"
      selectTool={{ move: { behaviors } }}
      view={view}
      onViewChange={setView}
      viewport={{}}
      layers={{
        scene: {
          drawOne: (n, p): DrawCommand[] => [{
            kind: 'path',
            path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
            fill: { color: n.data.color },
          }],
        },
        guides: { layer: guidesLayer },
        selectionOverlay: { handles: false },
      }}
    />
  );
}
