import { useState, type CSSProperties } from 'react';
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
    dot: { control: 'boolean', description: 'Render the small dot indicator before the label.' },
    shapeParams: {
      control: 'object',
      description: "Shape-specific params, e.g. { cornerRadius: 18 } for notched, { left: 'outward', right: 'inward' } for ribbon.",
    },
    onClick: { table: { disable: true } },
    onRemove: { table: { disable: true } },
    leadingIcon: { table: { disable: true } },
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
    { key: 'cornerRadius', kind: 'range', min: 0, max: 50, step: 1, default: 8 },
  ],
  hexagon: [
    { key: 'tipHeight', kind: 'range', min: 0, max: 49, step: 1, default: 25 },
    { key: 'tipTruncation', kind: 'range', min: 0, max: 49, step: 1, default: 0 },
  ],
  shield: [
    { key: 'pointDepth', kind: 'range', min: 60, max: 110, step: 1, default: 100 },
    { key: 'shoulderY', kind: 'range', min: 20, max: 80, step: 1, default: 55 },
    { key: 'curveTightness', kind: 'range', min: 0.1, max: 1, step: 0.05, default: 0.7 },
  ],
  scalloped: [
    { key: 'bumpsPerSide', kind: 'range', min: 2, max: 16, step: 1, default: 4 },
  ],
  notched: [
    { key: 'cornerRadius', kind: 'range', min: 0, max: 49, step: 1, default: 14 },
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
    { key: 'cornerGuard', kind: 'range', min: 0, max: 20, step: 1, default: 4 },
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
  bat: [
    { key: 'earHeight', kind: 'range', min: 8, max: 45, step: 1, default: 28 },
    { key: 'wingDip', kind: 'range', min: 15, max: 55, step: 1, default: 32 },
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
    shapes: ['house', 'cloud', 'beavis', 'bat', 'crest', 'urn', 'coffin', 'receipt', 'wood', 'leaves'],
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
  render: (args) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
      <Badge tone="info" strokeWidth={args.strokeWidth}>A very long label that tests overflow</Badge>
      <Badge shape="plain" tone="warn" dot strokeWidth={args.strokeWidth}>live</Badge>
      <Badge shape="starburst" tone="danger" variant="solid" strokeWidth={args.strokeWidth}>NEW</Badge>
      <Badge shape="ribbon" tone="accent" shapeParams={{ left: 'outward', right: 'outward' } as never} strokeWidth={args.strokeWidth}>RIBBON</Badge>
      <Badge shape="perforated" tone="muted" strokeWidth={args.strokeWidth}>STAMP</Badge>
      <Badge shape="house" tone="info" strokeWidth={args.strokeWidth}>HOME</Badge>
      <Badge shape="cloud" tone="warn" strokeWidth={args.strokeWidth}>CLOUDY</Badge>
      <Badge shape="pill" tone="info" strokeWidth={args.strokeWidth}>
        line one{'\n'}line two
      </Badge>
      <Badge shape="square" tone="accent" strokeWidth={args.strokeWidth}>
        first line<br />second line
      </Badge>
      <Badge shape="notched" tone="warn" strokeWidth={args.strokeWidth}>
        wrapped<br />content<br />three rows
      </Badge>
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
        baseParams={{ cornerRadius: 8 }}
        effects={[{ type: 'puffs', params: { bumpWidth: 16, puffiness: 10 } }]}
      >
        CLOUD
      </Badge>
      <Badge
        {...args}
        tone="warn"
        variant="solid"
        base="rounded-rect"
        baseParams={{ cornerRadius: 12 }}
        effects={[{ type: 'puffs', params: { bumpWidth: 14, puffiness: 8, irregularity: 0.6 } }]}
      >
        BUMPY
      </Badge>
      <Badge
        {...args}
        tone="muted"
        variant="outline"
        base="rounded-rect"
        baseParams={{ cornerRadius: 4 }}
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
