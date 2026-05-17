import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import { Button, type ButtonVariant, type ButtonSize } from './Button';

const meta: Meta<typeof Button> = {
  title: 'weasel-ui/Foundations/Button',
  component: Button,
  args: {
    children: 'Save',
    variant: 'secondary',
    size: 'md',
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost'] },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    fullWidth: { control: 'boolean' },
    iconOnly: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

const PlusIcon = (): ReactElement => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M8 3v10M3 8h10" />
  </svg>
);

const ChevronIcon = (): ReactElement => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4l4 4-4 4" />
  </svg>
);

const TrashIcon = (): ReactElement => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 4h10M6.5 4V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M4.5 4l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8" />
  </svg>
);

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Ghost: Story = { args: { variant: 'ghost' } };

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Button size="sm" variant="primary">Small</Button>
      <Button size="md" variant="primary">Medium</Button>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <Button variant="primary" leadingIcon={<PlusIcon />}>Add layer</Button>
      <Button variant="secondary" trailingIcon={<ChevronIcon />}>Next</Button>
      <Button variant="ghost" leadingIcon={<TrashIcon />} trailingIcon={<ChevronIcon />}>
        Delete
      </Button>
    </div>
  ),
};

export const IconOnly: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Button iconOnly ariaLabel="Add" variant="primary"><PlusIcon /></Button>
      <Button iconOnly ariaLabel="Add" variant="secondary"><PlusIcon /></Button>
      <Button iconOnly ariaLabel="Add" variant="ghost"><PlusIcon /></Button>
      <Button iconOnly ariaLabel="Delete" variant="secondary" size="sm"><TrashIcon /></Button>
    </div>
  ),
};

export const Loading: Story = {
  args: { variant: 'primary', loading: true, children: 'Saving…' },
};

export const Disabled: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Button variant="primary" disabled>Primary</Button>
      <Button variant="secondary" disabled>Secondary</Button>
      <Button variant="ghost" disabled>Ghost</Button>
    </div>
  ),
};

export const FullWidth: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <Button variant="primary" fullWidth>Submit</Button>
    </div>
  ),
};

const VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'ghost'];
const SIZES: ButtonSize[] = ['sm', 'md'];

export const Matrix: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(3, 1fr)', gap: 12, alignItems: 'center' }}>
      <div />
      {VARIANTS.map((v) => (
        <div key={v} style={{ fontSize: 11, color: 'var(--wzl-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {v}
        </div>
      ))}
      {SIZES.flatMap((sz) => [
        <div key={`lbl-${sz}`} style={{ fontSize: 11, color: 'var(--wzl-fg-muted)' }}>{sz}</div>,
        ...VARIANTS.map((v) => (
          <div key={`${sz}-${v}`} style={{ display: 'flex', gap: 8 }}>
            <Button variant={v} size={sz}>Button</Button>
            <Button variant={v} size={sz} disabled>Off</Button>
          </div>
        )),
      ])}
    </div>
  ),
};
