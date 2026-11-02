import { useState } from 'react';
import { EASINGS, PATH_M, PATH_L, type EasingName } from '@weasel-js/geom';
import {
  SceneCanvas,
  useScene,
  scenePoseTarget,
  textCommandFromRuns,
} from '@weasel-js/core';
import { useAnimator } from '@weasel-js/animator/react';
import type { RenderLayer } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { Slider } from '@weasel-js/ui/components/Slider';
import { Button } from '@weasel-js/ui/components/Button';
import styles from './EasingsDemo.module.css';
import { DemoStage } from './DemoStage';

interface Marker { id: string; x: number; y: number; width: number; height: number; easing: EasingName; color: string }

const W = 600, H = 520;
const COLS = 3;
const TRACK_LEFT = 110;
const TRACK_RIGHT = W - 24;
const ROW_HEIGHT = 44;
const TOP_PAD = 28;
const MARKER_SIZE = 14;
const TRACK_WIDTH = TRACK_RIGHT - TRACK_LEFT;

const ALL_EASINGS = Object.keys(EASINGS) as EasingName[];

// Three columns × ceil(N/3) rows; column lanes share their x range so the
// curves animate against the same length. Pick a warm palette so adjacent
// rows don't read as the same animation.
const COLUMN_COLORS = ['#d4a574', '#a8d469', '#a8c4d4'];

function buildInitial(): Marker[] {
  return ALL_EASINGS.map((name, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return {
      id: name,
      x: TRACK_LEFT,
      y: TOP_PAD + row * ROW_HEIGHT + (ROW_HEIGHT - MARKER_SIZE) / 2,
      width: MARKER_SIZE,
      height: MARKER_SIZE,
      easing: name,
      color: COLUMN_COLORS[col],
    };
  });
}

export function EasingsDemo() {
  // Each marker moves on its pose target: the frames are pose overrides, and the
  // destination is committed untracked, so a run is never an undo step.
  const scene = useScene<Marker>({ items: buildInitial(), subscribe: false });
  const animator = useAnimator();
  const [duration, setDuration] = useState(1400);

  const play = (): void => {
    animator.cancelAll();
    for (const id of scene.renderOrder()) {
      const target = scenePoseTarget(scene, id);
      const pose = scene.get(id)?.pose as Marker | undefined;
      if (!target || !pose) continue;
      animator.tween({
        target,
        from: { ...pose, x: TRACK_LEFT },
        to: { ...pose, x: TRACK_RIGHT - MARKER_SIZE },
        ms: duration,
        easing: EASINGS[pose.easing],
        cancelKey: `easing-${pose.id}`,
      });
    }
  };

  // Custom overlay layer: per-row labels + track lines.
  const trackLayer: RenderLayer<unknown> = {
    id: 'tracks', label: 'Tracks',
    draw: () => {
      const cmds: DrawCommand[] = [];
      for (let i = 0; i < ALL_EASINGS.length; i++) {
        const name = ALL_EASINGS[i];
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const y = TOP_PAD + row * ROW_HEIGHT + ROW_HEIGHT / 2;
        // Per-row label. Right-aligned approximation: x = right_edge - text_width.
        const charW = 6.6;
        cmds.push(textCommandFromRuns(
          TRACK_LEFT - 8 - name.length * charW,
          y,
          [{ text: name, fill: { paint: { kind: 'solid', color: '#a89878' } } }],
          { fontFamily: 'sans-serif', fontSize: 11 },
        ));
        // Track line as 2-point polygon path stroke.
        cmds.push({
          kind: 'path',
          path: {
            kind: 'polygon',
            commands: new Uint8Array([PATH_M, PATH_L]),
            coords: new Float32Array([TRACK_LEFT, y, TRACK_RIGHT, y]),
            fillRule: 'nonzero',
          },
          stroke: { paint: { color: '#3a2e22' }, width: 1 },
        });
        // Mini curve plot.
        const plotY = y + 14;
        const plotH = 8;
        const fn = EASINGS[name];
        const samples = 32;
        const commands = new Uint8Array(samples + 1);
        const coords = new Float32Array((samples + 1) * 2);
        for (let s = 0; s <= samples; s++) {
          const t = s / samples;
          const px = TRACK_LEFT + t * TRACK_WIDTH;
          const v = Math.max(0, Math.min(1, fn(t)));
          const py = plotY + (1 - v) * plotH;
          commands[s] = s === 0 ? PATH_M : PATH_L;
          coords[s * 2] = px;
          coords[s * 2 + 1] = py;
        }
        cmds.push({
          kind: 'group',
          alpha: 0.5,
          children: [{
            kind: 'path',
            path: { kind: 'polygon', commands, coords, fillRule: 'nonzero' },
            stroke: { paint: { color: COLUMN_COLORS[col] }, width: 1 },
          }],
        });
      }
      return cmds;
    },
  };

  return (
    <div className="ckd-demo">
      <div className="ckd-toolbar">
        <Button onClick={play}>play all</Button>
        <label className="ckd-field">
          duration
          <div className={styles.slider}>
            <Slider
              min={300} max={4000} step={100}
              thumbs={[{ value: duration }]}
              onInput={ts => setDuration(ts[0].value)}
              ariaLabel="Duration"
              readoutPlacement="none"
            />
          </div>
          <span className={styles.duration}>{duration} ms</span>
        </label>
      </div>
      <DemoStage width={W} height={H}>
        <SceneCanvas
          className="ckd-canvas"
          scene={scene}
          selectable={false}
          layers={{
            tracks: { layer: trackLayer, before: 'scene' },
            scene: {
              drawOne: (_n, p): DrawCommand[] => [{
                kind: 'path',
                path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
                fill: { paint: { color: (p as Marker).color } },
              }],
            },
            selectionOverlay: null,
          }}
        />
      </DemoStage>
      <p className="ckd-hint ckd-prose">
        Click <strong>play all</strong> to fire one tween per easing simultaneously, all sharing
        the same duration. Each marker's x is driven by its named curve from <code>EASINGS</code>;
        the dim line below each track plots the curve shape (clamped to [0,1] for the back/
        elastic overshoot rows — the marker itself still shows the overshoot through its
        actual position).
      </p>
    </div>
  );
}
