import { useMemo } from 'react';
import { solid } from '@weasel-js/paint';
import { SceneCanvas, asNodeId, useScene, type Fill, type NodeId } from '@weasel-js/core';
import * as presets from '@weasel-js/editing/presets';
import * as textTools from '@weasel-js/text-tools/presets';
import type { TextStyle } from '@weasel-js/text';
import { DemoStage } from './DemoStage';

const W = 640, H = 400;
const COLS = 8, ROWS = 6;
const BOX = 180, GAP = 40;
const HUES = ['#e8eef7', '#eef5e8', '#f7efe6', '#f3e8f5'];
const INK = solid('#1c1c1c');

type Data = { text?: string; style?: TextStyle; fill?: Fill; background?: Fill };
type Spec = { id: NodeId; kind: 'mark' | 'group'; layer: 'main'; pose: { x: number; y: number; width: number; height: number }; data: Data; parent?: NodeId };

/** A grid of containers, each a titled box of four labeled cards. */
function diagram(): Spec[] {
  const out: Spec[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * (BOX + GAP), y = r * (BOX + GAP);
      const g = asNodeId(`g${r}-${c}`);
      out.push({ id: g, kind: 'group', layer: 'main', pose: { x, y, width: BOX, height: BOX }, data: { background: { paint: solid(HUES[(r + c) % HUES.length]!) } } });
      out.push({ id: asNodeId(`t${r}-${c}`), kind: 'mark', layer: 'main', parent: g, pose: { x: x + 10, y: y + 8, width: BOX - 20, height: 24 }, data: { text: `Service ${r * COLS + c + 1}`, style: { fontSize: 18, fontWeight: 600 }, fill: { paint: INK } } });
      for (let k = 0; k < 4; k++) {
        const cx = x + 10 + (k % 2) * 85, cy = y + 44 + Math.floor(k / 2) * 66;
        out.push({ id: asNodeId(`c${r}-${c}-${k}`), kind: 'mark', layer: 'main', parent: g, pose: { x: cx, y: cy, width: 75, height: 56 }, data: { fill: { paint: solid('#ffffff') } } });
        out.push({ id: asNodeId(`l${r}-${c}-${k}`), kind: 'mark', layer: 'main', parent: g, pose: { x: cx + 6, y: cy + 6, width: 63, height: 44 }, data: { text: `worker ${k + 1}\nqueue ${(r + c + k) % 7}`, style: { fontSize: 11 }, fill: { paint: INK } } });
      }
    }
  }
  return out;
}

// Groups narrower than this many device pixels draw as their box, and their children are not walked.
const SCENE_SLOT = { scene: { lod: { collapseBelowPx: 60 } } };

export function LevelOfDetailDemo() {
  const scene = useScene<Data, 'main'>({ systemLayers: [{ id: 'main' }], initial: useMemo(() => diagram(), []) });
  return (
    <div className="ckd-demo">
      <DemoStage width={W} height={H}>
        <SceneCanvas
          className="ckd-canvas"
          backgroundFill={{ color: '#ffffff' }}
          scene={scene}
          features={[presets.select, presets.view, textTools.text]}
          defaultView={{ x: -20, y: -20, scale: { x: 0.9, y: 0.9 } }}
          layers={SCENE_SLOT}
        />
      </DemoStage>
      <p className="ckd-hint">
        Scroll to zoom out. The card labels turn to gray bars once their letters are under 6 device
        pixels tall, and soon after each container under 60 device pixels draws as one box, its
        children not visited at all. Click a collapsed box and the container is selected; zoom back
        in and its cards and labels return.
      </p>
    </div>
  );
}
