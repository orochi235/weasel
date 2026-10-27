import { useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { placeAlongRun, trackRun } from '@weasel-js/geom';
import { TOP_HALF } from './Along';
import type { AlongArc, RunAlign } from './alongContext';
import { placeStyle } from './placeOnRun';
import { joiningRuns } from './joiningRuns';
import { useBoxShape, type BoxShape } from './useBoxShape';
import { useInlineDirection } from './useReadingRun';
import { visualGraphemes } from './visualGraphemes';
import on from './onRun.module.css';
import s from './CurvedLabel.module.css';

/** Props of `CurvedLabel`. */
export interface CurvedLabelProps {
  text: string;
  /** The arc to lay the text on, as `Along` reads it. `shape` wins over it. Default: the top half. */
  arc?: AlongArc;
  /** A track shape, or one built from the box. */
  shape?: BoxShape;
  /** Where text shorter than the track sits. Default `'center'`. */
  align?: RunAlign;
  /** Px the text is laid back along the track from where `align` puts it. Default 0. */
  offset?: number;
  /** Px the text stands off the track, toward its own top. Default 0. */
  shift?: number;
  className?: string;
}

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const graphemes = (text: string): string[] => (segmenter ? [...segmenter.segment(text)].map((g) => g.segment) : [...text]);

/**
 * A line of text laid along an arc or a track shape of the box it fills, one span per grapheme, each centered on its
 * place and tipped to the track; letters of a joining script that join share one span, so Arabic is shaped joined.
 * The text reads upright whichever way the shape runs, its spans in the order the bidi algorithm shows them under its
 * computed `direction`, which also says which end `align` starts from. The center of each glyph box sits
 * on the track, so `shift` lifts the text clear of a line drawn along it. It takes its font and color from its
 * parent, takes no pointer input, and is named by `text` as one image.
 */
export function CurvedLabel({ text, arc = TOP_HALF, shape, align = 'center', offset = 0, shift = 0, className }: CurvedLabelProps): ReactElement {
  const root = useRef<HTMLDivElement>(null);
  const direction = useInlineDirection(root);
  const chars = useMemo(() => visualGraphemes(joiningRuns(graphemes(text)), direction), [text, direction]);
  const [lengths, setLengths] = useState<readonly number[]>([]);
  const made = useBoxShape(root, arc, shape);
  const run = useMemo(() => trackRun(made, 0, 1, { direction }), [made, direction]);

  useLayoutEffect(() => {
    const spans = [...(root.current?.children ?? [])] as HTMLElement[];
    const measure = (): void => {
      const widths = spans.map((el) => el.offsetWidth);
      setLengths((prev) => (prev.length === widths.length && prev.every((w, i) => w === widths[i]) ? prev : widths));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    // A web font landing after mount, or any other change to a span's size, changes its width.
    const watch = new ResizeObserver(measure);
    for (const el of spans) watch.observe(el);
    return () => watch.disconnect();
  }, [chars]);

  const places = placeAlongRun(run, chars.map((_, i) => lengths[i] ?? 0), { align, offset, shift });
  return (
    <div ref={root} className={className ? `${s.label} ${className}` : s.label} role="img" aria-label={text}>
      {chars.map((ch, i) => (
        <span key={i} className={`${on.onRun} ${s.char}`} aria-hidden="true" style={placeStyle(places[i]!)}>
          {ch}
        </span>
      ))}
    </div>
  );
}
