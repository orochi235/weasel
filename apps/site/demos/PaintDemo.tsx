import { SceneCanvas, asNodeId, pathFromD, useScene } from '@weasel-js/core';
import type { Path } from '@weasel-js/core';
import {
  contrastLineColor,
  dashForStrokeStyle,
  oklchDegToHex,
  type FillStyle,
  type Stroke,
} from '@weasel-js/paint';
import styles from './PaintDemo.module.css';

const W = 140, H = 100;
const BOX: Path = pathFromD('M0 0 H112 V72 H0 Z');
const ZIGZAG: Path = pathFromD('M8 62 L38 10 L68 62 L98 10');
const TEAL = oklchDegToHex(0.7, 0.12, 190);
const PLUM = oklchDegToHex(0.55, 0.18, 330);
const SAND = oklchDegToHex(0.86, 0.08, 85);

interface Paint { fill?: FillStyle; stroke?: Stroke }

const SWATCHES: { id: string; label: string; path: Path; paint: Paint }[] = [
  { id: 'solid', label: 'solid, color from oklchDegToHex', path: BOX, paint: {
    fill: { color: TEAL },
  } },
  { id: 'linear', label: "linear gradient through 'oklch'", path: BOX, paint: {
    fill: {
      fill: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
      stops: [{ offset: 0, color: '#e0303a' }, { offset: 1, color: '#3050e0' }],
      units: 'bounds', interpolate: 'oklch',
    },
  } },
  { id: 'radial', label: 'radial gradient', path: BOX, paint: {
    fill: {
      fill: 'radial-gradient', center: { x: 0.5, y: 0.5 }, radius: 0.6,
      stops: [{ offset: 0, color: SAND }, { offset: 1, color: PLUM }],
      units: 'bounds',
    },
  } },
  { id: 'conic', label: 'conic gradient', path: BOX, paint: {
    fill: {
      fill: 'conic-gradient', center: { x: 0.5, y: 0.5 }, angle: 0,
      stops: [
        { offset: 0, color: TEAL }, { offset: 0.5, color: PLUM }, { offset: 1, color: TEAL },
      ],
      units: 'bounds',
    },
  } },
  { id: 'pattern', label: 'built-in tile, named as data', path: BOX, paint: {
    fill: { fill: 'pattern', pattern: { tile: 'hatch', color: PLUM, size: 10, lineWidth: 2 }, units: 'bounds' },
  } },
  { id: 'dashed', label: "dashForStrokeStyle('dashed', 6)", path: ZIGZAG, paint: {
    stroke: {
      paint: { color: PLUM }, width: 6,
      dash: dashForStrokeStyle('dashed', 6), cap: 'round', join: 'round',
    },
  } },
  { id: 'edge', label: 'stroke from contrastLineColor', path: BOX, paint: {
    fill: { color: SAND },
    stroke: { paint: { color: contrastLineColor(SAND, 0.35) }, width: 8, join: 'bevel', align: 'inner' },
  } },
];

/**
 * Each canvas is handed a JSON round-trip of its paint, not the object
 * itself — so what renders is exactly the text printed beside it.
 */
function Swatch({ path, paint }: { path: Path; paint: Paint }) {
  const scene = useScene<Paint & { path: Path }, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: [{
      kind: 'leaf',
      layer: 'default',
      id: asNodeId('swatch'),
      pose: { x: 14, y: 14, width: 112, height: 72 },
      data: { path, ...(JSON.parse(JSON.stringify(paint)) as Paint) },
    }],
  });
  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      backgroundFill={{ color: '#ffffff' }}
      scene={scene}
      selectionMode="none"
    />
  );
}

/**
 * `@weasel-js/paint` is types and a few pure helpers: a fill or a stroke is
 * a plain object, with no renderer, class or handle behind it. Every paint
 * below goes through `JSON.stringify` and back before a canvas sees it.
 */
export function PaintDemo() {
  return (
    <div className={styles.demo}>
      {SWATCHES.map(({ id, label, path, paint }) => (
        <div key={id} className={styles.row}>
          <Swatch path={path} paint={paint} />
          <div>
            <div className={styles.label}>{label}</div>
            <pre className={styles.json}>{JSON.stringify(paint, null, 2)}</pre>
          </div>
        </div>
      ))}
    </div>
  );
}
