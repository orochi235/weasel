import { useMemo, useState } from 'react';
import { SceneCanvas, useScene } from '@weasel-js/core';
import type { RenderLayer } from '@weasel-js/core';
import { blur, vignette, type DrawCommand, type Effect } from '@weasel-js/renderer';
import num from '@weasel-js/theme/numeric.module.css';
import { DemoStage } from './DemoStage';

const W = 720;
const H = 360;

/** Fixed, so the frame is the same on every run — this demo is a visual
 *  baseline as well as a demo, and a random palette would make it useless
 *  as one. */
const TILES = [
  { x:  40, y:  40, w: 120, h: 120, color: '#ee5a4a' },
  { x: 180, y:  90, w: 160, h: 160, color: '#5ad07f' },
  { x: 360, y:  40, w: 110, h: 220, color: '#4f7fff' },
  { x: 490, y: 120, w: 180, h: 110, color: '#f2c14e' },
  { x: 120, y: 230, w: 200, h:  90, color: '#b46ad0' },
];

export function EffectsDemo() {
  const [radius, setRadius] = useState(6);
  const [vignetted, setVignetted] = useState(true);

  const effects: Effect[] = useMemo(() => [
    ...(radius > 0 ? blur({ radius }) : []),
    ...(vignetted ? vignette({ amount: 0.7 }) : []),
  ], [radius, vignetted]);

  // The layer being blurred. Effects run over this layer's own pixels, so
  // everything drawn above it is untouched.
  const world: RenderLayer<unknown> = useMemo(() => ({
    id: 'effects-world',
    label: 'World',
    effects,
    draw: (): DrawCommand[] => TILES.map((t) => ({
      kind: 'path',
      path: { kind: 'rect', x: t.x, y: t.y, width: t.w, height: t.h },
      fill: { paint: { color: t.color } },
    })),
  }), [effects]);

  // Drawn after, with no effects of its own — the whole point of the demo. A
  // CSS `filter` on the canvas blurs the HUD along with everything else; this
  // does not. Hairlines rather than text, because a one-pixel rule is what a
  // blur destroys first, and because a baseline that waits on a font is a
  // baseline that fails on a slow machine.
  const hud: RenderLayer<unknown> = useMemo(() => ({
    id: 'effects-hud',
    label: 'HUD',
    space: 'screen',
    draw: (_data, _view, { width, height }): DrawCommand[] => {
      const rule = (x: number, y: number, w: number, h: number): DrawCommand => ({
        kind: 'path',
        path: { kind: 'rect', x, y, width: w, height: h },
        fill: { paint: { color: '#ffffff' } },
      });
      const inset = 20;
      const arm = 26;
      return [
        // Corner brackets, one hairline thick.
        rule(inset, inset, arm, 1), rule(inset, inset, 1, arm),
        rule(width - inset - arm, inset, arm, 1), rule(width - inset - 1, inset, 1, arm),
        rule(inset, height - inset - 1, arm, 1), rule(inset, height - inset - arm, 1, arm),
        rule(width - inset - arm, height - inset - 1, arm, 1), rule(width - inset - 1, height - inset - arm, 1, arm),
        // Center crosshair.
        rule(width / 2 - 12, height / 2, 25, 1), rule(width / 2, height / 2 - 12, 1, 25),
      ];
    },
  }), []);

  const scene = useScene<never, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });

  return (
    <div className="ckd-stack">
      <DemoStage width={W} height={H}>
        <SceneCanvas
          className="ckd-canvas"
          scene={scene}
          layers={{
            scene: { drawOne: () => [] },
            world: { layer: world, after: 'scene' },
            hud: { layer: hud, after: 'world' },
          }}
        />
      </DemoStage>
      <div className="ckd-controls">
        <label className="ckd-control">
          Blur radius
          <input
            type="range"
            min={0}
            max={24}
            step={1}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          />
          <output className={num.numeric}>{radius}</output>
        </label>
        <label className="ckd-control">
          <input
            type="checkbox"
            checked={vignetted}
            onChange={(e) => setVignetted(e.target.checked)}
          />
          Vignette
        </label>
      </div>
    </div>
  );
}
