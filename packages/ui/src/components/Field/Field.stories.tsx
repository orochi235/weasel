import type { Meta, StoryObj } from '@storybook/react';
import { Field, fieldClasses } from './Field';

const meta: Meta<typeof Field> = {
  title: 'Primitives/Field',
  component: Field,
};
export default meta;

type Story = StoryObj<typeof Field>;

export const Stacked: Story = {
  render: () => (
    <Field orientation="stacked">
      <label className={fieldClasses.label}>Width</label>
      <input className={fieldClasses.label} defaultValue="120" style={{ width: 120 }} />
      <span className={fieldClasses.hint}>In document units.</span>
    </Field>
  ),
};

export const Row: Story = {
  render: () => (
    <Field orientation="row">
      <label className={fieldClasses.label}>Snap to grid</label>
      <input type="checkbox" defaultChecked />
    </Field>
  ),
};

export const WithError: Story = {
  render: () => (
    <Field>
      <label className={fieldClasses.label}>Name</label>
      <input defaultValue="" />
      <span className={fieldClasses.error}>Name is required.</span>
    </Field>
  ),
};
