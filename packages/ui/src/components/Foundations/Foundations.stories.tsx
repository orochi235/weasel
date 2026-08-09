import type { Meta, StoryObj } from '@storybook/react-vite';
import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import s from './Foundations.module.css';

const meta: Meta = {
  title: 'weasel-ui/Foundations',
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj;

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section className={s.section}>
      <h2 className={s.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ token, style }: { token: string; style?: CSSProperties }): ReactElement {
  return (
    <div className={s.swatch}>
      <div className={s.swatchChip} style={{ background: `var(${token})`, ...style }} />
      <code className={s.swatchToken}>{token}</code>
    </div>
  );
}

function SurfacesView(): ReactElement {
  return (
    <Section title="Surfaces">
      <div className={s.surfaceStack}>
        <div className={s.surfaceCard} style={{ background: 'var(--wzl-surface)' }}>
          <code>--wzl-surface</code>
          <span className={s.surfaceCaption}>default panel / app bg</span>
        </div>
        <div className={s.surfaceCard} style={{ background: 'var(--wzl-surface-raised)' }}>
          <code>--wzl-surface-raised</code>
          <span className={s.surfaceCaption}>tooltips, menus, raised cards</span>
        </div>
        <div className={s.surfaceCard} style={{ background: 'var(--wzl-surface-sunken)' }}>
          <code>--wzl-surface-sunken</code>
          <span className={s.surfaceCaption}>inputs, tracks, recessed wells</span>
        </div>
      </div>
    </Section>
  );
}

interface FamilySpec {
  tokens: string[];
  label: string;
  description: string;
  weights: { value: number; label: string }[];
}

const FONT_FAMILIES: FamilySpec[] = [
  {
    tokens: ['--wzl-font-ui', '--wzl-font-display'],
    label: 'UI / display',
    description: 'Oswald — condensed sans. Default face for chrome labels, buttons, menus, and headings. Canonical weight is 300; only 200/300/400 are loaded (Oswald gets blocky above that).',
    weights: [
      { value: 200, label: 'ExtraLight' },
      { value: 300, label: 'Light · canon' },
      { value: 400, label: 'Regular' },
    ],
  },
  {
    tokens: ['--wzl-font-body'],
    label: 'Body',
    description: 'Inter — humanist sans for paragraphs, descriptions, and long-form prose. Body text typically hardcodes its weight rather than routing through --wzl-font-weight-* (those track the UI face).',
    weights: [
      { value: 300, label: 'Light' },
      { value: 400, label: 'Regular' },
      { value: 500, label: 'Medium' },
      { value: 700, label: 'Bold' },
    ],
  },
  {
    tokens: ['--wzl-font-mono'],
    label: 'Mono',
    description: 'System ui-monospace — code, keystroke labels, tabular figures.',
    weights: [
      { value: 400, label: 'Regular' },
      { value: 700, label: 'Bold' },
    ],
  },
];

const SIZE_SCALE = [10, 12, 14, 16, 20, 28, 40] as const;

