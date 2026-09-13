import { useEffect, useMemo, useRef, useState } from 'react';
import { SceneCanvas, useScene } from '@weasel-js/core';
import type { RenderLayer, SceneCanvasApi } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { useHud, useHudContribution } from '@weasel-js/hud/react';
import { createLoupe, type LoupeHandle, type LoupeMode } from '@weasel-js/hud';

const W = 600, H = 400;

/** Painted into the framebuffer, not just onto the CSS box behind it: pixel
 *  mode reads the framebuffer back, and a transparent one reads back as
 *  transparent — a see-through loupe. */
const PAPER = '#6a6a6a';

/** Patch of alternating 1px rules. `tests/visual/loupe.spec.ts` aims into its
 *  center to tell NEAREST magnification from LINEAR; moving it moves the
 *  spec's aim point. */
const RULING = { x: 400, y: 280, size: 60 };

interface Block { color: string }
type Pose = { x: number; y: number; width: number; height: number };

/** Nodes to edit through the lens, clear of the ruling patch and swatches. */
const BLOCKS = [
  { id: 'b1', pose: { x: 150, y: 290, width: 40, height: 24 }, color: '#c77dff' },
  { id: 'b2', pose: { x: 240, y: 286, width: 30, height: 30 }, color: '#ff9f43' },
];

/** Fine detail worth magnifying: a hairline grid, a patch of 1px rules, and
 *  colored swatches.
 *
 *  Screen space with a self-applied view: createViewportLayer hands source
 *  layers the inner view and applies no transform, so a layer that ignores
 *  its view argument renders unmagnified inside the loupe. */
function detailLayer(): RenderLayer<unknown> {
  return {
    id: 'loupe-demo-scene',
    label: 'Detail',
    space: 'screen',
    draw: (_data, v): DrawCommand[] => {
      const px = (wx: number) => (wx - v.x) * v.scale.x;
      const py = (wy: number) => (wy - v.y) * v.scale.y;
      const out: DrawCommand[] = [];
      for (let i = 0; i <= 40; i++) {
        out.push({
          kind: 'path',
          path: { kind: 'rect', x: px(i * 20), y: py(0), width: v.scale.x, height: 800 * v.scale.y },
          fill: { fill: 'solid', color: '#3a3f4a' },
        });
        out.push({
          kind: 'path',
          path: { kind: 'rect', x: px(0), y: py(i * 20), width: 800 * v.scale.x, height: v.scale.y },
          fill: { fill: 'solid', color: '#3a3f4a' },
        });
      }
      // Alternating single-world-px rules: unreadable at 1:1 and the sharpest
      // available test of what magnification does to a hard edge.
      for (let i = 0; i < 30; i++) {
        out.push({
          kind: 'path',
          path: {
            kind: 'rect',
            x: px(RULING.x + i * 2), y: py(RULING.y),
            width: v.scale.x, height: RULING.size * v.scale.y,
          },
          fill: { fill: 'solid', color: '#20242c' },
        });
      }
      ['#e0533d', '#4ea6ff', '#7fd67f', '#e8c33d'].forEach((color, i) => {
        out.push({
          kind: 'path',
          path: {
            kind: 'rect',
            x: px(120 + i * 90), y: py(160),
            width: 60 * v.scale.x, height: 60 * v.scale.y,
          },
          fill: { fill: 'solid', color },
        });
      });
      return out;
    },
  };
}

export function LoupeDemo() {
  const ref = useRef<SceneCanvasApi>(null);
  const hud = useHud(ref, { font: 'sans-serif' });
  const hudTool = useHudContribution();
  const loupeRef = useRef<LoupeHandle | null>(null);
  const [mode, setMode] = useState<LoupeMode>('vector');
  const [factor, setFactor] = useState(8);
  const [color, setColor] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // Read when a loupe is built, so rebuilding for `editing` keeps these.
  const settings = useRef({ mode, factor });
  settings.current = { mode, factor };

  const scene = useScene<Block, 'default', Pose>({
    systemLayers: [{ id: 'default' }],
    initial: BLOCKS.map((b) => ({
      id: b.id as never, kind: 'leaf' as const, layer: 'default' as const,
      pose: b.pose, data: { color: b.color },
    })),
  });

  const detail = useMemo(() => detailLayer(), []);

  useEffect(() => {
    const api = ref.current;
    if (!api?.surface) return;
    const loupe = createLoupe({
      hud,
      canvas: api.surface,
      ...(api.element ? { input: api.element } : {}),
      // The lens is a view on the canvas: it paints the canvas's own stack,
      // and with `interactive` a press inside it edits what it magnifies.
      views: api,
      interactive: editing,
      mode: settings.current.mode,
      factor: settings.current.factor,
      requestRedraw: () => api.requestRedraw(),
      // A bare lens moves by its interior. An editing lens gives the interior
      // to the scene, so it needs a titlebar to be moved by; its close box
      // leaves edit mode.
      titlebar: editing,
      title: 'Editing',
      onClose: () => setEditing(false),
      background: PAPER,
      onColorChange: setColor,
      onPick: setPicked,
    });
    loupeRef.current = loupe;
    api.requestRedraw();
    return () => { loupe.dispose(); loupeRef.current = null; };
  }, [hud, editing]);

  return (
    <div className="ckd-canvas-wrap">
      <div className="ckd-row">
        <label>
          <input type="radio" name="loupe-mode" checked={mode === 'vector'}
            onChange={() => { setMode('vector'); loupeRef.current?.setMode('vector'); }} />
          vector
        </label>
        <label>
          <input type="radio" name="loupe-mode" checked={mode === 'pixel'}
            onChange={() => { setMode('pixel'); loupeRef.current?.setMode('pixel'); }} />
          pixel
        </label>
        <label>
          scale
          <input type="range" min={2} max={16} step={1} value={factor}
            onChange={(e) => {
              const f = Number(e.target.value);
              setFactor(f); loupeRef.current?.setFactor(f);
            }} />
          {factor}×
        </label>
        <label>
          <input type="checkbox" checked={editing} onChange={(e) => setEditing(e.target.checked)} />
          edit through the lens
        </label>
        <span className="ckd-hint">under the aim point: {color ?? '—'}</span>
        <span className="ckd-hint">clicked: {picked ?? '—'}</span>
      </div>
      <SceneCanvas
        ref={ref}
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        viewport={{}}
        backgroundFill={{ fill: 'solid', color: PAPER }}
        ambient={[hudTool]}
        layers={{
          scene: {
            drawOne: (n, p): DrawCommand[] => [{
              kind: 'path',
              path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              fill: { fill: 'solid', color: n.data.color },
            }],
          },
          // Not registerLayer: extras draw after the hud's own registered
          // layer, so the outer scene would paint over the loupe window.
          detail: { layer: detail, after: 'scene' },
        }}
      />
    </div>
  );
}
