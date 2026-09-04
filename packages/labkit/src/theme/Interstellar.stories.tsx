import type { Meta, StoryObj } from '@storybook/react-vite';
import type { TokenName } from '@weasel-js/theme';
import { useTheme } from '@weasel-js/theme/react';
import {
  CheckboxRow,
  ColorRow,
  PropertyList,
  PropertyPanel,
  SliderRow,
  TextRow,
} from '@weasel-js/ui';
import './Interstellar.stories.less';

const meta: Meta = {
  title: 'labkit/Themes/Interstellar',
  parameters: {
    docs: {
      description: {
        component:
          'The interstellar theme: deep-space cosmic gradient + starscape backdrop, glass surfaces, Oswald display type, purple accent. ' +
          'Authored as DTCG in `src/theme/interstellar.tokens.json` and loaded with `loadDTCG`; it extends the built-in weasel theme, overriding values rather than adding tokens.',
      },
    },
  },
};
export default meta;

type Story = StoryObj;

// ── Helpers ──────────────────────────────────────────────────────────

interface Swatch {
  name: string;
  cssVar: string;
}

const SURFACE_TOKENS: Swatch[] = [
  { name: 'bg', cssVar: '--wzl-surface' },
  { name: 'bg-elevated', cssVar: '--wzl-surface-raised' },
  { name: 'bg-canvas', cssVar: '--wzl-surface-sunken' },
  { name: 'border', cssVar: '--wzl-border' },
  { name: 'divider', cssVar: '--wzl-line-subtle' },
];

const TEXT_TOKENS: Swatch[] = [
  { name: 'text', cssVar: '--wzl-fg' },
  { name: 'text-muted', cssVar: '--wzl-fg-muted' },
  { name: 'text-disabled', cssVar: '--wzl-fg-subtle' },
];

const ACCENT_TOKENS: Swatch[] = [
  { name: 'accent', cssVar: '--wzl-accent' },
  { name: 'accent-hover', cssVar: '--wzl-accent-hover' },
  { name: 'focus-ring', cssVar: '--wzl-focus-ring' },
];

const PALETTE_TOKENS: Swatch[] = [
  { name: 'green', cssVar: '--wzl-swatch-green' },
  { name: 'pink', cssVar: '--wzl-swatch-pink' },
  { name: 'cyan', cssVar: '--wzl-swatch-cyan' },
  { name: 'gold', cssVar: '--wzl-swatch-gold' },
  { name: 'amber', cssVar: '--wzl-swatch-amber' },
  { name: 'violet', cssVar: '--wzl-swatch-violet' },
  { name: 'mint', cssVar: '--wzl-swatch-mint' },
  { name: 'sky', cssVar: '--wzl-swatch-sky' },
  { name: 'orange', cssVar: '--wzl-swatch-orange' },
  { name: 'magenta', cssVar: '--wzl-swatch-magenta' },
];

