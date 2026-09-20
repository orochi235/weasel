import type { Meta, StoryObj } from '@weasel-js/forge';
import type { ToolPrefGroup } from '@weasel-js/core';
import { useState } from 'react';
import { ToolOptionsBar } from './ToolOptionsBar';
import { Button } from '../Button';

const meta: Meta<typeof ToolOptionsBar> = {
  title: 'weasel-ui/Foundations/ToolOptionsBar',
  component: ToolOptionsBar,
};
export default meta;

type Story = StoryObj<typeof ToolOptionsBar>;

// The app reserves this row permanently — this is what it looks like
// with no active tool contributing controls.
export const Empty: Story = {
  render: () => <ToolOptionsBar />,
};

export const OneControlGroup: Story = {
  render: () => (
    <ToolOptionsBar label="Text">
      <Button size="sm" variant="ghost" iconOnly ariaLabel="Bold">B</Button>
      <Button size="sm" variant="ghost" iconOnly ariaLabel="Italic">I</Button>
      <Button size="sm" variant="ghost" iconOnly ariaLabel="Underline">U</Button>
    </ToolOptionsBar>
  ),
};

// Contents exceed the row's width — the controls slot scrolls
// horizontally in place rather than wrapping (which would grow the
// row's fixed height) or clipping (which would strand controls with
// no way to reach them).
export const ManyControlsOverflow: Story = {
  render: () => (
    <div style={{ width: 360, border: '1px dashed var(--wzl-border)' }}>
      <ToolOptionsBar label="Text">
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
const TEXT_OPTIONS: ToolPrefGroup = {
  name: 'Text',
  children: {
    bold: {
      kind: 'boolean',
      name: 'Bold',
      description: 'Heavier weight.',
      short: 'B',
      control: 'toggle',
      pair: 'Style',
      default: false,
    },
    italic: {
      kind: 'boolean',
      name: 'Italic',
      description: 'Sloped face.',
      short: 'I',
      control: 'toggle',
      pair: 'Style',
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
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Center' },
        { value: 'right', label: 'Right' },
      ],
    },
    color: { kind: 'color', name: 'Color', description: 'Ink.', alpha: true, default: '#3b82f6' },
  },
};

export const FromASchema: Story = {
  render: () => {
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
          label="Text"
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
  render: () => (
    <div style={{ width: 640 }}>
      <ToolOptionsBar
        label="Text"
        schema={TEXT_OPTIONS}
        values={{ bold: true, align: 'left' }}
        mixed={new Set(['fontSize', 'italic', 'color'])}
        onChange={() => {}}
      />
    </div>
  ),
};
