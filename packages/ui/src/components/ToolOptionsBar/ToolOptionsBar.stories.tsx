import type { Meta, StoryObj } from '@weasel-js/forge';
import type { PrefGroup } from '@weasel-js/prefs';
import { useState } from 'react';
import { ToolOptionsBar } from '@weasel-js/ui/components/ToolOptionsBar';
import { Button } from '@weasel-js/ui/components/Button';
import { icon } from '../../icons.gen';

const meta: Meta<typeof ToolOptionsBar> = {
  title: 'ui/Foundations/ToolOptionsBar',
  component: ToolOptionsBar,
};
export default meta;

type Story = StoryObj<typeof ToolOptionsBar>;

const STYLE_TOGGLES = [
  { key: 'bold', label: 'B', ariaLabel: 'Bold' },
  { key: 'italic', label: 'I', ariaLabel: 'Italic' },
  { key: 'underline', label: 'U', ariaLabel: 'Underline' },
] as const;

export const OneControlGroup: Story = {
  render: (args) => {
    const [on, setOn] = useState<ReadonlySet<string>>(new Set());
    const toggle = (key: string) =>
      setOn((prev) => {
        const next = new Set(prev);
        if (!next.delete(key)) next.add(key);
        return next;
      });
    return (
      <ToolOptionsBar {...args} label="Text">
        {STYLE_TOGGLES.map(({ key, label, ariaLabel }) => (
          <Button
            key={key}
            size="sm"
            variant="ghost"
            iconOnly
            ariaLabel={ariaLabel}
            pressed={on.has(key)}
            onClick={() => toggle(key)}
          >
            {label}
          </Button>
        ))}
      </ToolOptionsBar>
    );
  },
};

// Contents exceed the row's width — the controls slot scrolls
// horizontally in place rather than wrapping (which would grow the
// row's fixed height) or clipping (which would strand controls with
// no way to reach them).
export const ManyControlsOverflow: Story = {
  render: (args) => (
    <div style={{ width: 360, border: '1px dashed var(--wzl-border)' }}>
      <ToolOptionsBar {...args} label="Text">
        {Array.from({ length: 16 }, (_, i) => (
          <Button key={i} size="sm" variant="ghost">
            {`Opt ${i + 1}`}
          </Button>
        ))}
      </ToolOptionsBar>
    </div>
  ),
};

// Driven by a tool's option schema rather than by children: the leaves draw
// through the same mapping the selection panel uses, and the two paired
// toggles collapse into one segmented bar.
const TEXT_OPTIONS: PrefGroup = {
  name: 'Text',
  children: {
    bold: {
      kind: 'boolean',
      name: 'Bold',
      icon: icon('core:bold'),
      description: 'Heavier weight.',
      short: ['B'],
      control: 'toggle',
      pair: { with: 'italic', label: 'Style' },
      default: false,
    },
    italic: {
      kind: 'boolean',
      name: 'Italic',
      icon: icon('core:italic'),
      description: 'Sloped face.',
      short: ['I'],
      control: 'toggle',
      default: false,
    },
    fontSize: {
      kind: 'number',
      name: 'Size',
      description: 'Type size, in points.',
      default: 12,
      min: 1,
    },
    align: {
      kind: 'enum',
      name: 'Align',
      description: 'Where each line sits in the box.',
      default: 'left',
      control: 'select',
      options: [
        { value: 'left', label: 'Left', icon: icon('core:textAlignLeft') },
        { value: 'center', label: 'Center', icon: icon('core:textAlignCenter') },
        { value: 'right', label: 'Right', icon: icon('core:textAlignRight') },
      ],
    },
    color: { kind: 'color', name: 'Color', description: 'Ink.', alpha: true, default: '#3b82f6' },
  },
};

export const FromASchema: Story = {
  args: { label: 'Text' },
  render: (args) => {
    const [values, setValues] = useState<Record<string, unknown>>({
      bold: true,
      italic: false,
      fontSize: 12,
      align: 'left',
      color: '#3b82f6',
    });
    return (
      <div style={{ width: 640 }}>
        <ToolOptionsBar
          {...args}
          schema={TEXT_OPTIONS}
          values={values}
          onChange={(path, value) => setValues((v) => ({ ...v, [path]: value }))}
        />
      </div>
    );
  },
};

// A path whose sources disagree draws as each control's own indeterminate
// state — what a caret range spanning two differently styled runs shows.
export const MixedValues: Story = {
  args: { label: 'Text' },
  render: (args) => (
    <div style={{ width: 640 }}>
      <ToolOptionsBar
        {...args}
        schema={TEXT_OPTIONS}
        values={{ bold: true, align: 'left' }}
        mixed={new Set(['fontSize', 'italic', 'color'])}
        onChange={() => {}}
      />
    </div>
  ),
};
