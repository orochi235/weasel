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
  name: 'Preferences',
  children: {
    measure: {
      name: 'Measure',
      children: {
        spacing: { kind: 'number', name: 'Spacing', description: '', default: 20, min: 5, max: 80, step: 5, control: 'slider' },
        angleStep: {
          kind: 'number', name: 'Shift angle step', description: '', default: 15, min: 5, max: 90, step: 5, control: 'slider',
        },
        snap: { kind: 'boolean', name: 'Snap', description: '', default: true },
        tolerance: { kind: 'number', name: 'Snap tolerance in screen pixels', description: '', default: 6, min: 0, max: 40 },
        units: {
          kind: 'enum', name: 'Readout units', description: '', default: 'px',
          options: [{ value: 'px', label: 'Pixels' }, { value: 'mm', label: 'Millimeters' }],
        },
      },
    },
  },
};

function Form({ width, ...args }: Partial<PrefsFormProps> & { width: number }) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  return (
    <div style={{ width, height: 360, display: 'flex' }}>
      <PrefsForm {...args} schema={SCHEMA} values={values} onChange={(path, value) => setValues((v) => withValue(v, path, value))} />
    </div>
  );
}

function withValue(values: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const [key, ...rest] = path.split('.') as [string, ...string[]];
  if (rest.length === 0) return { ...values, [key]: value };
  return { ...values, [key]: withValue((values[key] ?? {}) as Record<string, unknown>, rest.join('.'), value) };
}

/** Two rows across a narrow pane. A label that leaves its control less than the control can be used at — Shift
 *  angle step's slider, Snap tolerance's field — puts the control under it; Spacing and Snap keep theirs beside. */
export const AcrossLongLabels: Story = { args: { layout: 'rail', rowsAcross: 2 }, render: (args) => <Form {...args} width={720} /> };

/** The same rows in the list layout, which has no rail beside them. */
export const AcrossLongLabelsInList: Story = { args: { layout: 'list', rowsAcross: 2 }, render: (args) => <Form {...args} width={540} /> };
