import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { commandFill, SceneCanvas, solid, textCommand, useScene, useSelection, type DrawCommand, type Fill, type SceneViewDrawOne } from '@weasel-js/core';
import { ellipsePath } from '@weasel-js/geom';
import {
  createBrotherPrinter,
  Printers,
  printLabel,
  renderLabel,
  sceneToLbx,
  tapeForWidthMm,
  type BrotherPrinter,
} from '@weasel-js/p-touch';
import { Button } from '@weasel-js/ui/components/Button';
import { DemoStage } from './DemoStage';
import s from './PTouchLabelDemo.module.css';

const TAPE = tapeForWidthMm(24)!;
const LENGTH = 288;
const MEDIA = Printers.ptP710bt.media(TAPE.widthMm);

interface LabelData {
  shape: 'rect' | 'ellipse' | 'text';
  fill?: Fill;
  strokeWidth?: number;
  text?: string;
}
type Pose = { x: number; y: number; width: number; height: number };

const drawOne: SceneViewDrawOne<LabelData, 'label', Pose> = (node, pose): DrawCommand[] => {
  const d = node.data;
  if (d.shape === 'text') {
    return [textCommand(pose.x, pose.y, d.text ?? '', { fontFamily: 'sans-serif', fontSize: 18, fontWeight: 700 }, pose.width, pose.height, 'center', { fill: d.fill })];
  }
  const path = d.shape === 'ellipse' ? ellipsePath(pose) : { kind: 'rect' as const, ...pose };
  const fill = d.fill && commandFill(d.fill, pose);
  return [{
    kind: 'path',
    path,
    ...(fill ? { fill } : {}),
    ...(d.strokeWidth ? { stroke: { paint: { color: '#000000' }, width: d.strokeWidth } } : {}),
  }];
};

const INK = { paint: solid('#000000') };

/**
 * A 24mm label drawn on a scene in points. `renderLabel` draws it at the PT-P710BT's dot pitch over
 * the band its printhead reaches, which the preview shows; `printLabel` sends that to a printer over
 * WebUSB, and `sceneToLbx` writes the same scene as a file P-touch Editor opens, the frame and text as
 * objects and the ellipse as an image.
 */
export function PTouchLabelDemo() {
  const scene = useScene<LabelData, 'label', Pose>({
    systemLayers: [{ id: 'label' }],
    initial: [
      { id: 'frame' as never, kind: 'mark', layer: 'label', pose: { x: 4, y: 6, width: 280, height: 56 }, data: { shape: 'rect', strokeWidth: 2 } },
      { id: 'dot' as never, kind: 'mark', layer: 'label', pose: { x: 16, y: 18, width: 32, height: 32 }, data: { shape: 'ellipse', fill: INK } },
      { id: 'name' as never, kind: 'mark', layer: 'label', pose: { x: 60, y: 14, width: 216, height: 40 }, data: { shape: 'text', text: 'SPARE PARTS', fill: INK } },
    ],
  });
  const selection = useSelection({ scene, mode: 'multi' });
  const version = useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);
  const preview = useRef<HTMLCanvasElement>(null);
  const printer = useMemo<BrotherPrinter | null>(() => ('usb' in navigator || 'serial' in navigator ? createBrotherPrinter() : null), []);
  useEffect(() => () => printer?.dispose(), [printer]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let live = true;
    void renderLabel({ scene, drawOne, length: LENGTH, tape: TAPE, media: MEDIA }).then((img) => {
      const out = preview.current;
      if (!live || !out) return;
      out.width = img.width;
      out.height = img.height;
      out.getContext('2d')?.putImageData(new ImageData(Uint8ClampedArray.from(img.data), img.width, img.height), 0, 0);
    });
    return () => { live = false; };
  }, [scene, version]);

  const download = async () => {
    const { bytes, config } = await sceneToLbx({ scene, drawOne, length: LENGTH, tape: TAPE });
    const url = URL.createObjectURL(new Blob([bytes.slice()], { type: 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'label.lbx';
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`wrote ${config.objects.map((o) => o.type).join(', ')}`);
  };

  const print = async () => {
    if (!printer) return;
    try {
      const image = await renderLabel({ scene, drawOne, length: LENGTH, tape: TAPE, media: MEDIA });
      const reply = await printLabel({ printer, image, media: MEDIA, requestDevice: true });
      setStatus(reply.hasError ? 'the printer reported an error' : 'sent');
    } catch (err) {
      setStatus(String(err));
    }
  };

  return (
    <div className="ckd-stack">
      <DemoStage width={LENGTH} height={TAPE.widthPt}>
        <SceneCanvas features={['pick', 'move', 'transform']} className="ckd-canvas" backgroundFill={{ color: '#ffffff' }} scene={scene} selection={selection} layers={{ scene: { drawOne } }} />
      </DemoStage>
      <canvas ref={preview} className={s.preview} aria-label="Print preview at the printer's dot pitch" />
      <div className="ckd-row">
        <Button size="sm" onClick={() => void download()}>Download .lbx</Button>
        <Button size="sm" onClick={() => void print()} disabled={!printer}>Print</Button>
        <span>{printer ? status : 'printing needs WebUSB or Web Serial'}</span>
      </div>
    </div>
  );
}
