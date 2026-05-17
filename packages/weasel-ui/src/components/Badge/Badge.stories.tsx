import { useState, type CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';
import { ALL_SHAPES } from './shapes';
import type { BadgeShape, BadgeTone, BadgeVariant } from './types';
import { BASES, type BadgeBase } from './bases';
import { EFFECTS, type BadgeEffect, type EffectSpec } from './effects';

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
    strokeWidth: 1,
  },
  argTypes: {
    children: { control: 'text', description: 'Badge label content' },
    shape: { control: 'select', options: ALL_SHAPES },
    tone: { control: 'select', options: TONES },
    variant: { control: 'inline-radio', options: VARIANTS },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    strokeWidth: {
      control: { type: 'range', min: 0, max: 6, step: 0.25 },
      description: 'Outline thickness in CSS px (applies to every shape).',
    },
    padding: {
      control: 'text',
      description: 'Optional CSS padding override (any CSS padding string). If set, overrides the TRBL sliders.',
    },
    crawl: {
      control: { type: 'range', min: 0, max: 2, step: 0.05 },
      description: 'Continuously shifts perimeter-pattern shapes (beavis, cloud). 0 = off; value = cycles per second.',
    },
    shapeParams: {
      control: 'object',
      description: "Shape-specific params, e.g. { erosion: 0.5 } for square/notched, { left: 'outward', right: 'inward' } for ribbon.",
    },
    onClick: { table: { disable: true } },
    onRemove: { table: { disable: true } },
    removeLabel: { table: { disable: true } },
    href: { table: { disable: true } },
    as: { table: { disable: true } },
    className: { table: { disable: true } },
    'aria-label': { table: { disable: true } },
  },
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

type ShapeControl =
  | { key: string; kind: 'range'; min: number; max: number; step: number; default: number }
  | { key: string; kind: 'select'; options: string[]; default: string };

