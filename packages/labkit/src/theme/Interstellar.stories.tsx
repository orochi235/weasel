import type { Meta, StoryObj } from '@weasel-js/forge';
import type { TokenName } from '@weasel-js/theme';
import { useTheme } from '@weasel-js/theme/react';
import { PropertyField, PropertyList, PropertyPanel } from '@weasel-js/ui/components/Properties';
import './Interstellar.stories.less';
import { decimal } from '@weasel-js/quantity';

const meta: Meta = {
  title: 'labkit/Themes/Interstellar',
  tags: ['gallery'],
  parameters: {
    docs: {
      description: {
        component:
          'The interstellar theme: deep-space cosmic gradient + starscape backdrop, glass surfaces, Oswald display type, purple accent. ' +
          'A pins-only theme definition in `src/theme/interstellar.theme.json`, loaded with `defineTheme`; it extends the built-in weasel theme, overriding values rather than adding tokens.',
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
  { name: 'fuchsia', cssVar: '--wzl-swatch-fuchsia' },
  { name: 'green', cssVar: '--wzl-swatch-green' },
  { name: 'sky', cssVar: '--wzl-swatch-sky' },
  { name: 'amber', cssVar: '--wzl-swatch-amber' },
  { name: 'teal', cssVar: '--wzl-swatch-teal' },
  { name: 'red', cssVar: '--wzl-swatch-red' },
  { name: 'blue', cssVar: '--wzl-swatch-blue' },
  { name: 'citron', cssVar: '--wzl-swatch-citron' },
  { name: 'rose', cssVar: '--wzl-swatch-rose' },
  { name: 'violet', cssVar: '--wzl-swatch-violet' },
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
      <div className="lk-theme-doc__nebula" />
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
        <h1 className="lk-theme-doc__display">Heading display 300</h1>
        <h2 className="lk-theme-doc__h2">Heading 300</h2>
        <div className="lk-theme-doc__label">Label uppercase 300</div>
        <p className="lk-theme-doc__body">
          Body 400. Free-form prose at the default font size and line height.
        </p>
        <code className="lk-theme-doc__mono">monospace ui-monospace</code>
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
          <PropertyField
            kind="number"
            control="slider"
            label="Opacity"
            value={0.65}
            min={0}
            max={1}
            step={0.01}
            onChange={() => {}}
            display={decimal({ places: 2 })}
          />
          <PropertyField kind="color" label="Fill" value="#b08adb" onChange={() => {}} />
          <PropertyField kind="color" label="Stroke" value="#1a1428" onChange={() => {}} />
          <PropertyField kind="string" label="Name" value="Untitled" onChange={() => {}} />
          <PropertyField kind="boolean" label="Visible" value={true} onChange={() => {}} />
        </PropertyList>
      </PropertyPanel>
    </div>
  );
}

// ── Stories ──────────────────────────────────────────────────────────

export const Overview: Story = {
  render: () => (
    <div className="lk-theme-doc lk-theme-doc--page">
      <h1 className="lk-theme-doc__display">Interstellar</h1>
      <p className="lk-theme-doc__lede">
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
    <div className="lk-theme-doc lk-theme-doc--page">
      <div className="lk-theme-doc__grid">
        <SwatchGrid title="Surface" tokens={SURFACE_TOKENS} />
        <SwatchGrid title="Text" tokens={TEXT_TOKENS} />
        <SwatchGrid title="Accent / interactive" tokens={ACCENT_TOKENS} />
        <SwatchGrid title="Palette" tokens={PALETTE_TOKENS} />
      </div>
    </div>
  ),
};
