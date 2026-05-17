import { useEffect, useMemo, useRef, useState } from 'react';
import { d3Bind } from '@orochi235/weasel-d3';
import {
  SceneCanvas,
  useScene,
  useSelection,
  useAnimator,
  easeInOutCubic,
} from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';

const W = 600, H = 400;
const BAR_W = 40, BAR_STRIDE = 45, ORIGIN_X = 30;
const BASELINE_Y = 350;
const VALUE_SCALE = 22;

interface Item {
  id: string;
  value: number;
  hue: number;
}
type LayerId = 'bars';
interface Pose { x: number; y: number; width: number; height: number }
interface BarData { hue: number; value: number }

const INITIAL: Item[] = Array.from({ length: 12 }, (_, i) => ({
  id: `bar-${i}`,
  value: i + 1,
  hue: (i * 30) % 360,
}));

type SortKey = 'index' | 'asc' | 'desc' | 'shuffle';

function sortItems(items: readonly Item[], key: SortKey): Item[] {
  const arr = [...items];
  switch (key) {
    case 'index':
      arr.sort((a, b) => a.id.localeCompare(b.id));
      break;
    case 'asc':
      arr.sort((a, b) => a.value - b.value);
      break;
    case 'desc':
      arr.sort((a, b) => b.value - a.value);
      break;
    case 'shuffle': {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      break;
    }
  }
  return arr;
}

function poseFor(d: Item, i: number): Pose {
  return {
    x: i * BAR_STRIDE + ORIGIN_X,
    y: BASELINE_Y - d.value * VALUE_SCALE,
    width: BAR_W,
    height: d.value * VALUE_SCALE,
  };
}

export function D3SortableDemo() {
  const [sortKey, setSortKey] = useState<SortKey>('index');
  const [animating, setAnimating] = useState(false);
  const items = useMemo(() => sortItems(INITIAL, sortKey), [sortKey]);

  const scene = useScene<BarData, LayerId, Pose>({
    systemLayers: [{ id: 'bars' }],
    initial: [],
  });
  const selection = useSelection();
  const animator = useAnimator();
  const firstRunRef = useRef(true);

  // Drive the scene from `items` via d3Bind. First run: no transition (snap in).
  // Subsequent runs: transition the diff with a per-item delay for stagger.
  useEffect(() => {
    const binding = d3Bind(scene, items, {
      key: (d) => d.id,
      animator,
      // RECT_POSE_DESCRIPTOR is the default; no geometry override needed.
    })
      .pose(poseFor)
      .data((d) => ({ hue: d.hue, value: d.value }));

    const sel = binding.join();

    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }

    setAnimating(true);
    sel
      .transition()
      .duration(600)
      .ease(easeInOutCubic)
      .delay((_d, i) => i * 30)
      .on('end', () => setAnimating(false))
      .end();
  }, [items, scene, animator]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: '#888' }}>order:</span>
        {(['index', 'asc', 'desc', 'shuffle'] as SortKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setSortKey(k === 'shuffle' && sortKey === 'shuffle' ? 'index' : k)}
            style={{
              fontWeight: sortKey === k ? 'bold' : 'normal',
              padding: '4px 10px',
            }}
            disabled={animating && sortKey === k}
          >
            {k}
          </button>
        ))}
        <span style={{ color: '#888', fontSize: 12, marginLeft: 12 }}>
          d3Bind → join → transition().duration(600).ease(easeInOutCubic).delay(i × 30)
          {animating ? ' · animating…' : ''}
        </span>
      </div>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        selectionMode="none"
        defaultTools={[]}
        layers={{
          scene: {
            drawOne: (n, p): DrawCommand[] => [{
              kind: 'path',
              path: {
                kind: 'polygon',
                commands: new Uint8Array([1, 2, 2, 2, 5]),
                coords: new Float32Array([
                  p.x, p.y,
                  p.x + p.width, p.y,
                  p.x + p.width, p.y + p.height,
                  p.x, p.y + p.height,
                ]),
                fillRule: 'nonzero',
              },
              fill: { fill: 'solid', color: `hsl(${n.data.hue}, 65%, 55%)` },
              stroke: { paint: { color: '#222' }, width: 1.5 },
            }],
          },
          selectionOverlay: { handles: false },
        }}
      />
    </div>
  );
}
