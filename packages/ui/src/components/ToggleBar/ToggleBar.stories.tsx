import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { ToggleBar } from '@weasel-js/ui/components/ToggleBar';
import { Icon } from '@weasel-js/ui/components/Icon';
import { icon } from '../../icons.gen';

const meta: Meta<typeof ToggleBar> = {
  title: 'ui/Foundations/ToggleBar',
  component: ToggleBar,
};

export default meta;
type Story = StoryObj<typeof ToggleBar>;

const alignItems = [
  { value: 'left', label: <Icon name={icon('core:textAlignLeft')} size={16} />, ariaLabel: 'Left', tooltip: 'Left' },
  { value: 'center', label: <Icon name={icon('core:textAlignCenter')} size={16} />, ariaLabel: 'Center', tooltip: 'Center' },
  { value: 'right', label: <Icon name={icon('core:textAlignRight')} size={16} />, ariaLabel: 'Right', tooltip: 'Right' },
  { value: 'justify', label: <Icon name={icon('core:textAlignJustify')} size={16} />, ariaLabel: 'Justify', tooltip: 'Justify' },
];

export const Single: Story = {
  args: { 'aria-label': 'Text alignment' },
  render: ({ 'aria-label': ariaLabel, height, size, variant }) => {
    const [v, setV] = useState<string | null>('center');
    return <ToggleBar items={alignItems} value={v} onChange={setV} aria-label={ariaLabel} height={height} size={size} variant={variant} />;
  },
};

export const Boolean2Segment: Story = {
  args: { 'aria-label': 'Power' },
  render: ({ 'aria-label': ariaLabel, height, size, variant }) => {
    const [v, setV] = useState<string | null>('on');
    return (
      <ToggleBar
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
      <ToggleBar
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
  render: (args) => {
    const [v, setV] = useState<string[]>(['b']);
    const [mixed, setMixed] = useState<string[]>(['i']);
    return (
      <ToggleBar {...args}
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
      <ToggleBar
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
      <ToggleBar
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
      <ToggleBar
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
    return <ToggleBar items={alignItems} value={v} onChange={setV} aria-label={ariaLabel} height={height} size={size} variant={variant} />;
  },
};

export const Minimal: Story = {
  args: { variant: 'minimal' },
  render: ({ 'aria-label': ariaLabel, height, size, variant }) => {
    const [v, setV] = useState<string | null>('center');
    return <ToggleBar items={alignItems} value={v} onChange={setV} aria-label={ariaLabel} height={height} size={size} variant={variant} />;
  },
};

export const AllowDeselect: Story = {
  render: ({ 'aria-label': ariaLabel, height, size, variant }) => {
    const [v, setV] = useState<string | null>('center');
    return <ToggleBar items={alignItems} value={v} onChange={setV} allowDeselect aria-label={ariaLabel} height={height} size={size} variant={variant} />;
  },
};

/** `shortcut` shows in each segment's tooltip as `Name (key)`, named by
 *  `ariaLabel`; `tooltip` replaces that text outright. */
export const Tooltips: Story = {
  render: ({ height, size, variant }) => {
    const [v, setV] = useState<string[]>([]);
    return (
      <ToggleBar
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
