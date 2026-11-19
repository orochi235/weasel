import { useState } from 'react';
import { DrawCanvas } from '@weasel-js/core';
import { ellipsePath, pathFromD } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { registryFontSource, writePdf, type PdfResult } from '@weasel-js/pdf';
import { Button } from '@weasel-js/ui/components/Button';
import { DemoStage } from './DemoStage';
import { DownloadLink } from './DownloadLink';
import s from './PdfDemo.module.css';

const W = 360, H = 240;

/** One list of draw commands, painted on the canvas and written to the PDF alike. */
const COMMANDS: DrawCommand[] = [
  {
    kind: 'path',
    path: { kind: 'rect', x: 24, y: 24, width: 140, height: 100 },
    fill: { paint: { color: '#7fb069' } },
  },
  {
    kind: 'path',
    path: ellipsePath({ x: 180, y: 40, width: 150, height: 150 }),
    fill: { paint: {
      kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 1 },
      stops: [{ offset: 0, color: '#d4a574' }, { offset: 1, color: '#a48bd4' }],
      units: 'bounds',
    } },
  },
  {
    kind: 'path',
    path: pathFromD('M 32 200 C 90 140 150 240 220 190 S 320 160 340 210'),
    stroke: { paint: { color: '#3a2e22' }, width: 4 },
  },
];

export function PdfDemo() {
  const [result, setResult] = useState<{ blob: Blob; pdf: PdfResult } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const write = async () => {
    setBusy(true);
    setError(null);
    try {
      const pdf = await writePdf([{ width: W, height: H, commands: COMMANDS, label: 'Shapes' }], {
        fonts: registryFontSource, title: 'Shapes',
      });
      setResult({ blob: new Blob([pdf.bytes as BlobPart], { type: 'application/pdf' }), pdf });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.demo}>
      <div className="ckd-toolbar">
        <Button onClick={write} loading={busy} disabled={busy}>Write PDF</Button>
        {result && <DownloadLink blob={result.blob} filename="shapes.pdf" />}
        {error && <span role="alert" className={s.error}>{error}</span>}
        {result && result.pdf.skipped.length > 0 && (
          <span className={s.skipped}>{result.pdf.skipped.length} left out</span>
        )}
      </div>
      <DemoStage width={W} height={H}>
        <DrawCanvas className="ckd-canvas" background={{ kind: 'solid', color: '#ffffff' }} draw={COMMANDS} />
      </DemoStage>
    </div>
  );
}
