import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { SegmentedBar, type SegmentedEachItem, type SegmentedMode, type SegmentedVariant } from '@weasel-js/ui/components/Segmented';
import { range, Sequence, values } from '@weasel-js/ui/components/Sequence';
import type { ControlSize } from '@weasel-js/ui/components/Density';
import { Icon } from '@weasel-js/ui/components/Icon';
import { icon } from '../../icons.gen';

const meta: Meta<typeof SegmentedBar> = {
  title: 'ui/Segmented/SegmentedBar',
  component: SegmentedBar,
};

export default meta;
type Story = StoryObj<typeof SegmentedBar>;

const alignItems = [
  { value: 'left', label: <Icon name={icon('core:textAlignLeft')} size={16} />, ariaLabel: 'Left', tooltip: 'Left' },
  { value: 'center', label: <Icon name={icon('core:textAlignCenter')} size={16} />, ariaLabel: 'Center', tooltip: 'Center' },
  { value: 'right', label: <Icon name={icon('core:textAlignRight')} size={16} />, ariaLabel: 'Right', tooltip: 'Right' },
  { value: 'justify', label: <Icon name={icon('core:textAlignJustify')} size={16} />, ariaLabel: 'Justify', tooltip: 'Justify' },
];

const MODES: readonly SegmentedMode[] = ['single', 'multiple', 'each', 'momentary'];
const VARIANTS: readonly SegmentedVariant[] = ['default', 'minimal', 'flat'];
const SIZES: readonly ControlSize[] = ['sm', 'md'];
const WORDS = ['Move', 'Scale', 'Rotate'];

/** A live bar in `mode`, holding its own state. */
function ModeBar({ mode, variant, size }: { mode: SegmentedMode; variant?: SegmentedVariant; size?: ControlSize }) {
  const [one, setOne] = useState<string | null>('Move');
  const [many, setMany] = useState<string[]>(['Move', 'Rotate']);
  const [pressed, setPressed] = useState<string | null>(null);
  const plain = WORDS.map((w) => ({ value: w, label: w }));
  const common = { 'aria-label': mode, variant, size };
  switch (mode) {
    case 'single':
      return <SegmentedBar {...common} items={plain} value={one} onChange={setOne} />;
    case 'multiple':
      return <SegmentedBar {...common} mode="multiple" items={plain} value={many} onChange={setMany} />;
    case 'each': {
      const items: SegmentedEachItem[] = WORDS.map((w) => ({
        value: w,
        label: w,
        selected: many.includes(w),
        onChange: (on: boolean) => setMany((m) => (on ? [...m, w] : m.filter((x) => x !== w))),
      }));
      return <SegmentedBar {...common} mode="each" items={items} />;
    }
    case 'momentary':
      return <SegmentedBar {...common} mode="momentary" items={plain.map((it) => ({ ...it, label: it.value === pressed ? `${it.value}!` : it.value }))} onAction={setPressed} />;
  }
}

/** Every mode in every variant, each bar live. */
export const ModesByVariant: Story = {
  tags: ['gallery'],
  render: () => (
    <Sequence label="Mode by variant" sweep={values(MODES)} across={values(VARIANTS)}>
      {(mode, variant) => <ModeBar mode={mode} variant={variant} />}
    </Sequence>
  ),
};

/** Every mode at every size. */
export const ModesBySize: Story = {
  tags: ['gallery'],
  render: () => (
    <Sequence label="Mode by size" sweep={values(MODES)} across={values(SIZES)}>
      {(mode, size) => <ModeBar mode={mode} size={size} />}
    </Sequence>
  ),
};

/** Segments from a `Sweep` rather than a list: one per step, labeled by the sweep. */
export const FromASweep: Story = {
  render: ({ size, variant }) => {
    const [v, setV] = useState<number | null>(4);
    return <SegmentedBar aria-label="Spacing" steps={range({ from: 0, to: 16, step: 4 })} value={v} onChange={setV} size={size} variant={variant} />;
  },
};

export const Single: Story = {
  args: { 'aria-label': 'Text alignment' },
  render: ({ 'aria-label': ariaLabel, height, size, variant }) => {
    const [v, setV] = useState<string | null>('center');
    return <SegmentedBar items={alignItems} value={v} onChange={setV} aria-label={ariaLabel} height={height} size={size} variant={variant} />;
  },
};

