import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';
import {
  CheckboxRow,
  ColorRow,
  PropertyList,
  PropertyPanel,
  SliderRow,
  TextRow,
} from '../ui/properties/PropertyPanel';
import './Interstellar.stories.less';

const meta: Meta = {
  title: 'Themes/Interstellar',
  parameters: {
    docs: {
      description: {
        component:
          'The interstellar theme: deep-space cosmic gradient + starscape backdrop, glass surfaces, Oswald display type, purple accent. ' +
          'Tokens live in `src/theme/tokens.less` (defaults) and `src/theme/interstellar.less` (explicit `.lk-theme-interstellar` overrides).',
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
  { name: 'bg', cssVar: '--lk-bg' },
  { name: 'bg-elevated', cssVar: '--lk-bg-elevated' },
  { name: 'bg-canvas', cssVar: '--lk-bg-canvas' },
  { name: 'border', cssVar: '--lk-border' },
  { name: 'divider', cssVar: '--lk-divider' },
];

const TEXT_TOKENS: Swatch[] = [
  { name: 'text', cssVar: '--lk-text' },
  { name: 'text-muted', cssVar: '--lk-text-muted' },
  { name: 'text-disabled', cssVar: '--lk-text-disabled' },
];

const ACCENT_TOKENS: Swatch[] = [
  { name: 'accent', cssVar: '--lk-accent' },
  { name: 'accent-hover', cssVar: '--lk-accent-hover' },
  { name: 'focus-ring', cssVar: '--lk-focus-ring' },
];

const PALETTE_TOKENS: Swatch[] = [
  { name: 'green', cssVar: '--lk-swatch-green' },
  { name: 'pink', cssVar: '--lk-swatch-pink' },
  { name: 'cyan', cssVar: '--lk-swatch-cyan' },
  { name: 'gold', cssVar: '--lk-swatch-gold' },
  { name: 'amber', cssVar: '--lk-swatch-amber' },
  { name: 'violet', cssVar: '--lk-swatch-violet' },
  { name: 'mint', cssVar: '--lk-swatch-mint' },
  { name: 'sky', cssVar: '--lk-swatch-sky' },
  { name: 'orange', cssVar: '--lk-swatch-orange' },
  { name: 'magenta', cssVar: '--lk-swatch-magenta' },
];

/**
 * Resolves a CSS custom property's computed value off `document.documentElement`
 * so swatch cards can display the actual color alongside the var name.
 * Returns null until the first effect runs.
 */
function useResolvedVars(vars: readonly string[]): Record<string, string> {
  const key = vars.join('|');
  const [resolved, setResolved] = useState<Record<string, string>>({});
  useEffect(() => {
    const root = document.querySelector('.lk-theme-interstellar') ?? document.documentElement;
    const cs = window.getComputedStyle(root);
    const out: Record<string, string> = {};
    for (const v of key.split('|')) out[v] = cs.getPropertyValue(v).trim();
    setResolved(out);
  }, [key]);
  return resolved;
}

function SwatchGrid({ tokens, title }: { tokens: readonly Swatch[]; title: string }) {
  const resolved = useResolvedVars(tokens.map((t) => t.cssVar));
  return (
    <div>
      <h3 className="lk-theme-doc__heading">{title}</h3>
      <div className="lk-theme-doc__swatch-grid">
        {tokens.map((t) => (
          <div key={t.cssVar} className="lk-theme-doc__swatch">
            <div
              className="lk-theme-doc__swatch-fill"
              style={{ background: `var(${t.cssVar})` }}
            />
            <div className="lk-theme-doc__swatch-meta">
              <div className="lk-theme-doc__swatch-name">{t.name}</div>
              <code className="lk-theme-doc__swatch-var">{t.cssVar}</code>
              <code className="lk-theme-doc__swatch-value">{resolved[t.cssVar] ?? '…'}</code>
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
      <h3 className="lk-theme-doc__heading">Cosmic backdrop (`--lk-space-nebula`)</h3>
      <div
        className="lk-theme-doc__nebula"
        style={{ background: 'var(--lk-space-nebula)' }}
      />
      <p className="lk-theme-doc__note">
        Default: four radial gradients (purple, pink, blue, then a dark void
        base). Override per-Lab by passing <code>nebula={'{[colors]}'}</code> to
        the <code>&lt;Lab&gt;</code> component.
      </p>
    </div>
  );
}

function TypographySample() {
  return (
    <div>
      <h3 className="lk-theme-doc__heading">Typography</h3>
      <div className="lk-theme-doc__type-stack">
        <h1 style={{ font: '300 2.6rem/1 var(--lk-font-display)', color: 'var(--lk-text)' }}>
          Heading display 300
        </h1>
        <h2 style={{ font: '300 1.4rem/1.2 var(--lk-font-display)', color: 'var(--lk-text)' }}>
          Heading 300
        </h2>
        <div
          style={{
            font: '300 0.78rem/1 var(--lk-font-display)',
            color: 'var(--lk-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Label uppercase 300
        </div>
        <p style={{ font: '400 0.9rem/1.5 var(--lk-font)', color: 'var(--lk-text)' }}>
          Body 400. Free-form prose at the default font size and line height.
        </p>
        <code
          style={{
            font: '400 0.85rem/1 var(--lk-font-mono)',
            color: 'var(--lk-text)',
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
      className="lk-theme-interstellar lk-theme-doc"
      style={{
        background: 'var(--lk-space-nebula)',
        padding: 32,
        minHeight: '100vh',
      }}
    >
      <h1 style={{ font: '300 2.6rem/1 var(--lk-font-display)', color: 'var(--lk-text)' }}>
        Interstellar
      </h1>
      <p
        style={{
          font: '300 1.05rem/1.4 var(--lk-font-display)',
          color: 'var(--lk-text-muted)',
          maxWidth: 640,
          margin: '12px 0 32px',
        }}
      >
        Deep-space gradient backdrop, dark glass surfaces, Oswald display
        type, purple accent. Default theme for labs running in lab mode.
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
      className="lk-theme-interstellar lk-theme-doc"
      style={{
        background: 'var(--lk-space-nebula)',
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
