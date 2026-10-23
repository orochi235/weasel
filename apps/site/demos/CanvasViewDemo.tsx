import { useState } from 'react';
import {
  CanvasView,
  PointerContextProvider,
  SceneCanvas,
  usePointerPosition,
  useScene,
  useSelection,
} from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import type { View } from '@weasel-js/core';
import styles from './CanvasViewDemo.module.css';
import { DemoStage } from './DemoStage';

interface NodeData { color: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 600, H = 400;

const COLORS: NodeData['color'][] = ['#7fb069', '#a48bd4', '#f0e0a8', '#e07a7a', '#5fb0c2'];
export function makeRandomScene() {
  const items = [];
  for (let i = 0; i < 12; i++) {
    items.push({
      id: `n${i}` as never,
      kind: 'mark' as const,
      layer: 'default' as LayerId,
      pose: {
        x: Math.random() * 1000 - 200,
        y: Math.random() * 800 - 100,
        width: 60 + Math.random() * 60,
        height: 60 + Math.random() * 60,
      },
      data: { color: COLORS[i % COLORS.length] },
    });
  }
  return items;
}

/** PiP geometry: a 240×160 screen rect at 1.6×, lensing a 150×100 world slice. */
export const PIP = { w: 240, h: 160, scale: 1.6, margin: 8 };

/** Inner view for the PiP, centered on the first node. Aiming it at a fixed
 *  world rect instead leaves it empty on about half of this demo's randomly
 *  placed scenes, which reads as a broken view rather than an empty one. */
export function pipView(items: ReturnType<typeof makeRandomScene>): View {
  const p = items[0]!.pose;
  return {
    x: p.x + p.width / 2 - PIP.w / PIP.scale / 2,
    y: p.y + p.height / 2 - PIP.h / PIP.scale / 2,
    scale: { x: PIP.scale, y: PIP.scale },
  };
}

/** The inset nested in the PiP, at twice the PiP's zoom on the PiP's center. */
const ZOOM = { w: 80, h: 60, margin: 6 };
function zoomInto(pip: View, pipSize: { width: number; height: number }): View {
  const scale = { x: pip.scale.x * 2, y: pip.scale.y * 2 };
  return {
    x: pip.x + pipSize.width / 2 / pip.scale.x - ZOOM.w / 2 / scale.x,
    y: pip.y + pipSize.height / 2 / pip.scale.y - ZOOM.h / 2 / scale.y,
    scale,
  };
}

const OVERVIEW: View = { x: -200, y: -100, scale: { x: 0.18, y: 0.18 } };

function PointerReadout() {
  const p = usePointerPosition();
  return (
    <span className={styles.readout}>
      {p ? `${p.viewId ?? 'canvas'} → (${p.worldX.toFixed(0)}, ${p.worldY.toFixed(0)})` : '—'}
    </span>
  );
}

export function CanvasViewDemo() {
  const [initial] = useState(makeRandomScene);
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial,
  });
  const selection = useSelection();
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  return (
    <PointerContextProvider>
      <div className={styles.demo}>
        <div className={styles.header}>
          <button onClick={() => setView({ x: 0, y: 0, scale: { x: 1, y: 1 } })}>Reset</button>
          <PointerReadout />
        </div>
        <DemoStage width={W} height={H}>
          <SceneCanvas
            features={['view', 'pick', 'move']}
            className="ckd-canvas"
            scene={scene}
            selection={selection}
            view={view}
            onViewChange={setView}
            layers={{
              scene: {
                drawOne: (n, p): DrawCommand[] => [{
                  kind: 'path',
                  path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
                  fill: { paint: { color: n.data.color } },
                }],
              },
            }}
          >
            {/* A second camera on the same scene. Input inside it routes
                through that camera: a click picks what it shows, a drag moves
                a node in its world units, and the wheel pans it alone. */}
            <CanvasView
              id="pip"
              bounds={(_outer, dims) => ({ x: PIP.margin, y: dims.height - PIP.h - PIP.margin, w: PIP.w, h: PIP.h })}
              defaultView={pipView(initial)}
              background="rgba(0,0,0,0.4)"
            />
            {/* Nested in the PiP: bounds are measured from the PiP's rect, the
                camera follows the PiP's as it pans, and a press inside lands
                in this view's world before the PiP's. */}
            <CanvasView
              id="pip-zoom"
              parent="pip"
              bounds={(_pip, size) => ({ x: size.width - ZOOM.w - ZOOM.margin, y: ZOOM.margin, w: ZOOM.w, h: ZOOM.h })}
              view={zoomInto}
              background="rgba(0,0,0,0.5)"
            />
            {/* Paint only: input over it reaches the canvas beneath. */}
            <CanvasView
              id="overview"
              interactive={false}
              bounds={(_outer, dims) => ({ x: dims.width - 188, y: 8, w: 180, h: 120 })}
              view={OVERVIEW}
              background="rgba(0,0,0,0.4)"
            />
          </SceneCanvas>
        </DemoStage>
      </div>
    </PointerContextProvider>
  );
}
