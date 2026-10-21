import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore, type ReactElement } from 'react';
import { asNodeId, SceneCanvas, useScene, type CanvasHelpers, type RenderLayer } from '@weasel-js/core';
import type { ArcTrackSpec, Point } from '@weasel-js/geom';
import { num, Readouts, type Readout } from './Readouts';
import { Presets } from './Presets';
import { readSaved, writeSaved } from './saved';
import { drawHandle, drawTrack } from './trackDraw';
import { HANDLE, HANDLE_IDS, handleNode, handlesFor, measureTrack, readingWords, specFromHandles, type HandleId, type HandleNode, type HandlePoints } from './trackGeometry';
import s from './lab.stories.module.css';

export const STAGE = { width: 560, height: 460 };
const CENTER = { x: 280, y: 236 };
const PROBE = { x: 470, y: 90 };
const SAVED = 'weasel-track-geometry-lab-v1';

/** The knobs the lab reads. */
export interface TrackGeometryConfig {
  direction: 'cw' | 'ccw';
  stations: number;
}

interface ArcPreset {
  name: string;
  start: number;
  end: number;
  direction: 'cw' | 'ccw';
}

/** Arcs worth a look: both halves, either way round, through each of the quarter hours, and a whole circle. */
const ARCS: readonly ArcPreset[] = [
  { name: 'Top half', start: 270, end: 90, direction: 'cw' },
  { name: 'Bottom, ccw', start: 240, end: 120, direction: 'ccw' },
  { name: 'Bottom, cw', start: 120, end: 240, direction: 'cw' },
  { name: 'Right side', start: 30, end: 150, direction: 'cw' },
  { name: 'Left side, ccw', start: 330, end: 210, direction: 'ccw' },
  { name: 'Across 3', start: 75, end: 105, direction: 'cw' },
  { name: 'Across 9', start: 255, end: 285, direction: 'cw' },
  { name: 'Whole circle', start: 0, end: 0, direction: 'cw' },
];

const presetSpec = (p: ArcPreset): ArcTrackSpec => ({ center: CENTER, radius: 150, start: p.start, end: p.end, direction: p.direction });

/** The handle nodes the lab opens with: what was saved, else the top half. */
function initialHandles(): HandleNode[] {
  const saved = readSaved<HandlePoints>(SAVED);
  const points = saved && HANDLE_IDS.every((id) => saved[id] && Number.isFinite(saved[id].x)) ? saved : handlesFor(presetSpec(ARCS[0]!), PROBE);
  return HANDLE_IDS.map((id) => handleNode(id, points[id]));
}

const centerOf = (p: { x: number; y: number }): Point => ({ x: p.x + HANDLE / 2, y: p.y + HANDLE / 2 });

/** Each handle's center: its live pose while it is dragged, else the scene's. */
function readHandles(helpers: CanvasHelpers<HandleNode> | null, pose: (id: HandleId) => HandleNode | undefined): HandlePoints {
  const out = {} as HandlePoints;
  for (const id of HANDLE_IDS) out[id] = centerOf(helpers?.getEffectivePose(id) ?? pose(id) ?? handleNode(id, CENTER));
  return out;
}

/**
 * An arc edited by handles on a weasel canvas, and what `@weasel-js/geom`'s track functions make of it. The
 * center, radius, start, end and probe handles are scene nodes the kit's move tool drags; the overlay reads their
 * live poses, so every station, normal and reading follows the drag. Items stand on the run as `trackRun` places
 * them, the blue arrow is the run's reading direction, and the gray chevrons the shape's own.
 */
