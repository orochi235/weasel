import { useEffect, useRef, useState } from 'react';
import { after } from '@weasel-js/registry';
import { solid } from '@weasel-js/paint';
import {
  SceneCanvas, asNodeId, useScene, useSceneStream, type AddNodeSpec, type Fill, type RectPose, type SceneCell, type SceneSource, type View,
} from '@weasel-js/core';
import * as presets from '@weasel-js/editing/presets';
import { DemoStage } from './DemoStage';
import s from './StreamingDemo.module.css';

const W = 640, H = 400;
const CELL = 200;
const START: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: W, height: H };

type Data = { fill: Fill };

/** The same color for a cell every time it loads: the world is made on request, never stored. */
const hue = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) % 360;

/** An endless world, 36 rects a cell, each cell arriving 80 ms after it is asked for, as from a server. */
const WORLD: SceneSource<Data, 'main', RectPose> = {
  cellSize: CELL,
  load: (cell: SceneCell, signal: AbortSignal) => new Promise((resolve) => {
    const cancel = after(80, () => {
      const out: AddNodeSpec<Data, 'main', RectPose>[] = [];
      for (let i = 0; i < 36; i++) {
        out.push({
          id: asNodeId(`n${cell.x}_${cell.y}_${i}`), kind: 'mark', layer: 'main',
          pose: { x: cell.box[0] + (i % 6) * 33 + 4, y: cell.box[1] + Math.floor(i / 6) * 33 + 4, width: 25, height: 25 },
          data: { fill: { paint: solid(`hsl(${(hue(cell.x, cell.y) + i * 3 + 360) % 360} 55% 60%)`) } },
        });
      }
      resolve(out);
    });
    signal.addEventListener('abort', () => { cancel(); resolve([]); });
  }),
};

export function StreamingDemo() {
  const scene = useScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const stream = useSceneStream(scene, WORLD, { maxCells: 64 });
  // A cell landing or leaving notifies the scene's subscribers, which redraws the readout.
  const [, setSeen] = useState(0);
  useEffect(() => scene.subscribe(() => setSeen((n) => n + 1)), [scene]);
  const view = useRef(START);
  const dims = useRef(DIMS);
  useEffect(() => { stream.update(view.current, dims.current); }, [stream]);
  const stats = stream.stats();
  return (
    <div className="ckd-demo">
      <div className="ckd-toolbar">
        <span className="ckd-toolbar-note">Drag or scroll to travel.</span>
        <span className={`ckd-readout ${s.stats}`}>
          {String(stats.cells).padStart(3)} cells · {String(scene.nodes.size).padStart(5)} nodes · undo {scene.historyEntries().length}
        </span>
      </div>
      <DemoStage width={W} height={H}>
        <SceneCanvas
          className="ckd-canvas" scene={scene} selectable={false}
          features={[presets.view]} defaultView={START}
          onViewChange={(v) => { view.current = v; stream.update(v, dims.current); }}
          onResize={(size) => { dims.current = size; stream.update(view.current, size); }}
        />
      </DemoStage>
      <p className="ckd-hint">
        The world never ends and is never held whole: a source answers each 200-unit cell when the view
        nears it, nearest first, four at a time, and the cells the view has left are dropped once more
        than 64 are held. Cells land outside undo history, so the readout&apos;s undo count stays at 0 however
        far you travel, and the visibility index hears of each node that lands or leaves rather than
        building again.
      </p>
    </div>
  );
}
