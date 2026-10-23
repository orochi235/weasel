import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefsForm, type PrefsFormProps } from '@weasel-js/ui/components/Prefs';

const meta: Meta<typeof PrefsForm> = {
  title: 'Primitives/Prefs',
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
          children: {
            on: { kind: 'boolean', name: 'Shadow on', description: '', default: true, control: 'switch', heading: true },
            blur: { kind: 'number', name: 'Blur', description: '', default: 4, min: 0, max: 40, enableIf: { path: 'look.shadow.on' } },
            offset: { kind: 'number', name: 'Offset', description: '', default: 2, enableIf: { path: 'look.shadow.on' } },
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

/** A leaf marked `heading` is drawn in its section's heading and its panel's title, and has no row beneath. */
export const HeadingInRail: Story = { args: { layout: 'rail' }, render: (args) => <Form {...args} /> };

/** The same in a column's heading. */
export const HeadingInColumns: Story = { args: { layout: 'columns' }, render: (args) => <Form {...args} /> };