export const Boolean2Segment: Story = {
  args: { 'aria-label': 'Power' },
  render: ({ 'aria-label': ariaLabel, height, size, variant }) => {
    const [v, setV] = useState<string | null>('on');
    return (
      <SegmentedBar
        items={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
        value={v}
        onChange={setV}
        aria-label={ariaLabel}
        height={height}
        size={size}
        variant={variant}
      />
    );
  },
};

export const Multiple: Story = {
  args: { 'aria-label': 'Text style' },
  render: ({ 'aria-label': ariaLabel, height, size, variant }) => {
    const [v, setV] = useState<string[]>(['b']);
    return (
      <SegmentedBar
        mode="multiple"
        items={[
          { value: 'b', label: 'B' },
          { value: 'i', label: 'I' },
          { value: 'u', label: 'U' },
        ]}
        value={v}
        onChange={setV}
        aria-label={ariaLabel}
        height={height}
        size={size}
        variant={variant}
      />
    );
  },
};

/** `mixedValues` — the aggregated sources disagree. Here the selected text
 *  range is bold throughout, italic in part of it, and never underlined.
 *  Clicking the mixed segment turns it fully on. */
export const MultipleWithMixed: Story = {
  render: ({ height, size, variant }) => {
    const [v, setV] = useState<string[]>(['b']);
    const [mixed, setMixed] = useState<string[]>(['i']);
    return (
      <SegmentedBar
        height={height}
        size={size}
        variant={variant}
        mode="multiple"
        items={[
          { value: 'b', label: 'B' },
          { value: 'i', label: 'I' },
          { value: 'u', label: 'U' },
        ]}
        value={v}
        mixedValues={mixed}
        onChange={(next) => {
          setV(next);
          // A click resolves the segment it touched — keep only the values
          // whose on/off state didn't change.
          setMixed((m) => m.filter((x) => next.includes(x) === v.includes(x)));
        }}
        aria-label="Text style"
      />
    );
  },
};

const steps = Array.from({ length: 32 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

/** Drag across the steps, in any direction: a press on an off step turns on every step the drag reaches, one on an on
 *  step turns them off. */
export const Sweep: Story = {
  args: { 'aria-label': 'Steps' },
  render: ({ 'aria-label': ariaLabel, height, size, variant }) => {
    const [v, setV] = useState<string[]>(['1', '5', '9', '13', '17', '21', '25', '29']);
    return (
      <SegmentedBar
        mode="multiple"
        sweep
        columns={8}
        items={steps}
        value={v}
        onChange={setV}
        aria-label={ariaLabel}
        height={height}
        size={size}
        variant={variant}
      />
    );
  },
};

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => ({ value: d, label: d }));

/** Seven segments four across: `lastRow` places the short row, or `'fill'` stretches it so the well stays a rectangle. */
export const Wrapped: Story = {
  args: { 'aria-label': 'Days', lastRow: 'fill' },
  render: ({ 'aria-label': ariaLabel, height, size, variant, lastRow }) => {
    const [v, setV] = useState<string[]>(['Sat', 'Sun']);
    return (
      <SegmentedBar
        mode="multiple"
        columns={4}
        lastRow={lastRow}
        items={days}
        value={v}
        onChange={setV}
        aria-label={ariaLabel}
        height={height}
        size={size}
        variant={variant}
      />
    );
  },
};

export const Disabled: Story = {
  render: ({ 'aria-label': ariaLabel, height, size, variant }) => {
    const [v, setV] = useState<string | null>('a');
    return (
      <SegmentedBar
        items={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B', disabled: true },
          { value: 'c', label: 'C', disabled: true, disabledReason: 'Needs a selection' },
        ]}
        value={v}
        onChange={setV}
        aria-label={ariaLabel}
        height={height}
        size={size}
        variant={variant}
      />
    );
  },
};

export const Tall: Story = {
  args: { height: 32 },
  render: ({ 'aria-label': ariaLabel, height, size, variant }) => {
    const [v, setV] = useState<string | null>('center');
    return <SegmentedBar items={alignItems} value={v} onChange={setV} aria-label={ariaLabel} height={height} size={size} variant={variant} />;
  },
};

export const Minimal: Story = {
  args: { variant: 'minimal' },
  render: ({ 'aria-label': ariaLabel, height, size, variant }) => {
    const [v, setV] = useState<string | null>('center');
    return <SegmentedBar items={alignItems} value={v} onChange={setV} aria-label={ariaLabel} height={height} size={size} variant={variant} />;
  },
};

export const AllowDeselect: Story = {
  render: ({ 'aria-label': ariaLabel, height, size, variant }) => {
    const [v, setV] = useState<string | null>('center');
    return <SegmentedBar items={alignItems} value={v} onChange={setV} allowDeselect aria-label={ariaLabel} height={height} size={size} variant={variant} />;
  },
};

/** `shortcut` shows in each segment's tooltip as `Name (key)`, named by
 *  `ariaLabel`; `tooltip` replaces that text outright. */
export const Tooltips: Story = {
  render: ({ height, size, variant }) => {
    const [v, setV] = useState<string[]>([]);
    return (
      <SegmentedBar
        height={height}
        size={size}
        variant={variant}
        mode="multiple"
        items={[
          { value: 'b', label: 'B', ariaLabel: 'Bold', shortcut: '⌘B' },
          { value: 'i', label: 'I', ariaLabel: 'Italic', shortcut: '⌘I' },
          { value: 'u', label: 'U', ariaLabel: 'Underline', tooltip: 'Underline — no shortcut' },
        ]}
        value={v}
        onChange={setV}
        aria-label="Text style"
      />
    );
  },
};
