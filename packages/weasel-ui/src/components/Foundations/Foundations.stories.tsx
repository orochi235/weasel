import type { Meta, StoryObj } from '@storybook/react-vite';
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
  token: string;
  label: string;
  description: string;
  weights: { value: number; label: string }[];
}

const FONT_FAMILIES: FamilySpec[] = [
  {
    token: '--wzl-font-ui',
    label: 'UI / display',
    description: 'Oswald — condensed display sans for kit chrome, headings, labels.',
    weights: [
      { value: 300, label: 'Light' },
      { value: 500, label: 'Medium' },
      { value: 700, label: 'Bold' },
    ],
  },
  {
    token: '--wzl-font-body',
    label: 'Body / prose',
    description: 'Inter — humanist sans for paragraphs and long-form reading.',
    weights: [
      { value: 400, label: 'Regular' },
      { value: 500, label: 'Medium' },
      { value: 700, label: 'Bold' },
    ],
  },
  {
    token: '--wzl-font-mono',
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

      <h3 className={s.subhead}>Families & weights</h3>
      <div className={s.familyStack}>
        {FONT_FAMILIES.map((fam) => (
          <div key={fam.token} className={s.familyCard} style={{ fontFamily: `var(${fam.token})` }}>
            <div className={s.familyHeader}>
              <code className={s.textToken}>{fam.token}</code>
              <span className={s.familyLabel}>{fam.label}</span>
            </div>
            <p className={s.familyDescription} style={{ fontFamily: 'var(--wzl-font-body)' }}>
              {fam.description}
            </p>
            <div className={s.weightGrid}>
              {fam.weights.map((w) => (
                <div key={w.value} className={s.weightRow}>
                  <code className={s.weightLabel}>{w.value} {w.label}</code>
                  <span className={s.weightSample} style={{ fontWeight: w.value }}>
                    The quick brown fox jumps over the lazy dog
                  </span>
                  <span className={s.weightSampleItalic} style={{ fontWeight: w.value }}>
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

export const Surfaces: Story = { render: () => <SurfacesView /> };
export const Text: Story = { render: () => <TextView /> };
export const Borders: Story = { render: () => <BordersView /> };
export const Accents: Story = { render: () => <AccentsView /> };
export const Glass: Story = { render: () => <GlassView /> };
export const Primitives: Story = { render: () => <PrimitivesView /> };

export const All: Story = {
  render: () => (
    <>
      <SurfacesView />
      <TextView />
      <BordersView />
      <AccentsView />
      <GlassView />
      <PrimitivesView />
    </>
  ),
};
