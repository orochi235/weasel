import { useCallback, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { arcShape, type Point } from '@weasel-js/geom';
import { rowRun } from '../../Along/rowRun';
import { Along, arcInBox } from '@weasel-js/ui/components/Along';
import { Bar } from '@weasel-js/ui/components/Bar';
import { LabActions } from '../../Along/lab/labActions';
import { Presets } from '../../Along/lab/Presets';
import { num, Readouts, type Readout } from '../../Along/lab/Readouts';
import lab from '../../Along/lab/lab.stories.module.css';
import { arcOf, BAR_ARC_PRESETS, barSchema, type BarArcConfig, type BarArcPreset } from './barArcConfig';
import { useBarMeasure, type BarReading } from './useBarMeasure';
import s from './BarArc.stories.module.css';

const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;

function placedRows(m: BarReading): Readout[] {
  return m.placed.map((p, i) => ({
    id: `placed-${i}`,
    label: p.kind === 'item' ? p.name : `${p.name} (${p.kind})`,
    value: `${num(p.at, 6, 0)} px  ${p.clipped.padEnd(4, ' ')}  ${p.side.padEnd(6, ' ')}`,
  }));
}

/**
 * A bar along an arc built from knobs — how many actions and fields, a panel, a lead — in scroll or menu overflow,
 * aligned and swept as asked. The readouts are read off the page: where each item sits along the run and whether it
 * is clipped, how far a scrolled run is laid back, where More landed, and which side the last popover opened on
 * beside the side the arc's outward normal says it should.
 */
export function BarArcView({ config, onPreset }: { config: BarArcConfig; onPreset: (preset: BarArcPreset) => void }): ReactElement {
  const { center, measure, sweep, length, direction, inset, size } = config.arc;
  const arc = useMemo(() => arcOf({ center, measure, sweep, length, direction, inset }), [center, measure, sweep, length, direction, inset]);
  const shape = useMemo(() => arcShape(arcInBox(arc, { width: size, height: size })), [arc, size]);
  const run = useMemo(() => rowRun(shape), [shape]);
  const reading = useCallback((p: Point) => run.nearest(p, { open: true }).f * run.length, [run]);
  const schema = useMemo(() => barSchema(config.items), [config.items]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [pressed, setPressed] = useState<string[]>([]);
  const onPress = useCallback((key: string) => setPressed((prev) => [...prev.slice(-4), key]), []);
  const root = useRef<HTMLDivElement>(null);
  const m = useBarMeasure(root, shape, reading);
  const more = m.placed.find((p) => p.kind === 'more');
  const vars = { '--box': `${size}px` } as CSSProperties;

  const summary: Readout[] = [
    { id: 'run', label: 'run length', value: `${num(run.length, 6, 0)} px` },
    { id: 'flipped', label: 'flipped', value: String(run.flipped) },
    { id: 'scrolls', label: 'scrolls', value: m.scrolls ? 'yes' : 'no' },
    { id: 'offset', label: 'scroll offset', value: `${num(m.offset, 6, 1)} px` },
    { id: 'more', label: 'More', value: more ? `${num(more.at, 6, 0)} px, opens ${more.side}` : '—' },
    // react-aria turns a popover to the opposite side when the asked one has no room, so only a quarter turn is wrong.
    {
      id: 'popover',
      label: 'popover opened on',
      value: m.popover ? `${m.popover.trigger}: ${m.popover.placement}` : '—',
      bad: !!m.popover && m.popover.placement !== m.popover.side && m.popover.placement !== OPPOSITE[m.popover.side],
    },
    { id: 'popover-side', label: 'asked for (outward)', value: m.popover ? m.popover.side : '—' },
    { id: 'pressed', label: 'pressed', value: pressed.join(' ') || '—' },
  ];

  return (
    <LabActions onPress={onPress}>
      <div className={lab.lab}>
        <div className={`${lab.stack} ${lab.main}`} style={vars}>
          <section className={lab.section} aria-label="Bar">
            <h3 className={lab.sectionTitle}>Along the arc</h3>
            <div ref={root} className={config.debug.boxes ? `${s.box} ${lab.boxes}` : s.box} data-lab-box>
              <Along arc={arc} align={config.layout.align}>
                <Bar
                  label="Lens"
                  schema={schema}
                  values={values}
                  onChange={(path, value) => setValues((prev) => ({ ...prev, [path]: value }))}
                  overflow={config.layout.overflow}
                  {...(config.items.lead === 'none' ? {} : { lead: config.items.lead })}
                />
              </Along>
            </div>
          </section>
          <Presets presets={BAR_ARC_PRESETS} onLoad={onPreset} />
          <p className={lab.note}>
            Scroll the run with the wheel or a drag along it, or Tab through it. Open a field or More to see which side its
            popover takes.
          </p>
        </div>
        <div className={`${lab.stack} ${lab.side}`}>
          <Readouts title="Run" rows={summary} />
          <Readouts title="Items: along, clipped, outward" rows={placedRows(m)} />
        </div>
      </div>
    </LabActions>
  );
}
