import { useState } from 'react';
import {
  asNodeId,
  rectPath,
  SceneCanvas,
  useScene,
  useSelection,
  type LassoHitMode,
} from '@orochi235/weasel';

const W = 480, H = 320;

const PALETTE = ['#7fb069', '#d4a574', '#a48bd4', '#7ab8d4', '#d47a7a', '#e8c547', '#5fad9a'];
const INITIAL = (() => {
  const out = [];
  let i = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 8; col++) {
      const x = 20 + col * 55 + (row % 2) * 18;
      const y = 20 + row * 55;
      const width = 30 + ((i * 7) % 25);
      const height = 28 + ((i * 11) % 22);
      out.push({
        id: asNodeId(`r${i}`),
        kind: 'leaf' as const,
        layer: 'default' as const,
        parent: null,
        pose: { x, y, width, height },
        data: { path: rectPath(x, y, width, height), fill: PALETTE[i % PALETTE.length] },
      });
      i++;
    }
  }
  return out;
})();

const MODE_LABELS: Record<LassoHitMode, string> = {
  centers: 'centers (snappy)',
  intersect: 'intersect (Figma)',
  enclosed: 'enclosed (strict)',
};

export function LassoDemo() {
  // SceneCanvas's `toolBundle="exhaustive"` includes useLassoTool. The
  // `toolOptions.lasso.mode` knob drives the live hit-mode comparison —
  // press L to switch to lasso, drag a closed polygon, watch which rects
  // get selected based on the chosen mode.
  const scene = useScene({ systemLayers: [{ id: 'default' }], initial: INITIAL });
  const selection = useSelection({ mode: 'multi' });
  const [mode, setMode] = useState<LassoHitMode>('intersect');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
        <span>Hit mode:</span>
        {(Object.keys(MODE_LABELS) as LassoHitMode[]).map((m) => (
          <label key={m} style={{ cursor: 'pointer' }}>
            <input
              type="radio"
              name="lasso-mode"
              value={m}
              checked={mode === m}
              onChange={() => setMode(m)}
            />
            {' '}{MODE_LABELS[m]}
          </label>
        ))}
        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>Press <kbd>L</kbd> for lasso</span>
      </div>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        selectionMode="multi"
        toolBundle="exhaustive"
        toolOptions={{ lasso: { mode } }}
      />
    </div>
  );
}