function TextView(): ReactElement {
  const [sampleSize, setSampleSize] = useState(18);
  return (
    <Section title="Text">
      <h3 className={s.subhead}>Color</h3>
      <div className={s.textGrid}>
        {(['--wzl-fg', '--wzl-fg-muted', '--wzl-fg-subtle'] as const).map((tk) => (
          <div key={tk} className={s.textRow}>
            <code className={s.textToken}>{tk}</code>
            <span className={s.textSample} style={{ color: `var(${tk})` }}>
              The quick brown fox jumps over the lazy dog. 0123456789
            </span>
          </div>
        ))}
        <div className={s.textRow}>
          <code className={s.textToken}>--wzl-fg-on-accent</code>
          <span
            className={s.textSampleOnAccent}
            style={{ color: 'var(--wzl-fg-on-accent)', background: 'var(--wzl-accent)' }}
          >
            On accent fill
          </span>
        </div>
      </div>

      <div className={s.sampleSizeRow}>
        <h3 className={s.subhead} style={{ margin: 0 }}>Families & weights</h3>
        <label className={s.sampleSizeControl}>
          <span className={s.sampleSizeLabel}>sample size</span>
          <input
            type="range"
            min={10}
            max={48}
            step={1}
            value={sampleSize}
            onChange={(e) => setSampleSize(Number(e.target.value))}
          />
          <code className={s.sampleSizeValue}>{sampleSize}px</code>
        </label>
      </div>
      <div className={s.familyStack}>
        {FONT_FAMILIES.map((fam) => (
          <div key={fam.tokens.join('|')} className={s.familyCard} style={{ fontFamily: `var(${fam.tokens[0]})` }}>
            <div className={s.familyHeader}>
              <span className={s.familyTokens}>
                {fam.tokens.map((tk) => <code key={tk} className={s.textToken}>{tk}</code>)}
              </span>
              <span className={s.familyLabel}>{fam.label}</span>
            </div>
            <p className={s.familyDescription} style={{ fontFamily: 'var(--wzl-font-body)' }}>
              {fam.description}
            </p>
            <div className={s.weightGrid}>
              {fam.weights.map((w) => (
                <div key={w.value} className={s.weightRow}>
                  <code className={s.weightLabel}>{w.value} {w.label}</code>
                  <span className={s.weightSample} style={{ fontWeight: w.value, fontSize: sampleSize }}>
                    The quick brown fox jumps over the lazy dog
                  </span>
                  <span className={s.weightSampleItalic} style={{ fontWeight: w.value, fontSize: Math.max(10, sampleSize - 4) }}>
                    italic
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h3 className={s.subhead}>Size scale</h3>
      <div className={s.sizeStack}>
        {SIZE_SCALE.map((px) => (
          <div key={px} className={s.sizeRow}>
            <code className={s.sizeLabel}>{px}px</code>
            <span style={{ fontSize: px, fontFamily: 'var(--wzl-font-body)' }}>
              Type set at {px}px
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function BordersView(): ReactElement {
  return (
    <Section title="Borders">
      <div className={s.borderGrid}>
        <div className={s.borderRow}>
          <code className={s.borderToken}>--wzl-border</code>
          <div className={s.borderSampleWrap}>
            <div className={s.borderSample} style={{ borderColor: 'var(--wzl-border)' }} />
          </div>
        </div>
        <div className={s.borderRow}>
          <code className={s.borderToken}>--wzl-border-strong</code>
          <div className={s.borderSampleWrap}>
            <div className={s.borderSample} style={{ borderColor: 'var(--wzl-border-strong)' }} />
          </div>
        </div>
      </div>
    </Section>
  );
}

function LinesView(): ReactElement {
  // Render each line token as a horizontal rule against a sunken
  // surface — the canonical "structural line on a plot / sunken panel"
  // setting. Borders enclose UI elements; lines partition content.
  const lines: { token: string; description: string }[] = [
    { token: '--wzl-line-subtle', description: 'barely-there separators (table rows, secondary gridlines)' },
    { token: '--wzl-line', description: 'primary gridlines on sunken surfaces' },
    { token: '--wzl-line-strong', description: 'axes, emphasized dividers' },
  ];
  return (
    <Section title="Lines">
      <div
        className={s.borderGrid}
        style={{ background: 'var(--wzl-surface-sunken)', padding: '12px 16px', borderRadius: 'var(--wzl-radius-md)' }}
      >
        {lines.map((l) => (
          <div key={l.token} className={s.borderRow}>
            <code className={s.borderToken}>{l.token}</code>
            <div className={s.borderSampleWrap}>
              <div style={{ width: '100%', height: 1, background: `var(${l.token})` }} />
            </div>
            <span style={{ color: 'var(--wzl-fg-muted)', fontSize: 12 }}>{l.description}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function AccentsView(): ReactElement {
  return (
    <Section title="Accents">
      <div className={s.swatchRow}>
        <Swatch token="--wzl-accent" />
        <Swatch token="--wzl-accent-hover" />
        <Swatch token="--wzl-danger" />
        <Swatch token="--wzl-warning" />
        <Swatch token="--wzl-focus-ring" />
      </div>
    </Section>
  );
}

function GlassView(): ReactElement {
  return (
    <Section title="Frosted glass">
      <div className={s.glassStage}>
        <div className={s.glassPanel} />
      </div>
      <pre className={s.codeSample}>{`background: color-mix(in srgb, var(--wzl-glass-tint) 78%, transparent);
backdrop-filter: blur(3px);`}</pre>
    </Section>
  );
}

function PrimitivesView(): ReactElement {
  return (
    <Section title="Primitive scale">
      <h3 className={s.subhead}>Gray ramp</h3>
      <div className={s.rampRow}>
        {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => (
          <Swatch key={n} token={`--wzl-gray-${n}`} />
        ))}
      </div>
      <h3 className={s.subhead}>Accent ramp</h3>
      <div className={s.rampRow}>
        <Swatch token="--wzl-accent-soft" />
        <Swatch token="--wzl-accent-base" />
        <Swatch token="--wzl-accent-strong" />
      </div>
      <h3 className={s.subhead}>Status</h3>
      <div className={s.rampRow}>
        <Swatch token="--wzl-danger-base" />
        <Swatch token="--wzl-warning-base" />
      </div>
    </Section>
  );
}

interface ColorGroup {
  title: string;
  tokens: string[];
}

const COLOR_TOKEN_GROUPS: ColorGroup[] = [
  {
    title: 'Primitive — grays',
    tokens: [
      '--wzl-gray-50', '--wzl-gray-100', '--wzl-gray-200', '--wzl-gray-300', '--wzl-gray-400',
      '--wzl-gray-500', '--wzl-gray-600', '--wzl-gray-700', '--wzl-gray-800', '--wzl-gray-900',
    ],
  },
  {
    title: 'Primitive — accent & status',
    tokens: ['--wzl-accent-soft', '--wzl-accent-base', '--wzl-accent-strong', '--wzl-danger-base', '--wzl-warning-base'],
  },
  {
    title: 'Semantic — surfaces',
    tokens: ['--wzl-surface', '--wzl-surface-raised', '--wzl-surface-sunken'],
  },
  {
    title: 'Semantic — text',
    tokens: ['--wzl-fg', '--wzl-fg-muted', '--wzl-fg-subtle', '--wzl-fg-on-accent'],
  },
  {
    title: 'Semantic — borders',
    tokens: ['--wzl-border', '--wzl-border-strong'],
  },
  {
    title: 'Semantic — interactive',
    tokens: ['--wzl-accent', '--wzl-accent-hover', '--wzl-danger', '--wzl-warning', '--wzl-focus-ring'],
  },
  {
    title: 'Glass',
    tokens: ['--wzl-glass-tint'],
  },
  {
    title: 'Deprecated aliases',
    tokens: [
      '--wzl-text', '--wzl-text-muted', '--wzl-bg', '--wzl-muted',
      '--wzl-panel-bg', '--wzl-panel-border', '--wzl-input-bg',
      '--wzl-track-bg', '--wzl-track-border',
      '--wzl-thumb-fill', '--wzl-thumb-border', '--wzl-thumb-text',
      '--wzl-button-fill', '--wzl-button-fill-hover', '--wzl-button-fill-pressed', '--wzl-button-text',
    ],
  },
];

function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return rgb.trim();
  const [, r, g, b] = m;
  const toHex = (n: string) => Number(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function ThemedSwatch({ token, theme }: { token: string; theme: 'dark' | 'light' }): ReactElement {
  const ref = useRef<HTMLDivElement | null>(null);
  const [value, setValue] = useState('');
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    setValue(cs.getPropertyValue(token).trim() || cs.backgroundColor);
  }, [token]);
  return (
    <div ref={ref} data-wzl-mode={theme} className={s.swatchPair}>
      <div className={s.swatchPairChip} style={{ background: `var(${token})` }} />
      <code className={s.swatchPairValue}>{rgbToHex(value)}</code>
    </div>
  );
}

function ColorsView(): ReactElement {
  return (
    <Section title="Color tokens">
      <p className={s.colorsIntro}>
        Every semantic and primitive color token, rendered side-by-side in both themes. Hex values
        are read from the live document — drag the theme toggle and watch only the "current" side
        update (the opposite side reads its values from a forced data-wzl-mode override).
      </p>
      {COLOR_TOKEN_GROUPS.map((group) => (
        <div key={group.title} className={s.colorsGroup}>
          <h3 className={s.subhead}>{group.title}</h3>
          <div className={s.colorsTable}>
            <div className={`${s.colorsRow} ${s.colorsHeader}`}>
              <code className={s.colorsTokenHead}>token</code>
              <span className={s.colorsThemeHead}>night</span>
              <span className={s.colorsThemeHead}>day</span>
            </div>
            {group.tokens.map((tk) => (
              <div key={tk} className={s.colorsRow}>
                <code className={s.colorsToken}>{tk}</code>
                <ThemedSwatch token={tk} theme="dark" />
                <ThemedSwatch token={tk} theme="light" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </Section>
  );
}

export const Colors: Story = { render: () => <ColorsView /> };
export const Surfaces: Story = { render: () => <SurfacesView /> };
export const Text: Story = { render: () => <TextView /> };
export const Borders: Story = { render: () => <BordersView /> };
export const Lines: Story = { render: () => <LinesView /> };
export const Accents: Story = { render: () => <AccentsView /> };
export const Glass: Story = { render: () => <GlassView /> };
export const Primitives: Story = { render: () => <PrimitivesView /> };

export const All: Story = {
  render: () => (
    <>
      <SurfacesView />
      <TextView />
      <BordersView />
      <LinesView />
      <AccentsView />
      <GlassView />
      <PrimitivesView />
      <ColorsView />
    </>
  ),
};
