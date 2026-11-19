import { useState } from 'react';
import { type Fill, pathNode, SceneCanvas, type Stroke, useScene } from '@weasel-js/core';
import type { ExportRegion, ExportScene } from '@weasel-js/export';
import { solid } from '@weasel-js/paint';
import { exportRegionsPdf } from '@weasel-js/pdf/export';
import { movePreset, pickPreset, useSelection } from '@weasel-js/editing';
import { Button } from '@weasel-js/ui/components/Button';
import { DemoStage } from './DemoStage';
import { DownloadLink } from './DownloadLink';
import s from './PdfDemo.module.css';

const W = 560, H = 260;

/** Each half of the canvas is a page of the PDF, labeled with its region's `name`. */
const PAGES: ExportRegion[] = [
  { x: 0, y: 0, width: W / 2, height: H, name: 'Left' },
  { x: W / 2, y: 0, width: W / 2, height: H, name: 'Right' },
];

interface Data { fill?: Fill; stroke?: Stroke }

const SHAPES = [
  pathNode<Data>('square', 'M40 60 H180 V200 H40 Z', { fill: { paint: solid('#7fb069') } }),
  pathNode<Data>('disc', 'M310 130 C310 70 450 70 450 130 C450 190 310 190 310 130 Z', { fill: { paint: {
    kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 1 },
    stops: [{ offset: 0, color: '#d4a574' }, { offset: 1, color: '#a48bd4' }],
    units: 'bounds',
  } } }),
  pathNode<Data>('curve', 'M60 230 C160 170 300 260 520 220', { stroke: { paint: solid('#3a2e22'), width: 4 } }),
];

export function PdfDemo() {
  const scene = useScene({ systemLayers: [{ id: 'default' }], initial: SHAPES });
  const selection = useSelection({ scene, mode: 'multiple' });
  const [file, setFile] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);

  const write = async () => {
    setBusy(true);
    const heard: string[] = [];
    try {
      setFile(await exportRegionsPdf(scene as unknown as ExportScene, PAGES, {
        title: 'Shapes', background: '#ffffff', onDiagnostic: (d) => heard.push(d.message),
      }));
    } catch (e) {
      heard.push(e instanceof Error ? e.message : String(e));
    } finally {
      setNotes(heard);
      setBusy(false);
    }
  };

  return (
    <div className={s.demo}>
      <div className="ckd-toolbar">
        <Button onClick={write} loading={busy} disabled={busy}>Write PDF</Button>
        {file && <DownloadLink blob={file} filename="shapes.pdf" />}
      </div>
      {notes.length > 0 && <ul role="alert" className={s.notes}>{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
      <DemoStage width={W} height={H} className={s.stage}>
        <SceneCanvas
          className="ckd-canvas"
          backgroundFill={{ color: '#ffffff' }}
          scene={scene}
          selection={selection}
          features={[pickPreset, movePreset]}
        />
      </DemoStage>
    </div>
  );
}