const SHAPE_CONTROLS: Partial<Record<BadgeShape, ShapeControl[]>> = {
  square: [
    { key: 'erosion', kind: 'range', min: 0, max: 1, step: 0.02, default: 0.16 },
  ],
  hexagon: [
    { key: 'tipHeight', kind: 'range', min: 0, max: 49, step: 1, default: 25 },
    { key: 'tipTruncation', kind: 'range', min: 0, max: 49, step: 1, default: 0 },
  ],
  shield: [
    { key: 'pointDepth', kind: 'range', min: 60, max: 110, step: 1, default: 100 },
    { key: 'shoulderY', kind: 'range', min: 20, max: 80, step: 1, default: 55 },
    { key: 'curveTightness', kind: 'range', min: 0.1, max: 1, step: 0.05, default: 0.7 },
    { key: 'erosion', kind: 'range', min: 0, max: 1, step: 0.05, default: 0.33 },
  ],
  scalloped: [
    { key: 'scallopRadius', kind: 'range', min: 1, max: 12, step: 0.5, default: 5 },
    { key: 'scallopSpacing', kind: 'range', min: 4, max: 30, step: 1, default: 12 },
    { key: 'irregularity', kind: 'range', min: 0, max: 1, step: 0.05, default: 0 },
  ],
  notched: [
    { key: 'erosion', kind: 'range', min: 0, max: 1, step: 0.02, default: 0.28 },
    { key: 'eccentricity', kind: 'range', min: 0.3, max: 3, step: 0.1, default: 1 },
  ],
  perforated: [
    { key: 'holeRadius', kind: 'range', min: 1, max: 8, step: 0.5, default: 3.5 },
    { key: 'holePitch', kind: 'range', min: 6, max: 24, step: 1, default: 11 },
  ],
  ribbon: [
    { key: 'left', kind: 'select', options: ['inward', 'outward', 'flat'], default: 'inward' },
    { key: 'right', kind: 'select', options: ['inward', 'outward', 'flat'], default: 'outward' },
    { key: 'taperWidth', kind: 'range', min: 4, max: 30, step: 1, default: 12 },
  ],
  beavis: [
    { key: 'points', kind: 'range', min: 8, max: 96, step: 1, default: 44 },
    { key: 'cornerRadius', kind: 'range', min: 0, max: 30, step: 1, default: 6 },
    { key: 'vertSpikeLen', kind: 'range', min: 0, max: 80, step: 1, default: 36 },
    { key: 'horzSpikeLen', kind: 'range', min: 0, max: 40, step: 1, default: 9 },
    { key: 'cornerSpikeLen', kind: 'range', min: 0, max: 20, step: 1, default: 3 },
    { key: 'spikeBaseWidth', kind: 'range', min: 0.5, max: 12, step: 0.5, default: 3 },
    { key: 'axisBias', kind: 'range', min: -1, max: 1, step: 0.05, default: 0 },
    { key: 'irregularity', kind: 'range', min: 0, max: 1, step: 0.05, default: 0 },
  ],
  sparkler: [
    { key: 'points', kind: 'range', min: 4, max: 32, step: 1, default: 16 },
    { key: 'outerR', kind: 'range', min: 50, max: 80, step: 1, default: 58 },
    { key: 'innerR', kind: 'range', min: 30, max: 55, step: 1, default: 50 },
    { key: 'rotation', kind: 'range', min: -45, max: 45, step: 1, default: -5 },
  ],
  starburst: [
    { key: 'points', kind: 'range', min: 4, max: 24, step: 1, default: 12 },
    { key: 'outerR', kind: 'range', min: 30, max: 60, step: 1, default: 48 },
    { key: 'innerR', kind: 'range', min: 15, max: 50, step: 1, default: 36 },
    { key: 'rotation', kind: 'range', min: -45, max: 45, step: 1, default: -7 },
    { key: 'erosion', kind: 'range', min: 0, max: 1, step: 0.05, default: 0 },
  ],
  postage: [
    { key: 'biteRadius', kind: 'range', min: 1, max: 8, step: 0.5, default: 3 },
    { key: 'biteSpacing', kind: 'range', min: 4, max: 24, step: 0.5, default: 8 },
    { key: 'irregularity', kind: 'range', min: 0, max: 1, step: 0.05, default: 0 },
  ],
  cloud: [
    { key: 'bumpWidth', kind: 'range', min: 8, max: 50, step: 1, default: 24 },
    { key: 'puffiness', kind: 'range', min: 2, max: 30, step: 1, default: 14 },
    { key: 'padding', kind: 'range', min: 0, max: 40, step: 1, default: 18 },
    { key: 'roundness', kind: 'range', min: 0, max: 1, step: 0.05, default: 0 },
    { key: 'irregularity', kind: 'range', min: 0, max: 1, step: 0.05, default: 0 },
  ],
  house: [
    { key: 'eaveY', kind: 'range', min: 5, max: 90, step: 1, default: 32 },
    { key: 'peakHeight', kind: 'range', min: 0, max: 60, step: 1, default: 32 },
    { key: 'roofOverhang', kind: 'range', min: 0, max: 12, step: 1, default: 0 },
  ],
  crest: [
    { key: 'topInset', kind: 'range', min: 0, max: 35, step: 1, default: 12 },
    { key: 'pointDepth', kind: 'range', min: 60, max: 110, step: 1, default: 100 },
  ],
  plaque: [
    { key: 'bevelWidth', kind: 'range', min: 0, max: 20, step: 1, default: 6 },
    { key: 'lightFrom', kind: 'select', options: ['tl', 'tr', 'bl', 'br'], default: 'tl' },
    { key: 'rivetRadius', kind: 'range', min: 0, max: 6, step: 0.2, default: 2.4 },
    { key: 'rivetInset', kind: 'range', min: 3, max: 16, step: 0.5, default: 7 },
  ],
  coffin: [
    { key: 'headX', kind: 'range', min: 0, max: 40, step: 1, default: 6 },
    { key: 'headHalfHeight', kind: 'range', min: 2, max: 50, step: 1, default: 23 },
    { key: 'shoulderX', kind: 'range', min: 5, max: 70, step: 1, default: 33 },
    { key: 'shoulderHalfHeight', kind: 'range', min: 0, max: 45, step: 1, default: 36 },
    { key: 'footX', kind: 'range', min: 50, max: 100, step: 1, default: 100 },
    { key: 'footHalfHeight', kind: 'range', min: 2, max: 50, step: 1, default: 29 },
  ],
  receipt: [
    { key: 'teeth', kind: 'range', min: 4, max: 30, step: 1, default: 11 },
    { key: 'tearDepth', kind: 'range', min: 1, max: 12, step: 0.5, default: 4 },
    { key: 'sideToTopRatio', kind: 'range', min: 0.2, max: 8, step: 0.1, default: 3 },
  ],
};

function defaultParamsFor(shape: BadgeShape): Record<string, number | string> {
  const controls = SHAPE_CONTROLS[shape] ?? [];
  const init: Record<string, number | string> = {};
  for (const c of controls) init[c.key] = c.default;
  return init;
}

