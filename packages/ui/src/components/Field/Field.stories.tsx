import type { Meta, StoryObj } from '@weasel-js/forge';
import { Field, fieldClasses } from '@weasel-js/ui/components/Field';

const meta: Meta<typeof Field> = {
  title: 'ui/Foundations/Field',
  component: Field,
};
export default meta;

type Story = StoryObj<typeof Field>;

export const Stacked: Story = {
  args: { orientation: 'stacked' },
  render: (args) => (
    <Field {...args}>
      <label className={fieldClasses.label}>Width</label>
      <input defaultValue="120" style={{ width: 120 }} />
      <span className={fieldClasses.hint}>In document units.</span>
    </Field>
  ),
};

export const Row: Story = {
  args: { orientation: 'row' },
  render: (args) => (
    <Field {...args}>
      <label className={fieldClasses.label}>Snap to grid</label>
      <input type="checkbox" defaultChecked />
    </Field>
  ),
};

export const WithError: Story = {
  render: (args) => (
    <Field {...args}>
      <label className={fieldClasses.label}>Name</label>
      <input defaultValue="" />
      <span className={fieldClasses.error}>Name is required.</span>
    </Field>
  ),
};
