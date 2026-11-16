import { useState } from 'react';
import { EASINGS, type EasingName } from '@weasel-js/geom';
import { SceneCanvas, linePath, polylineFromPoints, solid, useScene, scenePoseTarget, textCommandFromRuns } from '@weasel-js/core';
import { useAnimator } from '@weasel-js/animator/react';
import type { Fill, RenderLayer } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { Slider } from '@weasel-js/ui/components/Slider';
import { Button } from '@weasel-js/ui/components/Button';
import { Field } from '@weasel-js/ui/components/Field';
import styles from './EasingsDemo.module.css';
import { DemoStage } from './DemoStage';

interface Marker { id: string; x: number; y: number; width: number; height: number; easing: EasingName; fill: Fill }

const ALL_EASINGS = Object.keys(EASINGS) as EasingName[];

const W = 600;
const TRACK_LEFT = 110;
const TRACK_RIGHT = W - 24;
const ROW_HEIGHT = 22;
const TOP_PAD = 16;
const H = TOP_PAD * 2 + ALL_EASINGS.length * ROW_HEIGHT;
const MARKER_SIZE = 14;
const TRACK_WIDTH = TRACK_RIGHT - TRACK_LEFT;
const PLOT_SAMPLES = 32;

// One lane per easing, every lane the same length. After `linear`, the curves
// come in In/Out/InOut triples, and each variant keeps one color.
const VARIANT_COLORS = ['#d4a574', '#a8d469', '#a8c4d4'];
const colorOf = (i: number) => VARIANT_COLORS[i === 0 ? 0 : (i - 1) % VARIANT_COLORS.length];

function buildInitial(): Marker[] {
  return ALL_EASINGS.map((name, i) => ({
    id: name,
    x: TRACK_LEFT,
    y: TOP_PAD + i * ROW_HEIGHT + (ROW_HEIGHT - MARKER_SIZE) / 2,
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    easing: name,
    fill: { paint: solid(colorOf(i)) },
  }));
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

  const trackLayer: RenderLayer<unknown> = {
    id: 'tracks', label: 'Tracks',
    draw: () => {
      const cmds: DrawCommand[] = [];
      for (let i = 0; i < ALL_EASINGS.length; i++) {
        const name = ALL_EASINGS[i];
        const top = TOP_PAD + i * ROW_HEIGHT;
        const y = top + ROW_HEIGHT / 2;
        cmds.push(textCommandFromRuns(
          TRACK_LEFT - 8, top,
          [{ text: name, fill: { paint: { kind: 'solid', color: '#a89878' } } }],
          { fontFamily: 'sans-serif', fontSize: 11, align: 'right' },
          undefined, ROW_HEIGHT, 'center',
        ));
        cmds.push({
          kind: 'path',
          path: linePath({ x: TRACK_LEFT, y }, { x: TRACK_RIGHT, y }),
          stroke: { paint: { color: '#3a2e22' }, width: 1 },
        });
        // The curve's shape, plotted in a strip just under the track.
        const fn = EASINGS[name];
        const plot = Array.from({ length: PLOT_SAMPLES + 1 }, (_, s) => {
          const t = s / PLOT_SAMPLES;
          return { x: TRACK_LEFT + t * TRACK_WIDTH, y: y + 3 + (1 - Math.max(0, Math.min(1, fn(t)))) * 6 };
        });
        cmds.push({
          kind: 'group',
          alpha: 0.5,
          children: [{
            kind: 'path',
            path: polylineFromPoints(plot),
            stroke: { paint: { color: colorOf(i) }, width: 1 },
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
        <Field label="duration" orientation="row" output={`${duration} ms`}>
          <Slider
            className={styles.slider}
            min={300} max={4000} step={100}
            thumbs={[{ value: duration }]}
            onInput={ts => setDuration(ts[0].value)}
            readoutPlacement="none"
          />
        </Field>
      </div>
      <DemoStage width={W} height={H}>
        <SceneCanvas
          className="ckd-canvas"
          scene={scene}
          selectable={false}
          layers={{
            tracks: { layer: trackLayer, before: 'scene' },
            selectionOverlay: null,
          }}
        />
      </DemoStage>
    </div>
  );
}
