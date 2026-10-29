import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefsForm, type PrefsFormProps } from '@weasel-js/ui/components/Prefs';

const meta: Meta<typeof PrefsForm> = {
  title: 'ui/Foundations/Prefs',
  component: PrefsForm,
};
export default meta;

type Story = StoryObj<typeof PrefsForm>;

const SCHEMA: PrefGroup = {
  name: 'Effects',
  children: {
    look: {
      name: 'Look',
      children: {
        shadow: {
          name: 'Shadow',
          enableIf: { path: 'look.shadow.on' },
          children: {
            on: { kind: 'boolean', name: 'Shadow on', description: '', default: true, control: 'switch', heading: true },
            blur: { kind: 'number', name: 'Blur', description: '', default: 4, min: 0, max: 40 },
            offset: { kind: 'number', name: 'Offset', description: '', default: 2 },
          },
        },
        glow: {
          name: 'Glow',
          as: 'panel',
          enableIf: { path: 'look.glow.on' },
          children: {
            on: { kind: 'boolean', name: 'Glow on', description: '', default: false, heading: true },
            size: { kind: 'number', name: 'Size', description: '', default: 6, min: 0, max: 40 },
          },
        },
        edge: {
          name: 'Edge',
          as: 'panel',
          children: {
            join: {
              kind: 'enum', name: 'Join', description: '', default: 'round', heading: true,
              options: [{ value: 'round', label: 'Round' }, { value: 'miter', label: 'Miter' }],
            },
            width: { kind: 'number', name: 'Width', description: '', default: 1, min: 0, max: 12 },
          },
        },
      },
    },
  },
};

function Form(args: Partial<PrefsFormProps>) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  return <PrefsForm {...args} schema={SCHEMA} values={values} onChange={(path, value) => setValues((v) => withValue(v, path, value))} />;
}

function withValue(values: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const [key, ...rest] = path.split('.') as [string, ...string[]];
  if (rest.length === 0) return { ...values, [key]: value };
  return { ...values, [key]: withValue((values[key] ?? {}) as Record<string, unknown>, rest.join('.'), value) };
}

/** A leaf marked `heading` is drawn in its section's heading and its panel's title, and has no row beneath. Shadow
 *  and Glow are switched by theirs: each group's `enableIf` reads it, so turning it off dims the group and leaves
 *  only the switch live. */
export const HeadingInRail: Story = { args: { layout: 'rail' }, render: (args) => <Form {...args} /> };

/** The same in a column's heading. */
export const HeadingInColumns: Story = { args: { layout: 'columns' }, render: (args) => <Form {...args} /> };
