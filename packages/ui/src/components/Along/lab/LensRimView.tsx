import { useCallback, useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import type { Point } from '@weasel-js/geom';
import { Along, type AlongArc } from '@weasel-js/ui/components/Along';
import { Bar } from '@weasel-js/ui/components/Bar';
import { Button } from '@weasel-js/ui/components/Button';
import { Slider, type Thumb } from '@weasel-js/ui/components/Slider';
import { actionsSchema, LabActions } from './labActions';
import { LENS_IMAGE } from './lensImage';
import { num, Readouts } from './Readouts';
import { readSaved, writeSaved } from './saved';
import lab from './lab.stories.module.css';
import s from './LensRim.stories.module.css';

/** The knobs the lab reads. */
export interface LensRimConfig {
  size: number;
  /** Degrees the lens and everything on its rim is turned clockwise. */
  turn: number;
  actions: number;
  overflow: 'scroll' | 'menu';
}

const ZOOM_STOPS = [1, 2, 4, 8].map((v) => ({ value: v, label: `${v}×` }));
const SAVED = 'weasel-lens-rim-lab-v1';
const mod360 = (deg: number): number => ((deg % 360) + 360) % 360;

/** The rim arcs, turned with the lens: the bar across the top, the zoom across the bottom. */
export function rimArcs(turn: number): { top: AlongArc; bottom: AlongArc } {
  return {
    top: { start: mod360(300 + turn), end: mod360(60 + turn), inset: 18 },
    bottom: { start: mod360(240 + turn), end: mod360(120 + turn), direction: 'ccw', inset: 16 },
  };
}

/** The point in the picture's own px under client point `client`, for a lens `size` px across, turned and zoomed. */
export function pictureAt(client: Point, lens: DOMRect, size: number, turn: number, zoom: number): Point {
  const dx = client.x - (lens.left + lens.width / 2);
  const dy = client.y - (lens.top + lens.height / 2);
  const rad = (-turn * Math.PI) / 180;
  const x = (dx * Math.cos(rad) - dy * Math.sin(rad)) / zoom;
  const y = (dx * Math.sin(rad) + dy * Math.cos(rad)) / zoom;
  return { x: x + size / 2, y: y + size / 2 };
}

/**
 * A round lens filled with a picture, a Bar of actions along its top rim and its zoom Slider along the bottom, both
 * turned and sized with it. The rim's controls take only their own presses: a press anywhere else in the lens goes
 * through to the picture, which marks the spot in its own coordinates, so a mark stays put under a turn or a zoom.
 */
export function LensRimView({ config }: { config: LensRimConfig }): ReactElement {
  const { size, turn } = config;
  const [zoom, setZoom] = useState<Thumb[]>([{ value: 1 }]);
  const [marks, setMarks] = useState<Point[]>(() => readSaved<Point[]>(SAVED) ?? []);
  const [pressed, setPressed] = useState('—');
  useEffect(() => writeSaved(SAVED, marks), [marks]);
  const onPress = useCallback((key: string) => setPressed(key), []);
  const z = zoom[0]!.value;
  const { top, bottom } = rimArcs(turn);

  const mark = (e: ReactPointerEvent<HTMLDivElement>) => {
    const lens = e.currentTarget.getBoundingClientRect();
    setMarks((prev) => [...prev, pictureAt({ x: e.clientX, y: e.clientY }, lens, size, turn, z)]);
    setPressed('picture');
  };
  const vars = { '--lens': `${size}px`, '--turn': `${turn}deg`, '--zoom': String(z) } as CSSProperties;
  const last = marks.at(-1);

  return (
    <LabActions onPress={onPress}>
      <div className={lab.lab}>
        <div className={`${lab.stack} ${lab.main}`}>
          <div className={s.lens} style={vars} data-lens>
            <div className={s.window} onPointerDown={mark} data-lens-picture>
              <div className={s.picture}>
                <img className={s.image} src={LENS_IMAGE} alt="" draggable={false} />
                {marks.map((m, i) => (
                  <span key={i} className={s.mark} data-mark style={{ '--x': `${m.x}px`, '--y': `${m.y}px` } as CSSProperties} />
                ))}
              </div>
              <div className={s.rim} />
            </div>
            <Along arc={top}>
              <Bar label="Lens" schema={actionsSchema(config.actions, 'Lens')} overflow={config.overflow} />
            </Along>
            <Along arc={bottom}>
              <Slider ariaLabel="Zoom" min={1} max={8} stops={ZOOM_STOPS} spacing="even" snap="strict" thumbs={zoom} onInput={setZoom} />
            </Along>
          </div>
          <Button size="sm" onClick={() => setMarks([])}>Clear marks</Button>
        </div>
        <div className={`${lab.stack} ${lab.side}`}>
          <Readouts
            title="Lens"
            rows={[
              { id: 'zoom', label: 'zoom', value: `${z}×` },
              { id: 'turn', label: 'turned', value: `${num(turn, 5, 0)}°` },
              { id: 'pressed', label: 'last press', value: pressed },
              { id: 'marks', label: 'marks', value: String(marks.length) },
              { id: 'last-mark', label: 'last mark', value: last ? `${num(last.x, 6, 1)}, ${num(last.y, 6, 1)}` : '—' },
            ]}
          />
          <p className={lab.note}>
            Press anywhere inside the lens but on the rim&apos;s controls: the press reaches the picture and marks it,
            in the picture&apos;s own px, so the marks turn and zoom with it.
          </p>
        </div>
      </div>
    </LabActions>
  );
}
