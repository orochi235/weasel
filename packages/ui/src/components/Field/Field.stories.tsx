import { useId } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Field, fieldClasses, type FieldProps } from '@weasel-js/ui/components/Field';

const meta: Meta<typeof Field> = {
  title: 'ui/Foundations/Field',
  component: Field,
};
export default meta;

type Story = StoryObj<typeof Field>;

function StackedField(args: FieldProps) {
  const id = useId();
  return (
    <Field {...args}>
      <label className={fieldClasses.label} htmlFor={id}>Width</label>
      <input id={id} aria-describedby={`${id}-hint`} defaultValue="120" style={{ width: 120 }} />
      <span id={`${id}-hint`} className={fieldClasses.hint}>In document units.</span>
    </Field>
  );
}

function RowField(args: FieldProps) {
  const id = useId();
  return (
    <Field {...args}>
      <label className={fieldClasses.label} htmlFor={id}>Snap to grid</label>
      <input id={id} type="checkbox" defaultChecked />
    </Field>
  );
}

function ErrorField(args: FieldProps) {
  const id = useId();
  return (
    <Field {...args}>
      <label className={fieldClasses.label} htmlFor={id}>Name</label>
      <input id={id} aria-invalid aria-describedby={`${id}-error`} defaultValue="" />
      <span id={`${id}-error`} className={fieldClasses.error}>Name is required.</span>
    </Field>
  );
}

export const Stacked: Story = {
  args: { orientation: 'stacked' },
  render: (args) => <StackedField {...args} />,
};

export const Row: Story = {
  args: { orientation: 'row' },
  render: (args) => <RowField {...args} />,
};

export const WithError: Story = {
  render: (args) => <ErrorField {...args} />,
};
