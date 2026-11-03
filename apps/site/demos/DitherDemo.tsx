import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SceneCanvas, defaultDrawOne, solid, useScene,
  type DrawCommand, type LayerGroup, type RectPose, type RenderLayer, type View,
} from '@weasel-js/core';
import {
  dither, gridOnScreen, protectMask, protectRects, protectTexture,
  type DitherMethod, type ProtectTexture,
} from '@weasel-js/dither';
import num from '@weasel-js/theme/numeric.module.css';
import { InlineRange } from '@weasel-js/ui/components/InlineRange';
import { ToggleBar } from '@weasel-js/ui/components/ToggleBar';
import { DemoStage } from './DemoStage';
import { exportPage, type Crisp } from './ditherDemoExport';
import {
  INITIAL_NODES, PAGE, outputGrid, protectedRect,
  type DitherLayer, type DitherNode, type DitherNodeData,
} from './ditherDemoScene';
import s from './DitherDemo.module.css';

const W = 640;
const H = 240;
const ZOOM = 2;
/** The page centered in the stage as it opens. */
const START: View = {
  x: -(W / ZOOM - PAGE.width) / 2,
  y: -(H / ZOOM - PAGE.height) / 2,
  scale: { x: ZOOM, y: ZOOM },
};

type GridChoice = 'screen' | 180 | 300;
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

export function DitherDemo() {
  const scene = useScene<DitherNodeData, DitherLayer, RectPose>({
    systemLayers: [{ id: 'art' }, { id: 'marks' }],
    initial: INITIAL_NODES,
  });
  const version = scene.getVersion();
  const [grid, setGrid] = useState<GridChoice>(180);
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
    const marks = [...scene.nodes.values()].filter((n) => n.layer === 'marks') as DitherNode[];
    const w = Math.ceil(PAGE.width / printGrid.pitch);
    const h = Math.ceil(PAGE.height / printGrid.pitch);
    const mask = protectMask(protectRects(marks, protectedRect, printGrid), w, h);
    let current = true;
    let made: ProtectTexture | null = null;
    protectTexture(mask, w, h).then((t) => {
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
    exportPage(scene, { grid: printGrid ?? { pitch: 1, origin: { x: 0, y: 0 } }, method, threshold, crisp })
      .then((image) => {
        if (!live) return;
        const canvas = out.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        canvas.width = image.width;
        canvas.height = image.height;
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
  ].filter(Boolean).join(' ');
  const resolution = printGrid ? `${grid} dpi` : '1 px per point';

  return (
    <div className="ckd-stack">
      <DemoStage width={W} height={H}>
        <SceneCanvas
          features={['view']}
          initialActiveTool="hand"
          defaultView={START}
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
      <figure className={s.export}>
        <canvas ref={out} className={s.print} aria-label="Exported page" />
        <figcaption className={s.caption}>
          Export at {resolution}, {labelOf(method)}
          {exported ? <span className={num.numeric}> · {exported}</span> : null}
        </figcaption>
      </figure>
      <div className="ckd-controls">
        <div className="ckd-control">
          Grid
          <ToggleBar items={GRIDS} value={grid} onChange={(v) => { if (v !== null) setGrid(v); }} ariaLabel="Grid" size="sm" />
        </div>
        <div className="ckd-control">
          Method
          <ToggleBar items={METHODS} value={method} onChange={(v) => { if (v) setMethod(v); }} ariaLabel="Method" size="sm" />
        </div>
        <div className="ckd-control">
          Keep marks crisp
          <ToggleBar items={CRISP} value={crisp} onChange={(v) => { if (v) setCrisp(v); }} ariaLabel="Keep marks crisp" size="sm" />
        </div>
        <label className="ckd-control">
          Threshold
          <InlineRange min={0} max={255} step={1} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
          <output className={`${num.numeric} ${s.readout}`}>{threshold}</output>
        </label>
      </div>
    </div>
  );
}