function SwatchGrid({ tokens, title }: { tokens: readonly Swatch[]; title: string }) {
  const { resolved } = useTheme();
  return (
    <div>
      <h3 className="lk-theme-doc__heading">{title}</h3>
      <div className="lk-theme-doc__swatch-grid">
        {tokens.map((t) => (
          <div key={t.cssVar} className="lk-theme-doc__swatch">
            <div className="lk-theme-doc__swatch-fill" style={{ background: `var(${t.cssVar})` }} />
            <div className="lk-theme-doc__swatch-meta">
              <div className="lk-theme-doc__swatch-name">{t.name}</div>
              <code className="lk-theme-doc__swatch-var">{t.cssVar}</code>
              <code className="lk-theme-doc__swatch-value">{resolved[t.cssVar as TokenName]}</code>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NebulaPreview() {
  return (
    <div>
      <h3 className="lk-theme-doc__heading">Cosmic backdrop</h3>
      <div className="lk-theme-doc__nebula" style={{ background: 'var(--wzl-backdrop)' }} />
      <p className="lk-theme-doc__note">
        <code>--wzl-backdrop</code> — four radial gradients (purple, pink, blue) over a dark void
        base. Override per-Lab by passing <code>nebula={'{[colors]}'}</code> to the{' '}
        <code>&lt;Lab&gt;</code> component.
      </p>
    </div>
  );
}

function TypographySample() {
  return (
    <div>
      <h3 className="lk-theme-doc__heading">Typography</h3>
      <div className="lk-theme-doc__type-stack">
        <h1 style={{ font: '300 2.6rem/1 var(--wzl-font-display)', color: 'var(--wzl-fg)' }}>
          Heading display 300
        </h1>
        <h2 style={{ font: '300 1.4rem/1.2 var(--wzl-font-display)', color: 'var(--wzl-fg)' }}>
          Heading 300
        </h2>
        <div
          style={{
            font: '300 0.78rem/1 var(--wzl-font-display)',
            color: 'var(--wzl-fg-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Label uppercase 300
        </div>
        <p style={{ font: '400 0.9rem/1.5 var(--wzl-font-ui)', color: 'var(--wzl-fg)' }}>
          Body 400. Free-form prose at the default font size and line height.
        </p>
        <code
          style={{
            font: '400 0.85rem/1 var(--wzl-font-mono)',
            color: 'var(--wzl-fg)',
            background: 'rgba(0,0,0,0.35)',
            padding: '4px 8px',
            borderRadius: 3,
          }}
        >
          monospace ui-monospace
        </code>
      </div>
    </div>
  );
}

function LivePanelPreview() {
  return (
    <div>
      <h3 className="lk-theme-doc__heading">Live panel</h3>
      <PropertyPanel title="Sample">
        <PropertyList>
          <SliderRow
            label="Opacity"
            value={0.65}
            min={0}
            max={1}
            step={0.01}
            onChange={() => {}}
            format={(v) => v.toFixed(2)}
          />
          <ColorRow label="Fill" value="#b08adb" onChange={() => {}} />
          <ColorRow label="Stroke" value="#1a1428" onChange={() => {}} />
          <TextRow label="Name" value="Untitled" onChange={() => {}} />
          <CheckboxRow label="Visible" value={true} onChange={() => {}} />
        </PropertyList>
      </PropertyPanel>
    </div>
  );
}

// ── Stories ──────────────────────────────────────────────────────────

export const Overview: Story = {
  render: () => (
    <div
      className="lk-theme-doc"
      style={{
        backgroundColor: 'var(--wzl-surface)',
        backgroundImage: 'var(--wzl-backdrop)',
        padding: 32,
        minHeight: '100vh',
      }}
    >
      <h1 style={{ font: '300 2.6rem/1 var(--wzl-font-display)', color: 'var(--wzl-fg)' }}>
        Interstellar
      </h1>
      <p
        style={{
          font: '300 1.05rem/1.4 var(--wzl-font-display)',
          color: 'var(--wzl-fg-muted)',
          maxWidth: 640,
          margin: '12px 0 32px',
        }}
      >
        Deep-space gradient backdrop, dark glass surfaces, Oswald display type, purple accent.
        Default theme for labs running in lab mode.
      </p>
      <div className="lk-theme-doc__grid">
        <SwatchGrid title="Surface" tokens={SURFACE_TOKENS} />
        <SwatchGrid title="Text" tokens={TEXT_TOKENS} />
        <SwatchGrid title="Accent / interactive" tokens={ACCENT_TOKENS} />
        <SwatchGrid title="Palette" tokens={PALETTE_TOKENS} />
        <NebulaPreview />
        <TypographySample />
        <LivePanelPreview />
      </div>
    </div>
  ),
};

export const Palette: Story = {
  render: () => (
    <div
      className="lk-theme-doc"
      style={{
        backgroundColor: 'var(--wzl-surface)',
        backgroundImage: 'var(--wzl-backdrop)',
        padding: 32,
        minHeight: '100vh',
      }}
    >
      <div className="lk-theme-doc__grid">
        <SwatchGrid title="Surface" tokens={SURFACE_TOKENS} />
        <SwatchGrid title="Text" tokens={TEXT_TOKENS} />
        <SwatchGrid title="Accent / interactive" tokens={ACCENT_TOKENS} />
        <SwatchGrid title="Palette" tokens={PALETTE_TOKENS} />
      </div>
    </div>
  ),
};