function ShapeCard({ shape, strokeWidth, tone, variant, label, params, onChange }: {
  shape: BadgeShape;
  strokeWidth: number;
  tone: BadgeTone;
  variant: BadgeVariant;
  label: string;
  params: Record<string, number | string>;
  onChange: (key: string, value: number | string) => void;
}) {
  const controls = SHAPE_CONTROLS[shape] ?? [];
  const setParams = (updater: (p: Record<string, number | string>) => Record<string, number | string>) => {
    const next = updater(params);
    for (const k of Object.keys(next)) {
      if (next[k] !== params[k]) onChange(k, next[k]);
    }
  };
  const labelStyle: CSSProperties = { fontSize: 9, opacity: 0.7, fontFamily: 'monospace' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 6, background: 'rgba(255,255,255,0.02)', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', minHeight: 56 }}>
        <Badge shape={shape} tone={tone} variant={variant} strokeWidth={strokeWidth} shapeParams={params as never}>{label}</Badge>
      </div>
      <code style={{ fontSize: 10, opacity: 0.85, textAlign: 'center' }}>{shape}</code>
      {controls.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {controls.map((c) => (
            <label key={c.key} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 36px', alignItems: 'center', gap: 6 }}>
              <span style={labelStyle}>{c.key}</span>
              {c.kind === 'range' ? (
                <>
                  <input
                    type="range"
                    min={c.min}
                    max={c.max}
                    step={c.step}
                    value={params[c.key] as number}
                    onChange={(e) => setParams((p) => ({ ...p, [c.key]: Number(e.target.value) }))}
                    style={{ width: '100%' }}
                  />
                  <span style={labelStyle}>{params[c.key]}</span>
                </>
              ) : (
                <>
                  <select
                    value={params[c.key] as string}
                    onChange={(e) => setParams((p) => ({ ...p, [c.key]: e.target.value }))}
                    style={{ width: '100%', fontSize: 10 }}
                  >
                    {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <span />
                </>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

const SHAPE_CATEGORIES: { title: string; shapes: BadgeShape[] }[] = [
  {
    title: 'Basic',
    shapes: ['pill', 'plain', 'square', 'notched', 'hexagon', 'ribbon'],
  },
  {
    title: 'Detailed',
    shapes: ['shield', 'scalloped', 'perforated', 'postage', 'starburst', 'sparkler', 'plaque'],
  },
  {
    title: 'Themed',
    shapes: ['house', 'cloud', 'beavis', 'crest', 'urn', 'coffin', 'receipt', 'wood'],
  },
];

function buildExport(allParams: Record<BadgeShape, Record<string, number | string>>) {
  // Only include shapes that have non-default values.
  const diff: Record<string, Record<string, number | string>> = {};
  for (const shape of ALL_SHAPES) {
    const current = allParams[shape];
    const controls = SHAPE_CONTROLS[shape] ?? [];
    if (!current || controls.length === 0) continue;
    const changed: Record<string, number | string> = {};
    for (const c of controls) {
      if (current[c.key] !== c.default) changed[c.key] = current[c.key];
    }
    if (Object.keys(changed).length > 0) diff[shape] = changed;
  }
  return diff;
}

function formatExportAsTs(diff: Record<string, Record<string, number | string>>) {
  const lines: string[] = ['// Drop into SHAPE_CONTROLS as new defaults:'];
  for (const [shape, params] of Object.entries(diff)) {
    lines.push(`${shape}: {`);
    for (const [k, v] of Object.entries(params)) {
      lines.push(`  ${k}: ${typeof v === 'string' ? JSON.stringify(v) : v},`);
    }
    lines.push('},');
  }
  return lines.join('\n');
}

function AllShapesView({ strokeWidth, tone, variant, label }: {
  strokeWidth: number;
  tone: BadgeTone;
  variant: BadgeVariant;
  label: string;
}) {
  const [allParams, setAllParams] = useState<Record<BadgeShape, Record<string, number | string>>>(() => {
    const init: Record<string, Record<string, number | string>> = {};
    for (const shape of ALL_SHAPES) init[shape] = defaultParamsFor(shape);
    return init as Record<BadgeShape, Record<string, number | string>>;
  });
  const [exportText, setExportText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleExport = () => {
    const diff = buildExport(allParams);
    const text = Object.keys(diff).length === 0
      ? '// (no changes from defaults)'
      : formatExportAsTs(diff);
    setExportText(text);
    setCopied(false);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => setCopied(true)).catch(() => {});
    }
  };

  const handleReset = () => {
    const init: Record<string, Record<string, number | string>> = {};
    for (const shape of ALL_SHAPES) init[shape] = defaultParamsFor(shape);
    setAllParams(init as Record<BadgeShape, Record<string, number | string>>);
    setExportText(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={handleExport} style={{ fontSize: 11, padding: '6px 12px', cursor: 'pointer' }}>
          Export non-default params
        </button>
        <button onClick={handleReset} style={{ fontSize: 11, padding: '6px 12px', cursor: 'pointer' }}>
          Reset all
        </button>
        {copied && <span style={{ fontSize: 10, opacity: 0.7 }}>copied to clipboard</span>}
      </div>
      {exportText !== null && (
        <textarea
          readOnly
          value={exportText}
          rows={Math.min(20, Math.max(4, exportText.split('\n').length + 1))}
          style={{ fontFamily: 'monospace', fontSize: 11, padding: 8, width: '100%', boxSizing: 'border-box' }}
        />
      )}
      {SHAPE_CATEGORIES.map((cat) => (
        <section key={cat.title}>
          <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7, margin: '0 0 12px', fontFamily: 'monospace' }}>{cat.title}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, alignItems: 'start' }}>
            {cat.shapes.map((shape) => (
              <ShapeCard
                key={shape}
                shape={shape}
                strokeWidth={strokeWidth}
                tone={tone}
                variant={variant}
                label={label}
                params={allParams[shape] ?? defaultParamsFor(shape)}
                onChange={(key, value) => setAllParams((prev) => ({ ...prev, [shape]: { ...prev[shape], [key]: value } }))}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export const AllShapes: Story = {
  args: {
    children: 'ZORF',
    tone: 'muted',
    variant: 'outline',
    strokeWidth: 4.25,
  },
  argTypes: {
    shape: { table: { disable: true } },
    shapeParams: { table: { disable: true } },
  },
  render: (args) => (
    <AllShapesView
      strokeWidth={args.strokeWidth ?? 1}
      tone={args.tone ?? 'accent'}
      variant={args.variant ?? 'outline'}
      label={typeof args.children === 'string' ? args.children : 'LABEL'}
    />
  ),
};

export const ToneVariantMatrix: Story = {
  render: (args) => {
    const label = typeof args.children === 'string' ? args.children : 'LABEL';
    return (
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
                <td key={variant}>
                  <Badge
                    shape={args.shape as never}
                    tone={tone}
                    variant={variant}
                    size={args.size}
                    strokeWidth={args.strokeWidth}
                  >
                    {label}
                  </Badge>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
};

export const BaselineRow: Story = {
  name: 'Baseline justification',
  render: (args) => (
    <p style={{ fontSize: 14, lineHeight: 1.6 }}>
      Inline text with{' '}
      <Badge shape="pill" tone="accent" strokeWidth={args.strokeWidth}>pill</Badge>{' '}
      <Badge shape="square" tone="info" strokeWidth={args.strokeWidth}>square</Badge>{' '}
      <Badge shape="notched" tone="warn" strokeWidth={args.strokeWidth}>notched</Badge>{' '}
      <Badge shape="shield" tone="danger" strokeWidth={args.strokeWidth}>shield</Badge>{' '}
      <Badge shape="ribbon" tone="muted" shapeParams={{ left: 'outward', right: 'outward' } as never} strokeWidth={args.strokeWidth}>ribbon</Badge>{' '}
      <Badge shape="house" tone="accent" strokeWidth={args.strokeWidth}>house</Badge>{' '}
      and trailing copy.
    </p>
  ),
};

export const Sizes: Story = {
  render: (args) => {
    const label = typeof args.children === 'string' ? args.children : 'LABEL';
    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
        <Badge size="sm" shape={args.shape as never} tone={args.tone} variant={args.variant} strokeWidth={args.strokeWidth}>{label} sm</Badge>
        <Badge size="md" shape={args.shape as never} tone={args.tone} variant={args.variant} strokeWidth={args.strokeWidth}>{label} md</Badge>
      </div>
    );
  },
};

export const Removable: Story = { args: { onRemove: () => {} } };

export const Clickable: Story = { args: { onClick: () => {} } };

export const EdgeCases: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
      <Badge tone="info" strokeWidth={args.strokeWidth}>A very long label that tests overflow</Badge>
      <Badge shape="plain" tone="warn" strokeWidth={args.strokeWidth}>
        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'currentColor', marginRight: 4, verticalAlign: 'middle' }} />
        live
      </Badge>
      <Badge shape="starburst" tone="danger" variant="solid" strokeWidth={args.strokeWidth}>NEW</Badge>
      <Badge shape="ribbon" tone="accent" shapeParams={{ left: 'outward', right: 'outward' } as never} strokeWidth={args.strokeWidth}>RIBBON</Badge>
      <Badge shape="perforated" tone="muted" strokeWidth={args.strokeWidth}>STAMP</Badge>
      <Badge shape="house" tone="info" strokeWidth={args.strokeWidth}>HOME</Badge>
      <Badge shape="cloud" tone="warn" strokeWidth={args.strokeWidth}>CLOUDY</Badge>
    </div>
  ),
};

export const InlineWrapping: Story = {
  name: 'Edge case: inline wrap mid-badge',
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 360, lineHeight: 1.7 }}>
      <p style={{ margin: 0 }}>
        A normal paragraph that contains{' '}
        <Badge shape="pill" tone="accent" strokeWidth={args.strokeWidth}>
          a sufficiently long inline badge label
        </Badge>{' '}
        and continues afterward to force the badge to be broken across two visual lines.
      </p>
      <p style={{ margin: 0 }}>
        With <code>display: inline-flex</code>, badges don't fragment — they stay whole and either fit the line or push to a new one.
        Here's the same thing with a longer payload:{' '}
        <Badge shape="square" tone="info" strokeWidth={args.strokeWidth}>
          this badge has even more text inside that the line can't hold
        </Badge>{' '}
        trailing copy.
      </p>
      <p style={{ margin: 0 }}>
        Constrained-width container —{' '}
        <Badge shape="ribbon" tone="warn" strokeWidth={args.strokeWidth}>
          a ribbon badge that wraps because of width
        </Badge>{' '}
        and we keep going.
      </p>
    </div>
  ),
};

export const ComposeShowcase: Story = {
  name: 'Compose: base + effects',
  args: { children: 'COMPOSE', tone: 'danger', variant: 'solid' },
  render: (args) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 24, alignItems: 'baseline' }}>
      <Badge
        {...args}
        base="chamfered-rect"
        baseParams={{ chamfer: 8 }}
        effects={[{ type: 'spikes', params: { count: 48, length: 10, baseWidth: 3, vertScale: 1.4, diagonalScale: 0.55 } }]}
      >
        SPIKES
      </Badge>
      <Badge
        {...args}
        tone="accent"
        variant="outline"
        base="chamfered-rect"
        baseParams={{ chamfer: 12 }}
        effects={[{ type: 'spikes', params: { count: 60, length: 14, baseWidth: 2.5, vertScale: 1.8, irregularity: 0.3 } }]}
      >
        URCHIN
      </Badge>
      <Badge
        {...args}
        tone="info"
        variant="outline"
        base="rounded-rect"
        baseParams={{ erosion: 0.5 }}
        effects={[{ type: 'puffs', params: { bumpWidth: 16, puffiness: 10 } }]}
      >
        CLOUD
      </Badge>
      <Badge
        {...args}
        tone="warn"
        variant="solid"
        base="rounded-rect"
        baseParams={{ erosion: 0.75 }}
        effects={[{ type: 'puffs', params: { bumpWidth: 14, puffiness: 8, irregularity: 0.6 } }]}
      >
        BUMPY
      </Badge>
      <Badge
        {...args}
        tone="muted"
        variant="outline"
        base="rounded-rect"
        baseParams={{ erosion: 0.27 }}
        effects={[{ type: 'bites', params: { biteRadius: 3, biteSpacing: 8 } }]}
      >
        STAMP
      </Badge>
      <Badge
        {...args}
        tone="info"
        variant="solid"
        base="chamfered-rect"
        baseParams={{ chamfer: 6 }}
        effects={[
          { type: 'bites', params: { biteRadius: 2.5, biteSpacing: 7 } },
          { type: 'spikes', params: { count: 18, length: 6, baseWidth: 2, diagonalScale: 0.4 } },
        ]}
      >
        DUAL
      </Badge>
      <Badge
        {...args}
        tone="accent"
        variant="outline"
        base="rounded-rect"
        baseParams={{ erosion: 0.4 }}
        effects={[{ type: 'scallops', params: { scallopRadius: 5, scallopSpacing: 12 } }]}
      >
        SCALLOPS
      </Badge>
      <Badge
        {...args}
        tone="muted"
        variant="solid"
        base="rounded-rect"
        baseParams={{ erosion: 0.67 }}
        effects={[{ type: 'scallops', params: { scallopRadius: 3, scallopSpacing: 7, irregularity: 0.5 } }]}
      >
        WAVY
      </Badge>
      <Badge
        {...args}
        tone="warn"
        variant="solid"
        base="rounded-rect"
        baseParams={{ erosion: 0 }}
        effects={[
          { type: 'bevel', params: { bevelWidth: 6, lightFrom: 'tl' } },
          { type: 'sheen', params: { lightFrom: 'tl', intensity: 0.22 } },
          { type: 'rivets', params: { radius: 2.4, inset: 7, lightFrom: 'tl' } },
        ]}
      >
        PLAQUE
      </Badge>
      <Badge
        {...args}
        tone="info"
        variant="solid"
        base="rounded-rect"
        baseParams={{ erosion: 0.4 }}
        effects={[
          { type: 'scallops', params: { scallopRadius: 4, scallopSpacing: 9 } },
          { type: 'bevel', params: { bevelWidth: 4, lightFrom: 'br' } },
          { type: 'sheen', params: { lightFrom: 'br', intensity: 0.18 } },
        ]}
      >
        STACKED
      </Badge>
    </div>
  ),
};

export const SlotPillReplica: Story = {
  name: 'Slot pill (migration parity)',
  render: (args) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
      <Badge shape="pill" tone="accent" variant="outline" strokeWidth={args.strokeWidth}>active</Badge>
      <Badge shape="pill" tone="warn" variant="outline" strokeWidth={args.strokeWidth}>ambient</Badge>
      <Badge shape="pill" tone="info" variant="outline" strokeWidth={args.strokeWidth}>hotkey</Badge>
      <Badge shape="pill" tone="danger" variant="solid" strokeWidth={args.strokeWidth}>inactive</Badge>
    </div>
  ),
};

// --- Compose lab ----------------------------------------------------------

type LabControl =
  | { key: string; kind: 'range'; min: number; max: number; step: number; default: number }
  | { key: string; kind: 'select'; options: string[]; default: string };

const BASE_LAB_CONTROLS: Record<BadgeBase, LabControl[]> = {
  'rounded-rect':   [{ key: 'erosion', kind: 'range', min: 0, max: 1, step: 0.02, default: 0.16 }],
  'chamfered-rect': [{ key: 'chamfer', kind: 'range', min: 0, max: 25, step: 0.5, default: 6 }],
};

const EFFECT_LAB_CONTROLS: Record<BadgeEffect, LabControl[]> = {
  spikes: [
    { key: 'count',         kind: 'range',  min: 4,  max: 96, step: 1,    default: 44 },
    { key: 'length',        kind: 'range',  min: 1,  max: 30, step: 0.5,  default: 8 },
    { key: 'baseWidth',     kind: 'range',  min: 0.5, max: 12, step: 0.5, default: 3 },
    { key: 'vertScale',     kind: 'range',  min: 0,  max: 3,  step: 0.05, default: 1.4 },
    { key: 'horzScale',     kind: 'range',  min: 0,  max: 3,  step: 0.05, default: 1 },
    { key: 'diagonalScale', kind: 'range',  min: 0,  max: 3,  step: 0.05, default: 0.5 },
    { key: 'irregularity',  kind: 'range',  min: 0,  max: 1,  step: 0.05, default: 0 },
  ],
  puffs: [
    { key: 'bumpWidth',     kind: 'range', min: 4, max: 50, step: 1, default: 18 },
    { key: 'puffiness',     kind: 'range', min: 1, max: 30, step: 0.5, default: 10 },
    { key: 'irregularity',  kind: 'range', min: 0, max: 1,  step: 0.05, default: 0 },
  ],
  bites: [
    { key: 'biteRadius',    kind: 'range', min: 0.5, max: 8, step: 0.25, default: 3 },
    { key: 'biteSpacing',   kind: 'range', min: 2, max: 24,  step: 0.5,  default: 8 },
    { key: 'irregularity',  kind: 'range', min: 0, max: 1,   step: 0.05, default: 0 },
  ],
  scallops: [
    { key: 'scallopRadius', kind: 'range', min: 1, max: 12, step: 0.5, default: 5 },
    { key: 'scallopSpacing',kind: 'range', min: 4, max: 30, step: 1,   default: 12 },
    { key: 'irregularity',  kind: 'range', min: 0, max: 1,  step: 0.05, default: 0 },
  ],
  bevel: [
    { key: 'bevelWidth',    kind: 'range',  min: 0, max: 20, step: 0.5, default: 6 },
    { key: 'lightFrom',     kind: 'select', options: ['tl', 'tr', 'bl', 'br'], default: 'tl' },
  ],
  sheen: [
    { key: 'lightFrom',     kind: 'select', options: ['tl', 'tr', 'bl', 'br'], default: 'tl' },
    { key: 'intensity',     kind: 'range',  min: 0, max: 0.5, step: 0.02, default: 0.22 },
  ],
  rivets: [
    { key: 'radius',        kind: 'range',  min: 0, max: 6,  step: 0.2, default: 2.4 },
    { key: 'inset',         kind: 'range',  min: 3, max: 16, step: 0.5, default: 7 },
    { key: 'lightFrom',     kind: 'select', options: ['tl', 'tr', 'bl', 'br'], default: 'tl' },
  ],
  shadow: [
    { key: 'dx',            kind: 'range', min: -6, max: 6, step: 0.25, default: 1 },
    { key: 'dy',            kind: 'range', min: -6, max: 6, step: 0.25, default: 2 },
    { key: 'opacity',       kind: 'range', min: 0,  max: 1, step: 0.02, default: 0.28 },
  ],
  woodgrain: [
    { key: 'lines',         kind: 'range', min: 1, max: 10, step: 1, default: 4 },
    { key: 'knots',         kind: 'range', min: 0, max: 6,  step: 1, default: 2 },
    { key: 'intensity',     kind: 'range', min: 0, max: 1,  step: 0.05, default: 0.55 },
  ],
};

const BASE_KEYS = Object.keys(BASES) as BadgeBase[];
const EFFECT_KEYS = Object.keys(EFFECTS) as BadgeEffect[];

function defaultsFor(controls: LabControl[]): Record<string, number | string> {
  const obj: Record<string, number | string> = {};
  for (const c of controls) obj[c.key] = c.default;
  return obj;
}

interface LabEffect { id: number; type: BadgeEffect; params: Record<string, number | string> }

function ComposeLabView({ tone, variant, strokeWidth, label }: {
  tone: BadgeTone; variant: BadgeVariant; strokeWidth: number; label: string;
}) {
  const [base, setBase] = useState<BadgeBase>('rounded-rect');
  const [baseParams, setBaseParams] = useState<Record<string, number | string>>(() => defaultsFor(BASE_LAB_CONTROLS['rounded-rect']));
  const [labEffects, setLabEffects] = useState<LabEffect[]>([]);
  const [nextId, setNextId] = useState(1);
  const [exportText, setExportText] = useState<string | null>(null);

  const onPickBase = (b: BadgeBase) => {
    setBase(b);
    setBaseParams(defaultsFor(BASE_LAB_CONTROLS[b]));
  };
  const addEffect = (type: BadgeEffect) => {
    const params = defaultsFor(EFFECT_LAB_CONTROLS[type]);
    setLabEffects((prev) => [...prev, { id: nextId, type, params }]);
    setNextId((n) => n + 1);
  };
  const removeEffect = (id: number) => setLabEffects((prev) => prev.filter((e) => e.id !== id));
  const updateEffect = (id: number, key: string, value: number | string) =>
    setLabEffects((prev) => prev.map((e) => (e.id === id ? { ...e, params: { ...e.params, [key]: value } } : e)));
  const moveEffect = (id: number, dir: -1 | 1) => setLabEffects((prev) => {
    const idx = prev.findIndex((e) => e.id === id);
    if (idx < 0) return prev;
    const target = idx + dir;
    if (target < 0 || target >= prev.length) return prev;
    const next = [...prev];
    [next[idx], next[target]] = [next[target], next[idx]];
    return next;
  });

  const effectsForBadge: EffectSpec[] = labEffects.map((e) => ({ type: e.type, params: e.params as never }));

  const buildExportText = () => {
    const lines: string[] = [];
    lines.push('<Badge');
    lines.push(`  base="${base}"`);
    if (Object.keys(baseParams).length > 0) {
      const baseStr = Object.entries(baseParams).map(([k, v]) => `${k}: ${typeof v === 'string' ? JSON.stringify(v) : v}`).join(', ');
      lines.push(`  baseParams={{ ${baseStr} }}`);
    }
    if (labEffects.length > 0) {
      lines.push('  effects={[');
      for (const eff of labEffects) {
        const paramStr = Object.entries(eff.params).map(([k, v]) => `${k}: ${typeof v === 'string' ? JSON.stringify(v) : v}`).join(', ');
        lines.push(`    { type: ${JSON.stringify(eff.type)}, params: { ${paramStr} } },`);
      }
      lines.push('  ]}');
    }
    lines.push(`  tone="${tone}" variant="${variant}"`);
    lines.push(`>${label}</Badge>`);
    return lines.join('\n');
  };

  const handleExport = () => {
    const text = buildExportText();
    setExportText(text);
    if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  };

  const ctrlLabel: CSSProperties = { fontSize: 10, opacity: 0.7, fontFamily: 'monospace' };
  const sectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 6, background: 'rgba(255,255,255,0.03)' };

  const renderControl = (
    c: LabControl,
    value: number | string,
    onChange: (v: number | string) => void,
  ) => (
    <label key={c.key} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 48px', alignItems: 'center', gap: 8 }}>
      <span style={ctrlLabel}>{c.key}</span>
      {c.kind === 'range' ? (
        <>
          <input type="range" min={c.min} max={c.max} step={c.step}
            value={value as number} onChange={(e) => onChange(Number(e.target.value))}
            style={{ width: '100%' }} />
          <span style={ctrlLabel}>{value}</span>
        </>
      ) : (
        <>
          <select value={value as string} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', fontSize: 10 }}>
            {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <span />
        </>
      )}
    </label>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: 24, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', minHeight: 80, padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
          <Badge
            base={base}
            baseParams={baseParams as never}
            effects={effectsForBadge}
            tone={tone}
            variant={variant}
            strokeWidth={strokeWidth}
          >
            {label}
          </Badge>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleExport} style={{ fontSize: 11, padding: '6px 12px', cursor: 'pointer' }}>Copy snippet</button>
          <button onClick={() => { setLabEffects([]); setBase('rounded-rect'); setBaseParams(defaultsFor(BASE_LAB_CONTROLS['rounded-rect'])); setExportText(null); }} style={{ fontSize: 11, padding: '6px 12px', cursor: 'pointer' }}>Reset</button>
        </div>
        {exportText && (
          <textarea
            readOnly
            value={exportText}
            rows={Math.min(20, exportText.split('\n').length + 1)}
            style={{ fontFamily: 'monospace', fontSize: 11, padding: 8, width: '100%', boxSizing: 'border-box' }}
          />
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <section style={sectionStyle}>
          <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7, margin: '0 0 4px', fontFamily: 'monospace' }}>Base</h3>
          <label style={{ display: 'grid', gridTemplateColumns: '110px 1fr', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabel}>type</span>
            <select value={base} onChange={(e) => onPickBase(e.target.value as BadgeBase)} style={{ fontSize: 11 }}>
              {BASE_KEYS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          {(BASE_LAB_CONTROLS[base] ?? []).map((c) =>
            renderControl(c, baseParams[c.key], (v) => setBaseParams((p) => ({ ...p, [c.key]: v }))),
          )}
        </section>
        <section style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7, margin: 0, fontFamily: 'monospace' }}>Effects ({labEffects.length})</h3>
            <div style={{ display: 'flex', gap: 4 }}>
              <select
                onChange={(e) => { if (e.target.value) { addEffect(e.target.value as BadgeEffect); e.target.value = ''; } }}
                value=""
                style={{ fontSize: 10 }}
              >
                <option value="">+ add effect…</option>
                {EFFECT_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>
          {labEffects.length === 0 && (
            <p style={{ fontSize: 10, opacity: 0.5, fontFamily: 'monospace', margin: 0 }}>No effects. Add one from the dropdown.</p>
          )}
          {labEffects.map((eff, i) => (
            <div key={eff.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, borderRadius: 4, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <code style={{ fontSize: 11, opacity: 0.85, flex: 1 }}>{i + 1}. {eff.type}</code>
                <code style={{ fontSize: 9, opacity: 0.6 }}>{EFFECTS[eff.type].offsetAt ? 'offset' : (EFFECTS[eff.type].zone ?? 'foreground')}</code>
                <button onClick={() => moveEffect(eff.id, -1)} disabled={i === 0} style={{ fontSize: 10, padding: '0 6px', cursor: 'pointer' }}>↑</button>
                <button onClick={() => moveEffect(eff.id, +1)} disabled={i === labEffects.length - 1} style={{ fontSize: 10, padding: '0 6px', cursor: 'pointer' }}>↓</button>
                <button onClick={() => removeEffect(eff.id)} style={{ fontSize: 10, padding: '0 6px', cursor: 'pointer' }}>×</button>
              </div>
              {(EFFECT_LAB_CONTROLS[eff.type] ?? []).map((c) =>
                renderControl(c, eff.params[c.key], (v) => updateEffect(eff.id, c.key, v)),
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

export const ComposeLab: Story = {
  name: 'Compose lab',
  args: { children: 'COMPOSE', tone: 'accent', variant: 'solid', strokeWidth: 1 },
  argTypes: {
    shape: { table: { disable: true } },
    shapeParams: { table: { disable: true } },
    base: { table: { disable: true } },
    baseParams: { table: { disable: true } },
    effects: { table: { disable: true } },
  },
  render: (args) => (
    <ComposeLabView
      tone={(args.tone ?? 'accent') as BadgeTone}
      variant={(args.variant ?? 'solid') as BadgeVariant}
      strokeWidth={args.strokeWidth ?? 1}
      label={typeof args.children === 'string' ? args.children : 'COMPOSE'}
    />
  ),
};
