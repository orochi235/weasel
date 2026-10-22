import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { arcShape, placeAlongRun, trackRun } from '@weasel-js/geom';
import { arcInBox } from '../arcInBox';
import { placeStyle } from '../placeOnRun';
import type { AlongArc } from '../alongContext';
import on from '../onRun.module.css';
import lab from './lab.stories.module.css';
import s from './CurvedLabel.stories.module.css';

/** The knobs the lab reads. */
export interface CurvedLabelConfig {
  text: string;
  size: number;
  align: 'start' | 'center' | 'end';
}

/** The two arcs a label is laid on: across the top and across the bottom, both reading left to right. */
export const LABEL_ARCS: Record<'top' | 'bottom', AlongArc> = {
  top: { start: 270, end: 90, inset: 20 },
  bottom: { start: 270, end: 90, direction: 'ccw', inset: 20 },
};

const graphemes = (text: string): string[] => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map((g) => g.segment);

/** `text` laid along `arc` in a `size` px box, one span per grapheme placed with `placeAlongRun`. */
export function CurvedLabel({ text, arc, size, align, name }: { text: string; arc: AlongArc; size: number; align: CurvedLabelConfig['align']; name: string }): ReactElement {
  const root = useRef<HTMLDivElement>(null);
  const chars = useMemo(() => graphemes(text), [text]);
  const [lengths, setLengths] = useState<number[]>([]);
  const run = useMemo(() => trackRun(arcShape(arcInBox(arc, { width: size, height: size }))), [arc, size]);

  useLayoutEffect(() => {
    const measure = (): void => {
      const widths = [...(root.current?.children ?? [])].map((el) => (el as HTMLElement).offsetWidth);
      setLengths((prev) => (prev.length === widths.length && prev.every((w, i) => w === widths[i]) ? prev : widths));
    };
    measure();
    // A web font that lands after the first measure changes every width.
    void document.fonts?.ready.then(measure);
  }, [chars]);

  const places = placeAlongRun(run, chars.map((_, i) => lengths[i] ?? 0), { align });
  return (
    <div ref={root} className={s.box} role="img" aria-label={text} data-label={name} style={{ '--box': `${size}px` } as CSSProperties}>
      {chars.map((ch, i) => (
        <span key={i} className={`${on.onRun} ${s.char}`} aria-hidden="true" data-char="" style={placeStyle(places[i]!)}>
          {ch}
        </span>
      ))}
    </div>
  );
}

/** The lab: one label on a top arc and the same on a bottom arc. */
export function CurvedLabelView({ config }: { config: CurvedLabelConfig }): ReactElement {
  return (
    <div className={lab.lab}>
      <CurvedLabel name="top" text={config.text} arc={LABEL_ARCS.top} size={config.size} align={config.align} />
      <CurvedLabel name="bottom" text={config.text} arc={LABEL_ARCS.bottom} size={config.size} align={config.align} />
    </div>
  );
}
