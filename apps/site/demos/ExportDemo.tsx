import { useEffect, useState, useSyncExternalStore } from 'react';
import { pathNode, SceneCanvas, useScene } from '@weasel-js/core';
import { solid } from '@weasel-js/paint';
import { exportFormatRegistry, exportFormats, exportRegions, selectionRegion, type ExportRegion, type ExportScene } from '@weasel-js/export';
import { registerSvgExport } from '@weasel-js/svg';
import { Button } from '@weasel-js/ui/components/Button';
import { SegmentedBar } from '@weasel-js/ui/components/Segmented';
import { movePreset, pickPreset, useSelection } from '@weasel-js/editing';
import { DemoStage } from './DemoStage';
import { DownloadLink } from './DownloadLink';
import s from './ExportDemo.module.css';

const W = 480, H = 280;
const PAGE: ExportRegion = { x: 0, y: 0, width: W, height: H, name: 'Page' };

const SHAPES = [
  pathNode('a', 'M40 50 H160 V140 H40 Z', { fill: { paint: solid('#7fb069') } }),
  pathNode('b', 'M235 100 L290 230 H180 Z', { fill: { paint: solid('#d4a574') } }),
  pathNode('c', 'M310 80 C310 30 440 30 440 80 C440 130 310 130 310 80 Z', { fill: { paint: solid('#a48bd4') } }),
];

type Region = 'page' | 'selection';
const REGIONS: { value: Region; label: string }[] = [
  { value: 'page', label: 'Page' },
  { value: 'selection', label: 'Selection' },
];

export function ExportDemo() {
  const scene = useScene({
    systemLayers: [{ id: 'default' }],
    initial: SHAPES,
  });
  const selection = useSelection({ scene, mode: 'multiple' });
  useEffect(() => registerSvgExport(), []);
  const formats = useSyncExternalStore(exportFormatRegistry.subscribe, exportFormats);
  const [format, setFormat] = useState('png');
  const [region, setRegion] = useState<Region>('page');
  const [file, setFile] = useState<{ blob: Blob; filename: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doc = scene as unknown as ExportScene;
  const picked = selectionRegion(doc, selection.current, 'Selection');
  const target = region === 'page' ? PAGE : picked;

  const run = async () => {
    if (!target) return;
    setError(null);
    try {
      const blob = await exportRegions(doc, [target], format, { background: '#ffffff' });
      const extension = exportFormatRegistry.get(format)?.extension ?? format;
      setFile({ blob, filename: `${region}.${extension}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className={s.demo}>
      <div className="ckd-toolbar">
        <SegmentedBar
          items={formats.map((f) => ({ value: f.id, label: f.label }))}
          value={format} onChange={(v) => v && setFormat(v)} aria-label="Format" size="sm"
        />
        <SegmentedBar items={REGIONS} value={region} onChange={(v) => v && setRegion(v)} aria-label="Region" size="sm" />
        <Button onClick={run} disabled={!target}>Export</Button>
      </div>
      <div className={s.result}>
        {file && <DownloadLink blob={file.blob} filename={file.filename} />}
        {error && <span role="alert" className={s.error}>{error}</span>}
      </div>
      <DemoStage width={W} height={H}>
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
