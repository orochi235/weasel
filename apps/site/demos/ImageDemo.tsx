import { useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
  useImageTool,
  type ToolsApi,
} from '@weasel-js/core';
import { ToolPalette } from '@weasel-js/ui';

const W = 600, H = 400;

interface NodeData { image: { src: string } }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

// Embedded image data: a tiny SVG rendered to a `data:` URI. Because the whole
// image is a string, it lives directly on the node (`data.image.src`) and
// survives `scene.toJSON()` untouched — no external asset, no blob plumbing.
const swatch = (fill: string): string =>
  'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60">`
    + `<rect width="80" height="60" fill="${fill}"/>`
    + `<circle cx="40" cy="30" r="18" fill="#fff" opacity="0.85"/></svg>`,
  );

export function ImageDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      { id: 'img-a' as never, kind: 'leaf', layer: 'default',
        pose: { x: 60, y: 70, width: 160, height: 120 }, data: { image: { src: swatch('#7fb069') } } },
      { id: 'img-b' as never, kind: 'leaf', layer: 'default',
        pose: { x: 300, y: 150, width: 160, height: 120 }, data: { image: { src: swatch('#a48bd4') } } },
    ],
  });
  const selection = useSelection({ mode: 'multi' });

  // Image-insert tool: drag on empty space to drop another copy of this src.
  const imageTool = useImageTool({ src: swatch('#d4a574') });
  const [tools, setTools] = useState<ToolsApi | null>(null);

  return (
    <div className="ckd-shape-tools-demo">
      {tools && <ToolPalette tools={tools} orientation="horizontal" />}
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        selectionMode="multi"
        toolBundle="minimal"
        tools={{ image: imageTool }}
        onToolsCreated={setTools}
      />
    </div>
  );
}