export function TrackGeometryView({ config, onConfig }: { config: TrackGeometryConfig; onConfig: (patch: Partial<TrackGeometryConfig>) => void }): ReactElement {
  const items = useMemo(initialHandles, []);
  const scene = useScene<HandleNode>({ items });
  const helpersRef = useRef<CanvasHelpers<HandleNode> | null>(null);
  useSyncExternalStore(
    useCallback((cb: () => void) => helpersRef.current?.subscribeGestures(cb) ?? (() => {}), []),
    () => helpersRef.current?.getGestureVersion() ?? 0,
  );
  const pose = useCallback((id: HandleId) => scene.get(asNodeId(id))?.pose, [scene]);
  const handles = readHandles(helpersRef.current, pose);
  const spec = specFromHandles(handles, config.direction);
  const m = measureTrack(spec, handles.probe, config.stations);

  const version = scene.getVersion();
  useEffect(() => {
    writeSaved(SAVED, readHandles(null, pose));
  }, [version, pose]);

  const layer = useMemo<RenderLayer<unknown>>(() => ({
    id: 'track',
    label: 'Track',
    draw: () => {
      const h = readHandles(helpersRef.current, pose);
      return drawTrack(measureTrack(specFromHandles(h, config.direction), h.probe, config.stations), h);
    },
  }), [pose, config.direction, config.stations]);

  const load = (p: ArcPreset) => {
    const next = handlesFor(presetSpec(p), handles.probe);
    scene.batch(`Load ${p.name}`, () => {
      for (const id of HANDLE_IDS) scene.setPose(asNodeId(id), handleNode(id, next[id]));
    });
    onConfig({ direction: p.direction });
  };

  const arc: Readout[] = [
    { id: 'start', label: 'start', value: `${num(spec.start, 6, 0)}°` },
    { id: 'end', label: 'end', value: `${num(spec.end, 6, 0)}°` },
    { id: 'sweep', label: 'sweep', value: `${num(m.sweep, 6, 0)}°` },
    { id: 'radius', label: 'radius', value: `${num(spec.radius)} px` },
    { id: 'length', label: 'length', value: `${num(m.shape.length)} px` },
  ];
  const run: Readout[] = [
    { id: 'flipped', label: 'flipped', value: String(m.run.flipped) },
    { id: 'reversed', label: 'reversed', value: String(m.run.reversed) },
    { id: 'reading', label: 'reads', value: readingWords(m.run) },
  ];
  const probe: Readout[] = [
    { id: 'shape-f', label: 'shape f', value: num(m.onShape.f, 7, 3) },
    { id: 'shape-f-open', label: 'shape f, open', value: num(m.onShapeOpen.f, 7, 3) },
    { id: 'run-g', label: 'run g', value: num(m.onRun.f, 7, 3) },
    { id: 'run-g-open', label: 'run g, open', value: num(m.onRunOpen.f, 7, 3) },
    { id: 'dist', label: 'distance', value: `${num(m.onShape.dist)} px` },
  ];
  const tips: Readout[] = m.stations.map((st, i) => ({ id: `tip-${i}`, label: `g ${st.g.toFixed(2)}`, value: `${num(st.angle, 7, 1)}°` }));

  return (
    <div className={s.lab}>
      <div className={`${s.stack} ${s.main}`}>
        <div className={s.stage}>
          <SceneCanvas
            features={['pick', 'move']}
            scene={scene}
            helpersRef={helpersRef}
            width={STAGE.width}
            height={STAGE.height}
            backgroundFill={{ color: '#ffffff' }}
            layers={{
              scene: { drawOne: (n) => drawHandle(n.data.id, n.pose.x, n.pose.y) },
              track: { layer, before: 'scene' },
            }}
          />
        </div>
        <Presets presets={ARCS} onLoad={load} />
        <p className={s.note}>
          Drag the black ring to move the center, the blue one to set the radius, green and red to set the start and
          end bearings, and the red dot to probe. A hollow red ring marks where an open <code>nearest</code> lands past
          the arc&apos;s ends.
        </p>
      </div>
      <div className={`${s.stack} ${s.side}`}>
        <Readouts title="Arc" rows={arc} />
        <Readouts title="Run" rows={run} />
        <Readouts title="Probe" rows={probe} />
        <Readouts title="Tip angles" rows={tips} />
      </div>
    </div>
  );
}
