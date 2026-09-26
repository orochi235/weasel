import { useCallback, useMemo, useState } from 'react';
import {
  MinimapCanvas,
  PointerContextProvider,
  SceneCanvas,
  createMinimapContribution,
  useScene,
  useSelection,
  type SceneViewDrawOne,
} from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import type { View } from '@weasel-js/core';
import styles from './MinimapDemo.module.css';

interface NodeData { color: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const MAIN_W = 600, MAIN_H = 400;
const MINI_W = 200, MINI_H = 140;
/** The in-surface minimap: a view in the main canvas's top-right corner. */
const INSET = { x: MAIN_W - 168, y: 8, w: 160, h: 112 };

const COLORS: NodeData['color'][] = ['#7fb069', '#a48bd4', '#f0e0a8', '#e07a7a', '#5fb0c2'];

function makeRandomScene() {
  const items = [];
  for (let i = 0; i < 12; i++) {
    items.push({
      id: `n${i}` as never,
      kind: 'leaf' as const,
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

export function MinimapDemo() {
  const initial = useMemo(makeRandomScene, []);
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial,
  });
  const selection = useSelection();
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });
  // One entry installs the whole inset minimap: its view, its pan, the
  // visible-rect indicator and the linked crosshair. Built once — the entry
  // holds the state its layers read.
  const inset = useMemo(() => createMinimapContribution({ rect: INSET }), []);

  // Simplified drawOne for the minimap — AABB fill only, no chrome.
  // Demonstrates the spec's point that minimap drawOnes are typically a
  // stripped-down variant of the main canvas's.
  const minimapDrawOne = useCallback<SceneViewDrawOne<NodeData, LayerId, Pose>>(
    (n, p) => [{
      kind: 'path',
      path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
      fill: { fill: 'solid', color: n.data.color },
    }],
    [],
  );

  return (
    // One pointer store across both canvases, so each draws where the
    // pointer is on the other.
    <PointerContextProvider>
      <div className={styles.demo}>
        <div className={styles.header}>
          <span className={styles.viewLabel}>
            view: ({view.x.toFixed(0)}, {view.y.toFixed(0)}) ×{view.scale.x.toFixed(2)}
          </span>
          <button onClick={() => setView({ x: 0, y: 0, scale: { x: 1, y: 1 } })}>Reset</button>
          <span className={styles.hint}>
            press or drag either minimap to move the view · the crosshair follows the pointer across all three
          </span>
        </div>
        <div className={styles.row}>
          <SceneCanvas
            width={MAIN_W}
            height={MAIN_H}
            className="ckd-canvas"
            scene={scene}
            selection={selection}
            view={view}
            onViewChange={setView}
            viewport={{}}
            ambient={[inset]}
            layers={{
              scene: {
                drawOne: (n, p): DrawCommand[] => [{
                  kind: 'path',
                  path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
                  fill: { color: n.data.color },
                }],
              },
            }}
          />
          <aside className={styles.minimapPanel}>
            <div className={styles.minimapTitle}>
              Detached minimap
            </div>
            <MinimapCanvas
              scene={scene}
              mainView={view}
              mainViewDims={{ width: MAIN_W, height: MAIN_H }}
              onMainViewChange={setView}
              width={MINI_W}
              height={MINI_H}
              drawOne={minimapDrawOne}
              fit="scene"
              id="minimap-detached"
            />
          </aside>
        </div>
      </div>
    </PointerContextProvider>
  );
}
