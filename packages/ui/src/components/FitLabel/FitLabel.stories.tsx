import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { SegmentedBar } from '@weasel-js/ui/components/Segmented';
import { FitLabel, FitScope, useFitScale, useFitScope } from '@weasel-js/ui/components/FitLabel';
import s from './FitLabel.stories.module.css';

const meta: Meta<typeof FitLabel> = {
  title: 'ui/FitLabel',
  component: FitLabel,
};

export default meta;
type Story = StoryObj<typeof FitLabel>;

const CASES = [
  { value: 'none', forms: ['None', '–'] },
  { value: 'upper', forms: ['Uppercase', 'Upper', 'AA'] },
  { value: 'lower', forms: ['Lowercase', 'Lower', 'aa'] },
  { value: 'title', forms: ['Capitalize', 'Title', 'Aa'] },
];

const STATUS = [
  ['Selection: 3 objects', '3 objects', '3'],
  ['Zoom: 100%', '100%'],
  ['Snapping to grid', 'Grid', '#'],
  ['Layer: Background', 'Background', 'Bg'],
];

/** Drag the box's corner: the segments step down together as it narrows. */
export const InASegmentedBar: Story = {
  render: (args) => {
    const [v, setV] = useState<string | null>('none');
    return (
      <div className={s.room}>
        <SegmentedBar
          aria-label="Case"
          items={CASES.map((c) => ({ value: c.value, label: <FitLabel {...args} forms={c.forms} />, ariaLabel: c.forms[0] }))}
          value={v}
          onChange={setV}
        />
      </div>
    );
  },
};

/** A scope of your own: any element that `useFitScope` measures and `FitScope` hands to its labels. Here a
 *  status line; every item steps down together, and one with fewer forms holds its last. */
export const OwnScope: Story = {
  render: () => (
    <div className={`${s.room} ${s.wide}`}>
      <StatusLine />
    </div>
  ),
};

/** A scope inside another steps at least as far as the outer one: the segmented bar shortens along with the
 *  status line around it, though its own labels would still fit. */
export const Nested: Story = {
  render: () => {
    const [v, setV] = useState<string | null>('upper');
    return (
      <div className={`${s.room} ${s.wide}`}>
        <StatusLine>
          <SegmentedBar
            aria-label="Case"
            items={CASES.map((c) => ({ value: c.value, label: <FitLabel forms={c.forms} />, ariaLabel: c.forms[0] }))}
            value={v}
            onChange={setV}
          />
        </StatusLine>
      </div>
    );
  },
};

/** A scale stage: given `scale`, the scope fits members that join it through `useFitScale` by measurement, and
 *  every one prints at the smallest scale any of them needs, floored at `min`. KeyBank's legends work this way. */
export const ScaleStage: Story = {
  render: () => (
    <div className={s.room}>
      <ScaledCells words={['Insert', 'Delete', 'Home', 'Page Down']} />
    </div>
  ),
};

function StatusLine({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const fit = useFitScope(ref);
  return (
    <div ref={ref} className={s.line}>
      <FitScope value={fit}>
        {STATUS.map((forms) => (
          <span key={forms[0]} className={s.item}>
            <FitLabel forms={forms} />
          </span>
        ))}
        {children}
      </FitScope>
    </div>
  );
}

function ScaledCells({ words }: { words: readonly string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const fit = useFitScope(ref, { scale: { min: 0.5, property: '--cell-scale' } });
  return (
    <div ref={ref} className={s.cells}>
      <FitScope value={fit}>
        {words.map((w) => (
          <ScaledCell key={w} text={w} />
        ))}
      </FitScope>
    </div>
  );
}

/** One member: the scale its text fits its cell at, measured unscaled since the scale is a transform. */
function ScaledCell({ text }: { text: string }) {
  const scale = useFitScale();
  const id = useId();
  const cell = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = cell.current;
    if (!scale || !el) return;
    scale.join(id, {
      el,
      measure: () => {
        const natural = inner.current?.offsetWidth ?? 0;
        return natural > 0 ? { scale: Math.min(1, el.clientWidth / natural), shared: true } : null;
      },
      onFit: () => {},
    });
    return () => scale.leave(id);
  }, [scale, id]);
  return (
    <span ref={cell} className={s.cell}>
      <span ref={inner} className={s.cellText}>{text}</span>
    </span>
  );
}
