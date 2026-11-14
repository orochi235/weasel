import { useEffect, useMemo, useRef, useState } from 'react';
import {
  OUTPUT_GRID_KEY, SceneCanvas, defaultDrawOne, solid, useScene,
  type DrawCommand, type LayerGroup, type RectPose, type RenderLayer, type View,
} from '@weasel-js/core';
import {
  dither, gridOnScreen, protectTexture,
  type DitherMethod, type ProtectTexture,
} from '@weasel-js/dither';
import num from '@weasel-js/theme/numeric.module.css';
import { InlineRange } from '@weasel-js/ui/components/InlineRange';
import { Button } from '@weasel-js/ui/components/Button';
import { SegmentedBar } from '@weasel-js/ui/components/Segmented';
import { DemoStage } from './DemoStage';
import { exportPage, marksMask, type Crisp } from './ditherDemoExport';
import {
  DOT_RULE, INITIAL_NODES, PAGE, fitPage, outputGrid, wholeDots,
  type DitherLayer, type DitherNode, type DitherNodeData,
} from './ditherDemoScene';
import s from './DitherDemo.module.css';

const W = 640;
const H = 300;
const STAGE = { width: W, height: H };
const dpr = () => (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

/** The kit's default zoom stops at 8, and 300 dpi opens at 12.5 on a 1× screen. */
const ZOOM_RANGE = { zoom: { min: 0.5, max: 48 }, pinchZoom: { min: 0.5, max: 48 } };

type GridChoice = 'screen' | 180 | 300;
/** Where a grid opens: on whole dots for a printer's, the whole page for the screen's. */
const openingView = (grid: GridChoice): View =>
  (grid === 'screen' ? fitPage(STAGE) : wholeDots(outputGrid(grid), STAGE, dpr()));

const GRIDS = [
  { value: 'screen' as const, label: 'Screen' },
  { value: 180 as const, label: '180 dpi' },
  { value: 300 as const, label: '300 dpi' },
];
const METHODS: { value: DitherMethod; label: string }[] = [
  { value: 'threshold', label: 'Threshold' },
  { value: 'bayer', label: 'Bayer' },
  { value: 'floyd-steinberg', label: 'Floyd–Steinberg' },
  { value: 'atkinson', label: 'Atkinson' },
];
const CRISP: { value: Crisp; label: string }[] = [
  { value: 'layer', label: 'By layer' },
  { value: 'mask', label: 'By mask' },
  { value: 'off', label: 'Off' },
];
type Snap = 'on' | 'off';
const SNAP: { value: Snap; label: string }[] = [
  { value: 'on', label: 'Snapped to dots' },
  { value: 'off', label: 'As drawn' },
];
/** The screen grid's export: one pixel per point. */
const SCREEN_GRID = { pitch: 1, origin: { x: 0, y: 0 } };
const exportGridOf = (grid: GridChoice) => (grid === 'screen' ? SCREEN_GRID : outputGrid(grid));
const LAYERS = [{ id: 'art' as const }, { id: 'marks' as const }];
const labelOf = (m: DitherMethod) => METHODS.find((x) => x.value === m)!.label;

/** The paper, under the scene and outside every layer group, so the dither's
 *  blank can stay transparent and the page still reads as white. */
const PAPER: RenderLayer<unknown> = {
  id: 'dither-paper',
  label: 'Paper',
  draw: (): DrawCommand[] => [{
    kind: 'path',
    path: { kind: 'rect', x: 0, y: 0, width: PAGE.width, height: PAGE.height },
    fill: { paint: { color: '#ffffff' } },
  }],
};

const barcodeWidth = (scene: { nodes: ReadonlyMap<unknown, DitherNode> }) =>
  [...scene.nodes.values()].find((n) => n.data.mark === 'barcode')?.pose.width ?? 0;

export function DitherDemo() {
  // One document as drawn, and the same one keeping its marks on the output grid it holds.
  const asDrawn = useScene<DitherNodeData, DitherLayer, RectPose>({ systemLayers: LAYERS, initial: INITIAL_NODES });
  const onDots = useScene<DitherNodeData, DitherLayer, RectPose>({
    systemLayers: LAYERS, initial: INITIAL_NODES, quantize: DOT_RULE, doc: { [OUTPUT_GRID_KEY]: exportGridOf(180) },
  });
  const [snap, setSnap] = useState<Snap>('on');
  const scene = snap === 'on' ? onDots : asDrawn;
  const version = scene.getVersion();
  const [grid, setGrid] = useState<GridChoice>(180);
  const [view, setView] = useState<View>(() => openingView(180));
  const pickGrid = (next: GridChoice) => {
    setGrid(next);
    setView(openingView(next));
    onDots.doc.set(OUTPUT_GRID_KEY, exportGridOf(next));
  };
  const [method, setMethod] = useState<DitherMethod>('bayer');
  const [threshold, setThreshold] = useState(128);
  const [crisp, setCrisp] = useState<Crisp>('layer');

  const printGrid = useMemo(() => (grid === 'screen' ? null : outputGrid(grid)), [grid]);
  const gpuMethod = method === 'threshold' || method === 'bayer' ? method : 'bayer';
  const masked = crisp === 'mask' && printGrid !== null;

  // The mask is indexed by dot, so it is the page's size in dots. `undisposed`
  // holds the texture until it is disposed, which the cleanup does before
  // React has rendered `held` away, so a frame in between draws without it.
  const undisposed = useRef<ProtectTexture | null>(null);
  const [held, setHeld] = useState<ProtectTexture | null>(null);
  useEffect(() => {
    if (!masked || !printGrid) return;
    let current = true;
    let made: ProtectTexture | null = null;
    marksMask(scene, printGrid).then(({ mask, width, height }) => protectTexture(mask, width, height)).then((t) => {
      if (!current) { t.dispose(); return; }
      made = t;
      undisposed.current = t;
      setHeld(t);
    }, () => {});
    return () => {
      current = false;
      if (undisposed.current === made) undisposed.current = null;
      made?.dispose();
    };
  }, [scene, version, masked, printGrid]);

  const layerGroups = useMemo<LayerGroup[]>(() => {
    const at = (view: View, dpr: number) => (printGrid ? gridOnScreen(printGrid, view, dpr) : 'screen' as const);
    if (crisp === 'layer') {
      return [
        { id: 'dither-art', layers: ['scene:art'], effects: (view, dims) => dither({ method: gpuMethod, threshold, grid: at(view, dims.dpr) }) },
        { id: 'dither-marks', layers: ['scene:marks'], effects: (view, dims) => dither({ method: 'threshold', threshold, grid: at(view, dims.dpr) }) },
      ];
    }
    return [{
      id: 'dither-page',
      layers: ['scene'],
      effects: (view, dims) => dither({
        method: gpuMethod, threshold, grid: at(view, dims.dpr),
        ...(masked && held && undisposed.current === held ? { protect: held } : {}),
      }),
    }];
  }, [crisp, gpuMethod, threshold, printGrid, masked, held]);

  const out = useRef<HTMLCanvasElement>(null);
  const [exported, setExported] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    exportPage(scene, { grid: printGrid ?? SCREEN_GRID, method, threshold, crisp })
      .then((image) => {
        if (!live) return;
        const canvas = out.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        canvas.width = image.width;
        canvas.height = image.height;
        // One export pixel per device pixel: any other size drops or doubles rows.
        canvas.style.setProperty('--print-w', `${image.width / dpr()}px`);
        canvas.style.setProperty('--print-h', `${image.height / dpr()}px`);
        ctx.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
        setExported(`${image.width} × ${image.height} px`);
      })
      .catch(() => { if (live) setExported(null); });
    return () => { live = false; };
  }, [scene, version, printGrid, method, threshold, crisp]);

  const notes = [
    gpuMethod === method
      ? `Canvas: ${labelOf(method)} on the GPU.`
      : `Canvas: Bayer on the GPU, since ${labelOf(method)} runs on the CPU only; the export uses it.`,
    crisp === 'mask' && !printGrid
      ? 'By mask needs a printer grid on the canvas, so the canvas protects nothing on the screen grid; the export still does.'
      : '',
    `Barcode: ${barcodeWidth(scene).toFixed(2)} pt wide.`,
  ].filter(Boolean).join(' ');
  const resolution = printGrid ? `${grid} dpi` : '1 px per point';

  return (
    <div className="ckd-stack">
      <DemoStage width={W} height={H}>
        <SceneCanvas
          key={snap}
          viewport={ZOOM_RANGE}
          defaultActiveTool="hand"
          view={view}
          onViewChange={setView}
          className="ckd-canvas"
          scene={scene}
          backgroundFill={solid('#c9ccd1')}
          layerGroups={layerGroups}
          layers={{
            paper: { layer: PAPER, before: 'scene' },
            scene: { drawOne: defaultDrawOne },
          }}
        />
      </DemoStage>
      <p className="ckd-hint">{notes}</p>
      <div className="ckd-controls">
        <div className="ckd-control">
          Grid
          <SegmentedBar items={GRIDS} value={grid} onChange={(v) => { if (v !== null) pickGrid(v); }} aria-label="Grid" size="sm" />
          <Button size="sm" onClick={() => setView(fitPage(STAGE))}>Fit page</Button>
        </div>
        <div className="ckd-control">
          Method
          <SegmentedBar items={METHODS} value={method} onChange={(v) => { if (v) setMethod(v); }} aria-label="Method" size="sm" />
        </div>
        <div className="ckd-control">
          Keep marks crisp
          <SegmentedBar items={CRISP} value={crisp} onChange={(v) => { if (v) setCrisp(v); }} aria-label="Keep marks crisp" size="sm" />
        </div>
        <div className="ckd-control">
          Marks
          <SegmentedBar items={SNAP} value={snap} onChange={(v) => { if (v) setSnap(v); }} aria-label="Marks" size="sm" />
        </div>
        <label className="ckd-control">
          Threshold
          <InlineRange min={0} max={255} step={1} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
          <output className={`${num.numeric} ${s.readout}`}>{threshold}</output>
        </label>
      </div>
      <figure className={s.export}>
        <div className={s.pane}>
          <canvas ref={out} className={s.print} aria-label="Exported page" />
        </div>
        <figcaption className={s.caption}>
          Export at {resolution}, {labelOf(method)}
          {exported ? <span className={num.numeric}> · {exported}</span> : null}
        </figcaption>
      </figure>
    </div>
  );
}
