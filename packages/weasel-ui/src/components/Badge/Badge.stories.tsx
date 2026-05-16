import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';
import { ALL_SHAPES } from './shapes';
import type { BadgeShape, BadgeTone, BadgeVariant } from './types';

const TONES: BadgeTone[] = ['accent', 'info', 'warn', 'danger', 'muted', 'neutral'];
const VARIANTS: BadgeVariant[] = ['outline', 'solid', 'subtle'];

const meta: Meta<typeof Badge> = {
  title: 'weasel-ui/Badge',
  component: Badge,
  args: {
    children: 'LABEL',
    shape: 'pill',
    tone: 'accent',
    variant: 'outline',
    size: 'sm',
  },
  argTypes: {
    shape: { control: 'select', options: ALL_SHAPES },
    tone: { control: 'select', options: TONES },
    variant: { control: 'select', options: VARIANTS },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const AllShapes: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 16, alignItems: 'center' }}>
      {ALL_SHAPES.map((shape) => (
        <div key={shape} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Badge shape={shape as BadgeShape} tone="accent" variant="outline">LABEL</Badge>
          <code style={{ fontSize: 10, opacity: 0.7 }}>{shape}</code>
        </div>
      ))}
    </div>
  ),
};

export const ToneVariantMatrix: Story = {
  render: () => (
    <table style={{ borderCollapse: 'separate', borderSpacing: '12px 8px' }}>
      <thead>
        <tr>
          <th></th>
          {VARIANTS.map((v) => <th key={v} style={{ fontSize: 10, textTransform: 'uppercase', opacity: 0.7 }}>{v}</th>)}
        </tr>
      </thead>
      <tbody>
        {TONES.map((tone) => (
          <tr key={tone}>
            <td style={{ fontSize: 10, textTransform: 'uppercase', opacity: 0.7 }}>{tone}</td>
            {VARIANTS.map((variant) => (
              <td key={variant}><Badge tone={tone} variant={variant}>LABEL</Badge></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Badge size="sm" tone="accent">SMALL</Badge>
      <Badge size="md" tone="accent">MEDIUM</Badge>
    </div>
  ),
};

export const WithDot: Story = { args: { dot: true } };

export const WithLeadingIcon: Story = {
  args: {
    leadingIcon: (
      <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
        <circle cx="6" cy="6" r="3" />
      </svg>
    ),
  },
};

export const Removable: Story = { args: { onRemove: () => {} } };

export const Clickable: Story = { args: { onClick: () => {} } };

export const EdgeCases: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <Badge tone="info">A very long label that tests overflow</Badge>
      <Badge shape="dot" tone="warn" dot> </Badge>
      <Badge shape="starburst" tone="danger" variant="solid">NEW</Badge>
      <Badge shape="banner" tone="accent">BANNER</Badge>
      <Badge shape="perforated" tone="muted">STAMP</Badge>
    </div>
  ),
};

export const SlotPillReplica: Story = {
  name: 'Slot pill (migration parity)',
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <Badge shape="pill" tone="accent" variant="outline">active</Badge>
      <Badge shape="pill" tone="warn" variant="outline">ambient</Badge>
      <Badge shape="pill" tone="info" variant="outline">hotkey</Badge>
      <Badge shape="pill" tone="danger" variant="solid">inactive</Badge>
    </div>
  ),
};
