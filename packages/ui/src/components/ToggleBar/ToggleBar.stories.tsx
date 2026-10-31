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
  args: { ariaLabel: 'Text alignment' },
  render: ({ ariaLabel, height, size, variant }) => {
    const [v, setV] = useState<string | null>('center');
    return <ToggleBar items={alignItems} value={v} onChange={setV} ariaLabel={ariaLabel} height={height} size={size} variant={variant} />;
  },
};

export const Boolean2Segment: Story = {
  args: { ariaLabel: 'Power' },
  render: ({ ariaLabel, height, size, variant }) => {
    const [v, setV] = useState<string | null>('on');
    return (
      <ToggleBar
        items={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
        value={v}
        onChange={setV}
        ariaLabel={ariaLabel}
        height={height}
        size={size}
        variant={variant}
      />
    );
  },
};

export const Multiple: Story = {
  args: { ariaLabel: 'Text style' },
  render: ({ ariaLabel, height, size, variant }) => {
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
        ariaLabel={ariaLabel}
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
  render: () => {
    const [v, setV] = useState<string[]>(['b']);
    const [mixed, setMixed] = useState<string[]>(['i']);
    return (
      <ToggleBar
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
        ariaLabel="Text style"
      />
    );
  },
};

export const Disabled: Story = {
  render: ({ ariaLabel, height, size, variant }) => {
    const [v, setV] = useState<string | null>('a');
    return (
      <ToggleBar
        items={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B', disabled: true },
          { value: 'c', label: 'C' },
        ]}
        value={v}
        onChange={setV}
        ariaLabel={ariaLabel}
        height={height}
        size={size}
        variant={variant}
      />
    );
  },
};

export const Tall: Story = {
  args: { height: 32 },
  render: ({ ariaLabel, height, size, variant }) => {
    const [v, setV] = useState<string | null>('center');
    return <ToggleBar items={alignItems} value={v} onChange={setV} ariaLabel={ariaLabel} height={height} size={size} variant={variant} />;
  },
};

export const Minimal: Story = {
  args: { variant: 'minimal' },
  render: ({ ariaLabel, height, size, variant }) => {
    const [v, setV] = useState<string | null>('center');
    return <ToggleBar items={alignItems} value={v} onChange={setV} ariaLabel={ariaLabel} height={height} size={size} variant={variant} />;
  },
};

export const AllowDeselect: Story = {
  render: () => {
    const [v, setV] = useState<string | null>('center');
    return <ToggleBar items={alignItems} value={v} onChange={setV} allowDeselect />;
  },
};

/** `shortcut` shows in each segment's tooltip as `Name (key)`, named by
 *  `ariaLabel`; `tooltip` replaces that text outright. */
export const Tooltips: Story = {
  render: () => {
    const [v, setV] = useState<string[]>([]);
    return (
      <ToggleBar
        mode="multiple"
        items={[
          { value: 'b', label: 'B', ariaLabel: 'Bold', shortcut: '⌘B' },
          { value: 'i', label: 'I', ariaLabel: 'Italic', shortcut: '⌘I' },
          { value: 'u', label: 'U', ariaLabel: 'Underline', tooltip: 'Underline — no shortcut' },
        ]}
        value={v}
        onChange={setV}
        ariaLabel="Text style"
      />
    );
  },
};
