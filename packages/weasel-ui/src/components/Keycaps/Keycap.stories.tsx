import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties, ReactElement } from 'react';
import { KeyCap, type KeyCapVariant } from './Keycap';

const VARIANTS: KeyCapVariant[] = ['default', 'minimal'];

const meta: Meta<typeof KeyCap> = {
  title: 'weasel-ui/Foundations/Keycaps/KeyCap',
  component: KeyCap,
  args: {
    label: 'K',
    inverted: false,
    variant: 'default',
  },
  argTypes: {
    label: {
      control: 'text',
      description:
        'Glyph rendered in the chip. Modifiers (⌘ ⌥ ⌃ ⇧ ⇪) and wide glyphs (⇥ ↵ ␣) auto-detect their kind for layout.',
    },
    inverted: {
      control: 'boolean',
      description: 'Dark face / light glyph. Ignored under `variant="minimal"`.',
    },
    variant: {
      control: 'inline-radio',
      options: VARIANTS,
      description: '`default` = filled chip. `minimal` = currentColor border + legend, no fill.',
    },
    className: { table: { disable: true } },
  },
};
export default meta;
type Story = StoryObj<typeof KeyCap>;

/** Default chip — a single ordinary key. */
export const Default: Story = {};

/** Modifier glyphs (⌘ ⌥ ⌃ ⇧ ⇪) auto-get a wider chip. */
export const Modifier: Story = {
  args: { label: '⌘' },
};

/** Wide glyphs (⇥ ↵ ␣) and multi-character labels render extra-wide. */
export const Wide: Story = {
  args: { label: '↵' },
};

/** Inverted chip — dark face, light glyph. Used by `KeySequence` to mark
 *  optional keys (the chip is still rendered but reads as de-emphasized). */
export const Inverted: Story = {
  args: { label: '⌘', inverted: true },
};

/** Minimal variant — no fill; border + legend follow `currentColor`. Use
 *  inline in colored prose / next to colored badges where the chip should
 *  take the surrounding text color. */
export const Minimal: Story = {
  args: { label: 'K', variant: 'minimal' },
};

/** `minimal` inside a colored container — the chip picks up the parent's
 *  `color`. */
export const MinimalInColoredText: Story = {
  args: { label: '⌘', variant: 'minimal' },
  render: (args) => (
    <span style={{ color: '#7fb069' }}>
      Press <KeyCap {...args} /> to confirm.
    </span>
  ),
};

/** Every `KeycapKind` (`square` / `modifier` / `wide`) and every variant
 *  combination side by side. */
export const Gallery: Story = {
  parameters: { controls: { disable: true } },
  render: () => <KeyCapGallery />,
};

function KeyCapGallery(): ReactElement {
  const rows: Array<{ label: string; kind: 'square' | 'modifier' | 'wide' }> = [
    { label: 'A', kind: 'square' },
    { label: '⌘', kind: 'modifier' },
    { label: '⇧', kind: 'modifier' },
    { label: '⌥', kind: 'modifier' },
    { label: '⌃', kind: 'modifier' },
    { label: '↵', kind: 'wide' },
    { label: '⇥', kind: 'wide' },
    { label: '␣', kind: 'wide' },
    { label: 'Esc', kind: 'wide' },
  ];
  const cell: CSSProperties = {
    padding: '6px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    textAlign: 'left',
    verticalAlign: 'middle',
  };
  return (
    <table style={{ borderCollapse: 'collapse', fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#d4c4a8' }}>
      <thead>
        <tr>
          <th style={cell}>label</th>
          <th style={cell}>kind</th>
          <th style={cell}>default</th>
          <th style={cell}>inverted</th>
          <th style={cell}>minimal</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td style={cell}><code>{r.label}</code></td>
            <td style={cell}>{r.kind}</td>
            <td style={cell}><KeyCap label={r.label} /></td>
            <td style={cell}><KeyCap label={r.label} inverted /></td>
            <td style={cell}><KeyCap label={r.label} variant="minimal" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
