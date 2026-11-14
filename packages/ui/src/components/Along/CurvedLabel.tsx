import { useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { placeAlongRun, trackRun } from '@weasel-js/geom';
import { graphemeEnds } from '@weasel-js/text';
import { useTrackShape } from './alongContext';
import { placeStyle } from './placeOnRun';
import { joiningRuns } from './joiningRuns';
import { useInlineDirection } from './useRowRun';
import { visualGraphemes } from './visualGraphemes';
import on from './onRun.module.css';
import s from './CurvedLabel.module.css';

/** Props of `CurvedLabel`. */
export interface CurvedLabelProps {
  text: string;
  /** Px the text is laid back along the track from where the `Along`'s `align` puts it. Default 0. */
  offset?: number;
  /** Px the text stands off the track, toward its own top. Default 0. */
  shift?: number;
  className?: string;
}

const graphemes = (text: string): string[] => {
  let at = 0;
  return graphemeEnds(text).map((end) => text.slice(at, (at = end)));
};

/**
 * A line of text laid along the shape of the `Along` it sits in, one span per grapheme, each centered on its place and
 * tipped to the track; letters of a joining script that join share one span, so Arabic is shaped joined.
 * The text reads upright whichever way the shape runs, its spans in the order the bidi algorithm shows them under its
 * computed `direction`, which also says which end the `Along`'s `align` starts from. Reordering takes the engine given to
 * `registerBidi` (`@weasel-js/text`); with none, mixed-direction text keeps its logical order. The center of each glyph box sits
 * on the track, so `shift` lifts the text clear of a line drawn along it. It takes its font and color from its
 * parent, takes no pointer input, and is named by `text` as one image. Outside an `Along` it is a plain line of text.
 */
export function CurvedLabel({ text, offset = 0, shift = 0, className }: CurvedLabelProps): ReactElement {
  const root = useRef<HTMLDivElement>(null);
  const direction = useInlineDirection(root);
  const chars = useMemo(() => visualGraphemes(joiningRuns(graphemes(text)), direction), [text, direction]);
  const [lengths, setLengths] = useState<readonly number[]>([]);
  const along = useTrackShape();
  const shape = along?.shape;
  const run = useMemo(() => (shape ? trackRun(shape, 0, 1, { direction }) : null), [shape, direction]);
  const laid = run !== null;

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
  }, [chars, laid]);

  const cls = className ? `${s.label} ${className}` : s.label;
  if (along === null || run === null) {
    return <div ref={root} className={cls} role="img" aria-label={text}>{text}</div>;
  }
  const places = placeAlongRun(run, chars.map((_, i) => lengths[i] ?? 0), { align: along.align, offset, shift });
  return (
    <div ref={root} className={cls} role="img" aria-label={text}>
      {chars.map((ch, i) => (
        <span key={i} className={`${on.onRun} ${s.char}`} aria-hidden="true" style={placeStyle(places[i]!)}>
          {ch}
        </span>
      ))}
    </div>
  );
}
