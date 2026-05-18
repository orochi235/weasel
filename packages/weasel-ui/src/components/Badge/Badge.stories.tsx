import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';
import { ToggleBar as KitToggleBar } from '../ToggleBar/ToggleBar';
import { ALL_SHAPES, SHAPES } from './shapes';
import type { BadgeShape, BadgeTone, BadgeVariant } from './types';
import { BASES, type BadgeBase } from './bases';
import { EFFECTS, type BadgeEffect, type EffectSpec } from './effects';

const TONES: BadgeTone[] = ['accent', 'info', 'warn', 'danger', 'muted', 'neutral'];
const VARIANTS: BadgeVariant[] = ['outline', 'solid', 'subtle'];

const meta: Meta<typeof Badge> = {
  title: 'weasel-ui/Foundations/Badge',
  component: Badge,
  args: {
    children: 'LABEL',
    shape: 'pill',
    tone: 'accent',
    variant: 'outline',
    size: 'sm',
  },
  argTypes: {
    children: { control: 'text', description: 'Badge label content' },
    shape: { control: 'select', options: ALL_SHAPES },
    tone: { control: 'select', options: TONES },
    variant: { control: 'inline-radio', options: VARIANTS },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    bloat: {
      control: { type: 'range', min: -10, max: 20, step: 0.25 },
      description: 'Edge bloat: offsets every base perimeter sample outward by N CSS px before compose effects. Negative shrinks. Compose mode only.',
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
  | { key: string; kind: 'select'; options: string[]; default: string }
  | { key: string; kind: 'color'; default: string }
  | { key: string; kind: 'text'; default: string }
  | { key: string; kind: 'header'; label: string };

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
    { key: 'spikeLen', kind: 'range', min: 0, max: 40, step: 1, default: 12 },
    { key: 'spikeBaseWidth', kind: 'range', min: 0.5, max: 12, step: 0.5, default: 3 },
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
  quatrefoil: [
    { key: '__spike__',       kind: 'header', label: 'Spike', default: '' } as never,
    { key: 'spikeR',          kind: 'range', min: 5,   max: 50,   step: 0.5,  default: 50 },
    { key: 'spikeCurvature',  kind: 'range', min: 0.3, max: 4,    step: 0.05, default: 1 },
    { key: 'spikeBend',       kind: 'range', min: -0.9, max: 0.9, step: 0.02, default: 0 },
    { key: 'spikeTipErosion', kind: 'range', min: 0,   max: 1,    step: 0.02, default: 0 },
    { key: '__valley__',      kind: 'header', label: 'Valley', default: '' } as never,
    { key: 'valleyR',         kind: 'range', min: 0,   max: 50,   step: 0.5,  default: 25 },
    { key: 'valleyAt',        kind: 'range', min: 0.05, max: 0.95, step: 0.01, default: 0.5 },
    { key: 'valleySmooth',    kind: 'range', min: 0,   max: 20,   step: 0.25, default: 3 },
    { key: '__lobe__',        kind: 'header', label: 'Lobe', default: '' } as never,
    { key: 'lobeR',           kind: 'range', min: 5,   max: 75,   step: 0.5,  default: 42 },
    { key: 'lobeCurvature',   kind: 'range', min: 0.3, max: 4,    step: 0.05, default: 1 },
    { key: 'lobeBend',        kind: 'range', min: -0.9, max: 0.9, step: 0.02, default: 0 },
    { key: 'lobeTipErosion',  kind: 'range', min: 0,   max: 1,    step: 0.02, default: 0 },
    { key: '__advanced__',    kind: 'header', label: 'Advanced', default: '' } as never,
    { key: 'rotation',        kind: 'range', min: -45, max: 45,   step: 0.5,  default: 0 },
    { key: 'samples',         kind: 'range', min: 48,  max: 360,  step: 4,    default: 192 },
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
  for (const c of controls) {
    if (c.kind === 'header') continue;
    init[c.key] = c.default;
  }
  return init;
}

function ShapeCard({ shape, tone, variant, label, params, onChange }: {
  shape: BadgeShape;
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
  const labelStyle: CSSProperties = { fontSize: 9, opacity: 0.7, fontFamily: 'Helvetica, Arial, sans-serif' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 6, background: 'rgba(255,255,255,0.02)', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', minHeight: 56 }}>
        <Badge shape={shape} tone={tone} variant={variant} shapeParams={params as never}>{label}</Badge>
      </div>
      <code style={{ fontSize: 10, opacity: 0.85, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {shape}
        {SHAPES[shape]?.compose === undefined && shape !== 'pill' && shape !== 'plain' && (
          <span title="Legacy: rendered via custom Component, not the compose pipeline" style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: 'rgba(212, 165, 116, 0.18)', color: '#d4a574', letterSpacing: '0.08em' }}>LEGACY</span>
        )}
      </code>
      {controls.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {controls.map((c) => {
            if (c.kind === 'header') {
              return (
                <div key={`__header__${c.key}`} style={{ fontSize: 9, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 4 }}>
                  {c.label}
                </div>
              );
            }
            return (
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
              ) : c.kind === 'select' ? (
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
              ) : c.kind === 'color' ? (
                <>
                  <input
                    type="color"
                    value={typeof params[c.key] === 'string' && /^#[0-9a-fA-F]{6}$/.test(params[c.key] as string) ? (params[c.key] as string) : c.default}
                    onChange={(e) => setParams((p) => ({ ...p, [c.key]: e.target.value }))}
                    style={{ width: '100%', height: 20, padding: 0, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, cursor: 'pointer' }}
                  />
                  <span />
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={params[c.key] as string}
                    onChange={(e) => setParams((p) => ({ ...p, [c.key]: e.target.value }))}
                    style={{ width: '100%', fontSize: 10, padding: '2px 4px' }}
                  />
                  <span />
                </>
              )}
            </label>
            );
          })}
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
    shapes: ['house', 'cloud', 'beavis', 'crest', 'urn', 'coffin', 'receipt', 'wood', 'quatrefoil'],
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
      if (c.kind === 'header') continue;
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

function AllShapesView({ tone, variant, label }: {
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
          style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 11, padding: 8, width: '100%', boxSizing: 'border-box' }}
        />
      )}
      {SHAPE_CATEGORIES.map((cat) => (
        <section key={cat.title}>
          <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7, margin: '0 0 12px', fontFamily: 'Helvetica, Arial, sans-serif' }}>{cat.title}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, alignItems: 'start' }}>
            {cat.shapes.map((shape) => (
              <ShapeCard
                key={shape}
                shape={shape}
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
  },
  argTypes: {
    shape: { table: { disable: true } },
    shapeParams: { table: { disable: true } },
  },
  render: (args) => (
    <AllShapesView
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
  render: (_args) => (
    <p style={{ fontSize: 14, lineHeight: 1.6 }}>
      Inline text with{' '}
      <Badge shape="pill" tone="accent" >pill</Badge>{' '}
      <Badge shape="square" tone="info" >square</Badge>{' '}
      <Badge shape="notched" tone="warn" >notched</Badge>{' '}
      <Badge shape="shield" tone="danger" >shield</Badge>{' '}
      <Badge shape="ribbon" tone="muted" shapeParams={{ left: 'outward', right: 'outward' } as never} >ribbon</Badge>{' '}
      <Badge shape="house" tone="accent" >house</Badge>{' '}
      and trailing copy.
    </p>
  ),
};

export const Sizes: Story = {
  render: (args) => {
    const label = typeof args.children === 'string' ? args.children : 'LABEL';
    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
        <Badge size="sm" shape={args.shape as never} tone={args.tone} variant={args.variant}>{label} sm</Badge>
        <Badge size="md" shape={args.shape as never} tone={args.tone} variant={args.variant}>{label} md</Badge>
      </div>
    );
  },
};

export const Removable: Story = { args: { onRemove: () => {} } };

export const Clickable: Story = { args: { onClick: () => {} } };

export const EdgeCases: Story = {
  render: (_args) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
      <Badge tone="info" >A very long label that tests overflow</Badge>
      <Badge shape="plain" tone="warn" >
        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'currentColor', marginRight: 4, verticalAlign: 'middle' }} />
        live
      </Badge>
      <Badge shape="starburst" tone="danger" variant="solid" >NEW</Badge>
      <Badge shape="ribbon" tone="accent" shapeParams={{ left: 'outward', right: 'outward' } as never} >RIBBON</Badge>
      <Badge shape="perforated" tone="muted" >STAMP</Badge>
      <Badge shape="house" tone="info" >HOME</Badge>
      <Badge shape="cloud" tone="warn" >CLOUDY</Badge>
    </div>
  ),
};

export const InlineWrapping: Story = {
  name: 'Edge case: inline wrap mid-badge',
  render: (_args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 360, lineHeight: 1.7 }}>
      <p style={{ margin: 0 }}>
        A normal paragraph that contains{' '}
        <Badge shape="pill" tone="accent" >
          a sufficiently long inline badge label
        </Badge>{' '}
        and continues afterward to force the badge to be broken across two visual lines.
      </p>
      <p style={{ margin: 0 }}>
        With <code>display: inline-flex</code>, badges don't fragment — they stay whole and either fit the line or push to a new one.
        Here's the same thing with a longer payload:{' '}
        <Badge shape="square" tone="info" >
          this badge has even more text inside that the line can't hold
        </Badge>{' '}
        trailing copy.
      </p>
      <p style={{ margin: 0 }}>
        Constrained-width container —{' '}
        <Badge shape="ribbon" tone="warn" >
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
  render: (_args) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
      <Badge shape="pill" tone="accent" variant="outline" >active</Badge>
      <Badge shape="pill" tone="warn" variant="outline" >ambient</Badge>
      <Badge shape="pill" tone="info" variant="outline" >hotkey</Badge>
      <Badge shape="pill" tone="danger" variant="solid" >inactive</Badge>
    </div>
  ),
};

// --- Compose lab ----------------------------------------------------------

type LabControl =
  | { key: string; kind: 'range'; min: number; max: number; step: number; default: number }
  | { key: string; kind: 'select'; options: string[]; default: string }
  | { key: string; kind: 'color'; default: string }
  | { key: string; kind: 'text'; default: string }
  | { key: string; kind: 'header'; label: string };

const BASE_LAB_CONTROLS: Record<BadgeBase, LabControl[]> = {
  'rounded-rect':   [
    { key: 'erosion', kind: 'range', min: 0, max: 1, step: 0.02, default: 0.16 },
    { key: 'eccentricity', kind: 'range', min: 0.3, max: 3, step: 0.05, default: 1 },
    { key: 'pinch', kind: 'range', min: 0, max: 1, step: 0.02, default: 0 },
  ],
  'chamfered-rect': [{ key: 'chamfer', kind: 'range', min: 0, max: 25, step: 0.5, default: 6 }],
  'polygon':        [],
  'puzzle':         [
    { key: 'top',        kind: 'select', options: ['flat', 'out', 'in'], default: 'out' },
    { key: 'right',      kind: 'select', options: ['flat', 'out', 'in'], default: 'in' },
    { key: 'bottom',     kind: 'select', options: ['flat', 'out', 'in'], default: 'out' },
    { key: 'left',       kind: 'select', options: ['flat', 'out', 'in'], default: 'in' },
    { key: 'tabSize',    kind: 'range', min: 4, max: 30, step: 0.5, default: 12 },
    { key: 'arcSamples', kind: 'range', min: 6, max: 40, step: 1,   default: 18 },
  ],
  'octant-spline':  [
    { key: 'mode',     kind: 'select', options: ['octant', 'quadrant'], default: 'octant' },
    { key: 'count',    kind: 'range', min: 3,   max: 12,  step: 1,    default: 5 },
    { key: '__advanced__', kind: 'header', label: 'Advanced', default: '' } as never,
    { key: 'rotation', kind: 'range', min: -45, max: 45,  step: 0.5, default: 0 },
    { key: 'samples',  kind: 'range', min: 48,  max: 360, step: 4,   default: 192 },
  ],
  'octant-bspline': [
    { key: 'mode',     kind: 'select', options: ['octant', 'quadrant'], default: 'octant' },
    { key: 'count',    kind: 'range', min: 3,   max: 12,  step: 1,    default: 5 },
    { key: '__advanced__', kind: 'header', label: 'Advanced', default: '' } as never,
    { key: 'rotation', kind: 'range', min: -45, max: 45,  step: 0.5, default: 0 },
    { key: 'samples',  kind: 'range', min: 48,  max: 360, step: 4,   default: 192 },
  ],
  'quatrefoil':     [
    { key: '__spike__',       kind: 'header', label: 'Spike', default: '' } as never,
    { key: 'spikeR',          kind: 'range', min: 5,   max: 50,   step: 0.5,  default: 50 },
    { key: 'spikeCurvature',  kind: 'range', min: 0.3, max: 4,    step: 0.05, default: 1 },
    { key: 'spikeBend',       kind: 'range', min: -0.9, max: 0.9, step: 0.02, default: 0 },
    { key: 'spikeTipErosion', kind: 'range', min: 0,   max: 1,    step: 0.02, default: 0 },
    { key: '__valley__',      kind: 'header', label: 'Valley', default: '' } as never,
    { key: 'valleyR',         kind: 'range', min: 0,   max: 50,   step: 0.5,  default: 25 },
    { key: 'valleyAt',        kind: 'range', min: 0.05, max: 0.95, step: 0.01, default: 0.5 },
    { key: 'valleySmooth',    kind: 'range', min: 0,   max: 20,   step: 0.25, default: 3 },
    { key: '__lobe__',        kind: 'header', label: 'Lobe', default: '' } as never,
    { key: 'lobeR',           kind: 'range', min: 5,   max: 75,   step: 0.5,  default: 42 },
    { key: 'lobeCurvature',   kind: 'range', min: 0.3, max: 4,    step: 0.05, default: 1 },
    { key: 'lobeBend',        kind: 'range', min: -0.9, max: 0.9, step: 0.02, default: 0 },
    { key: 'lobeTipErosion',  kind: 'range', min: 0,   max: 1,    step: 0.02, default: 0 },
    { key: '__advanced__',    kind: 'header', label: 'Advanced', default: '' } as never,
    { key: 'rotation',        kind: 'range', min: -45, max: 45,   step: 0.5,  default: 0 },
    { key: 'samples',         kind: 'range', min: 48,  max: 360,  step: 4,    default: 192 },
  ],
  'ribbon':         [
    { key: 'left',       kind: 'select', options: ['flat', 'inward', 'outward'], default: 'inward' },
    { key: 'right',      kind: 'select', options: ['flat', 'inward', 'outward'], default: 'outward' },
    { key: 'taperWidth', kind: 'range', min: 0, max: 24, step: 0.5, default: 8 },
  ],
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
  bevel2: [
    { key: 'bevelWidth',    kind: 'range',  min: 0, max: 20, step: 0.5, default: 6 },
    { key: 'lightFrom',     kind: 'range',  min: 0, max: 360, step: 1, default: 315 },
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
  perforations: [
    { key: 'holeRadius',    kind: 'range', min: 0.5, max: 8, step: 0.25, default: 3 },
    { key: 'holeSpacing',   kind: 'range', min: 2,   max: 30, step: 0.5, default: 11 },
  ],
  outline: [
    { key: 'width',         kind: 'range', min: 0,  max: 8, step: 0.25, default: 1 },
    { key: 'color',         kind: 'color', default: '#7fb069' },
    { key: 'opacity',       kind: 'range', min: 0,  max: 1, step: 0.02, default: 1 },
    { key: 'dash',          kind: 'text',  default: '' },
    { key: 'blendMode',     kind: 'select', options: ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'], default: 'normal' },
  ],
  sunbeams: [
    { key: 'count',         kind: 'range', min: 1,  max: 8,  step: 1,    default: 3 },
    { key: 'width',         kind: 'range', min: 2,  max: 60, step: 1,    default: 18 },
    { key: 'gap',           kind: 'range', min: 0,  max: 40, step: 1,    default: 8 },
    { key: 'angle',         kind: 'range', min: -60, max: 60, step: 1,   default: 28 },
    { key: 'opacity',       kind: 'range', min: 0,  max: 1,  step: 0.02, default: 0.18 },
    { key: 'offset',        kind: 'range', min: -60, max: 60, step: 1,   default: 0 },
    { key: 'irregularity',  kind: 'range', min: 0,  max: 1,  step: 0.02, default: 0 },
    { key: 'gradientAngle', kind: 'range', min: 0,  max: 360, step: 1,   default: 90 },
    { key: 'gradientStart', kind: 'range', min: 0,  max: 1,  step: 0.02, default: 0 },
    { key: 'gradientEnd',   kind: 'range', min: 0,  max: 1,  step: 0.02, default: 1 },
  ],
  aqua: [
    { key: '__body__',       kind: 'header', label: 'Body' } as never,
    { key: 'topAlpha',       kind: 'range', min: 0, max: 1, step: 0.02, default: 0.45 },
    { key: 'upperAlpha',     kind: 'range', min: 0, max: 1, step: 0.02, default: 0.7 },
    { key: 'equator',        kind: 'range', min: 15, max: 85, step: 1, default: 52 },
    { key: 'equatorSpread',  kind: 'range', min: 1, max: 40, step: 1, default: 12 },
    { key: 'equatorTint',    kind: 'range', min: 50, max: 100, step: 1, default: 95 },
    { key: 'baseTint',       kind: 'range', min: 20, max: 100, step: 1, default: 70 },
    { key: '__gloss__',      kind: 'header', label: 'Gloss' } as never,
    { key: 'glossTopAlpha',  kind: 'range', min: 0, max: 1, step: 0.02, default: 0.7 },
    { key: 'glossMidAlpha',  kind: 'range', min: 0, max: 1, step: 0.02, default: 0.18 },
    { key: 'glossExtent',    kind: 'range', min: 5, max: 90, step: 1, default: 50 },
    { key: '__bezel__',      kind: 'header', label: 'Bezel & rim' } as never,
    { key: 'bezelAlpha',     kind: 'range', min: 0, max: 1, step: 0.02, default: 0.7 },
    { key: 'bezelWidth',     kind: 'range', min: 0, max: 4, step: 0.25, default: 1 },
    { key: 'rimAlpha',       kind: 'range', min: 0, max: 1, step: 0.02, default: 0.22 },
    { key: 'rimWidth',       kind: 'range', min: 0, max: 4, step: 0.25, default: 1 },
  ],
  metal: [
    { key: 'specularity',    kind: 'range', min: 0, max: 1, step: 0.02, default: 0.6 },
    { key: '__body__',       kind: 'header', label: 'Body' } as never,
    { key: 'equator',        kind: 'range', min: 15, max: 85, step: 1, default: 50 },
    { key: 'equatorSpread',  kind: 'range', min: 1, max: 30, step: 1, default: 8 },
    { key: 'topDarkness',    kind: 'range', min: 0, max: 100, step: 1, default: 55 },
    { key: 'baseDarkness',   kind: 'range', min: 0, max: 100, step: 1, default: 35 },
    { key: '__gloss__',      kind: 'header', label: 'Gloss' } as never,
    { key: 'glossAlphaTop',  kind: 'range', min: 0, max: 1, step: 0.02, default: 0.55 },
    { key: 'glossExtent',    kind: 'range', min: 5, max: 90, step: 1, default: 50 },
    { key: '__bezel__',      kind: 'header', label: 'Bezel & rim' } as never,
    { key: 'bezelAlpha',     kind: 'range', min: 0, max: 1, step: 0.02, default: 0.85 },
    { key: 'bezelWidth',     kind: 'range', min: 0, max: 4, step: 0.25, default: 1 },
    { key: 'rimAlpha',       kind: 'range', min: 0, max: 1, step: 0.02, default: 0.35 },
    { key: 'rimWidth',       kind: 'range', min: 0, max: 4, step: 0.25, default: 1 },
  ],
};

const BASE_KEYS = Object.keys(BASES) as BadgeBase[];
const EFFECT_KEYS = Object.keys(EFFECTS) as BadgeEffect[];

function defaultsFor(controls: LabControl[]): Record<string, number | string> {
  const obj: Record<string, number | string> = {};
  for (const c of controls) {
    if (c.kind === 'header') continue;
    obj[c.key] = c.default;
  }
  return obj;
}

interface LabEffect { id: number; type: BadgeEffect; params: Record<string, number | string> }

interface LabPreset {
  name: string;
  base: BadgeBase;
  // Widened to allow array-valued params (e.g. polygon `vertices: [[x, y], …]`).
  baseParams: Record<string, number | string | number[][]>;
  effects: { type: BadgeEffect; params: Record<string, number | string> }[];
}

const LAB_PRESETS: LabPreset[] = [
  {
    name: 'pill',
    base: 'rounded-rect',
    baseParams: { erosion: 1 },
    effects: [],
  },
  {
    name: 'chamfer',
    base: 'chamfered-rect',
    baseParams: { chamfer: 8 },
    effects: [],
  },
  {
    name: 'spiky',
    base: 'rounded-rect',
    baseParams: { erosion: 0.35 },
    effects: [{ type: 'spikes', params: { count: 36, length: 10, baseWidth: 3, vertScale: 1, horzScale: 1, diagonalScale: 1, irregularity: 0, cornerCompensation: 1 } }],
  },
  {
    name: 'cloud',
    base: 'rounded-rect',
    baseParams: { erosion: 0.2 },
    effects: [{ type: 'puffs', params: { bumpWidth: 24, puffiness: 14, irregularity: 0 } }],
  },
  {
    name: 'bitten',
    base: 'rounded-rect',
    baseParams: { erosion: 0.5 },
    effects: [{ type: 'bites', params: { biteRadius: 3, biteSpacing: 8, irregularity: 0 } }],
  },
  {
    name: 'scalloped',
    base: 'rounded-rect',
    baseParams: { erosion: 0.16 },
    effects: [{ type: 'scallops', params: { scallopRadius: 4, scallopSpacing: 10, irregularity: 0 } }],
  },
  {
    name: 'sun',
    base: 'rounded-rect',
    baseParams: { erosion: 1 },
    effects: [{ type: 'spikes', params: { count: 16, length: 14, baseWidth: 5, vertScale: 1, horzScale: 1, diagonalScale: 1, irregularity: 0, cornerCompensation: 0 } }],
  },
  {
    name: 'rough',
    base: 'rounded-rect',
    baseParams: { erosion: 0.4 },
    effects: [
      { type: 'bites', params: { biteRadius: 2, biteSpacing: 6, irregularity: 0.6 } },
      { type: 'spikes', params: { count: 22, length: 4, baseWidth: 2, vertScale: 1, horzScale: 1, diagonalScale: 1, irregularity: 0.5, cornerCompensation: 1 } },
    ],
  },
  // The next eight presets mirror canonical compose configurations from the legacy shape kit
  // (see SHAPES[name].compose() for the equivalent shape spec).
  {
    name: 'plaque',
    base: 'chamfered-rect',
    baseParams: { chamfer: 6 },
    effects: [
      { type: 'bevel',  params: { bevelWidth: 6, lightFrom: 'tl' } },
      { type: 'rivets', params: { radius: 2.4, inset: 7, lightFrom: 'tl' } },
    ],
  },
  {
    name: 'postage',
    base: 'rounded-rect',
    baseParams: { erosion: 0.05 },
    effects: [
      { type: 'perforations', params: { holeRadius: 3, holeSpacing: 11 } },
    ],
  },
  {
    name: 'hexagon',
    base: 'polygon',
    baseParams: { vertices: [[50,0],[100,25],[100,75],[50,100],[0,75],[0,25]] },
    effects: [],
  },
  {
    name: 'house',
    base: 'polygon',
    baseParams: { vertices: [[50,0],[100,32],[100,100],[0,100],[0,32]] },
    effects: [],
  },
  {
    name: 'sunlit',
    base: 'rounded-rect',
    baseParams: { erosion: 0.5 },
    effects: [
      { type: 'sunbeams', params: { count: 3, width: 18, gap: 8, angle: 28, opacity: 0.25, gradientAngle: 90, gradientStart: 0.1, gradientEnd: 0.9 } },
    ],
  },
  {
    name: 'lemon',
    base: 'rounded-rect',
    baseParams: { erosion: 0.4, pinch: 0.6 },
    effects: [],
  },
  {
    name: 'arrow →',
    base: 'polygon',
    baseParams: { vertices: [[0, 0], [85, 0], [100, 50], [85, 100], [0, 100]] },
    effects: [],
  },
  {
    name: 'arrow ←',
    base: 'polygon',
    baseParams: { vertices: [[15, 0], [100, 0], [100, 100], [15, 100], [0, 50]] },
    effects: [],
  },
  {
    name: 'chevron banner',
    base: 'polygon',
    baseParams: { vertices: [[15, 0], [85, 0], [100, 50], [85, 100], [15, 100], [0, 50]] },
    effects: [],
  },
  {
    name: '> sign >',
    base: 'polygon',
    baseParams: { vertices: [[0, 0], [85, 0], [100, 50], [85, 100], [0, 100], [15, 50]] },
    effects: [],
  },
  {
    name: 'quatrefoil',
    base: 'quatrefoil',
    baseParams: { spikeR: 50, lobeR: 42, valleyR: 25, valleyAt: 0.5, spikeCurvature: 1, spikeBend: 0, spikeTipErosion: 0, lobeCurvature: 1, lobeBend: 0, lobeTipErosion: 0, valleySmooth: 3, rotation: 0, samples: 192 },
    effects: [],
  },
  {
    name: 'embossed',
    base: 'rounded-rect',
    baseParams: { erosion: 0.4 },
    effects: [
      { type: 'bevel2', params: { bevelWidth: 6, lightFrom: 315 } },
    ],
  },
];

const LAB_STORAGE_KEY = 'weasel-badge-compose-lab-v6';

interface LabSnapshot {
  base: BadgeBase;
  baseParams: Record<string, number | string>;
  labEffects: LabEffect[];
  nextId: number;
  tone: BadgeTone;
  customColor: string;
  variant: BadgeVariant;
  bloat: number;
  label: string;
  size: 'sm' | 'md';
  crawlOn: boolean;
  crawlSpeed: number;
  labelX: number;
  labelY: number;
  zoom: number;
  padTop: number;
  padRight: number;
  padBottom: number;
  padLeft: number;
  fontFamily: string;
  fontSizeDelta: number;
  bold: boolean;
  italic: boolean;
  caps: 'normal' | 'small-caps' | 'all-small-caps';
  linkPadX: boolean;
  linkPadY: boolean;
}

function loadLabSnapshot(): Partial<LabSnapshot> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LAB_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function ComposeLabView({ tone: toneArg, variant: variantArg, label: labelArg }: {
  tone: BadgeTone; variant: BadgeVariant; label: string;
}) {
  const saved = useRef<Partial<LabSnapshot>>(loadLabSnapshot()).current;
  const [base, setBase] = useState<BadgeBase>(saved.base ?? 'rounded-rect');
  const [baseParams, setBaseParams] = useState<Record<string, number | string>>(
    () => saved.baseParams ?? defaultsFor(BASE_LAB_CONTROLS[saved.base ?? 'rounded-rect']),
  );
  const [labEffects, setLabEffects] = useState<LabEffect[]>(saved.labEffects ?? []);
  const [nextId, setNextId] = useState(saved.nextId ?? 1);
  const [exportText, setExportText] = useState<string | null>(null);
  const [tone, setTone] = useState<BadgeTone>(saved.tone ?? toneArg);
  const [customColor, setCustomColor] = useState<string>(saved.customColor ?? '#7fb069');
  const [variant, setVariant] = useState<BadgeVariant>(saved.variant ?? variantArg);
  const [bloat, setBloat] = useState<number>(saved.bloat ?? 0);
  const [label, setLabel] = useState<string>(saved.label ?? labelArg);
  const [size, setSize] = useState<'sm' | 'md'>(saved.size ?? 'sm');
  const [crawlOn, setCrawlOn] = useState<boolean>(saved.crawlOn ?? false);
  const [crawlSpeed, setCrawlSpeed] = useState<number>(saved.crawlSpeed ?? 0.2);
  const [labelX, setLabelX] = useState<number>(saved.labelX ?? 0);
  const [labelY, setLabelY] = useState<number>(saved.labelY ?? 0);
  const [zoom, setZoom] = useState<number>(saved.zoom ?? 2);
  const [padTop, setPadTop] = useState<number>(saved.padTop ?? 1);
  const [padRight, setPadRight] = useState<number>(saved.padRight ?? 6);
  const [padBottom, setPadBottom] = useState<number>(saved.padBottom ?? 1);
  const [padLeft, setPadLeft] = useState<number>(saved.padLeft ?? 6);
  const [fontFamily, setFontFamily] = useState<string>(saved.fontFamily ?? 'inherit');
  const [fontSizeDelta, setFontSizeDelta] = useState<number>(saved.fontSizeDelta ?? 0);
  const [bold, setBold] = useState<boolean>(saved.bold ?? false);
  const [italic, setItalic] = useState<boolean>(saved.italic ?? false);
  const [caps, setCaps] = useState<'normal' | 'small-caps' | 'all-small-caps'>(saved.caps ?? 'normal');
  const [linkPadX, setLinkPadX] = useState<boolean>(saved.linkPadX ?? true);
  const [linkPadY, setLinkPadY] = useState<boolean>(saved.linkPadY ?? true);
  const onPadTop = (v: number) => { setPadTop(v); if (linkPadY) setPadBottom(v); };
  const onPadBottom = (v: number) => { setPadBottom(v); if (linkPadY) setPadTop(v); };
  const onPadLeft = (v: number) => { setPadLeft(v); if (linkPadX) setPadRight(v); };
  const onPadRight = (v: number) => { setPadRight(v); if (linkPadX) setPadLeft(v); };
  const toggleLinkPadX = (on: boolean) => { setLinkPadX(on); if (on) setPadRight(padLeft); };
  const toggleLinkPadY = (on: boolean) => { setLinkPadY(on); if (on) setPadBottom(padTop); };
  const currentSnapshot = (): LabSnapshot => ({
    base, baseParams, labEffects, nextId, tone, customColor, variant, bloat,
    label, size, crawlOn, crawlSpeed, labelX, labelY, zoom,
    padTop, padRight, padBottom, padLeft,
    fontFamily, fontSizeDelta, bold, italic, caps,
    linkPadX, linkPadY,
  });

  // --- Persist on every state change. Cheap: <2KB JSON, throttled implicitly by React batching.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const snap = currentSnapshot();
    try { window.localStorage.setItem(LAB_STORAGE_KEY, JSON.stringify(snap)); } catch { /* quota / private mode */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, baseParams, labEffects, nextId, tone, customColor, variant, bloat, label, size, crawlOn, crawlSpeed, labelX, labelY, zoom, padTop, padRight, padBottom, padLeft, fontFamily, fontSizeDelta, bold, italic, caps, linkPadX, linkPadY]);

  // --- Undo / redo --------------------------------------------------------
  // Snapshots of the full lab state. The stacks live in refs (not state) so
  // applying a popped snapshot doesn't immediately push a new entry, and so
  // rapid changes (slider scrubs, anchor drags) can be coalesced into one
  // entry via a debounce timer.
  const undoStackRef = useRef<LabSnapshot[]>([currentSnapshot()]);
  const redoStackRef = useRef<LabSnapshot[]>([]);
  const isRestoringRef = useRef(false);
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Schedule a coalesced snapshot 300ms after the last state change. Any
  // additional change within the window resets the timer, so a drag through
  // 100 mousemoves still collapses into a single undo step. Programmatic
  // changes triggered by undo/redo flip `isRestoringRef` so they don't
  // self-record.
  useEffect(() => {
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      return;
    }
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = setTimeout(() => {
      const snap = currentSnapshot();
      const top = undoStackRef.current[undoStackRef.current.length - 1];
      if (top && JSON.stringify(top) === JSON.stringify(snap)) return;
      undoStackRef.current.push(snap);
      if (undoStackRef.current.length > 200) undoStackRef.current.shift();
      redoStackRef.current = [];
    }, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, baseParams, labEffects, nextId, tone, customColor, variant, bloat, label, size, crawlOn, crawlSpeed, labelX, labelY, zoom, padTop, padRight, padBottom, padLeft, fontFamily, fontSizeDelta, bold, italic, caps, linkPadX, linkPadY]);

  const applySnapshot = (s: LabSnapshot) => {
    isRestoringRef.current = true;
    setBase(s.base);
    setBaseParams(s.baseParams);
    setLabEffects(s.labEffects);
    setNextId(s.nextId);
    setTone(s.tone);
    setCustomColor(s.customColor);
    setVariant(s.variant);
    setBloat(s.bloat);
    setLabel(s.label);
    setSize(s.size);
    setCrawlOn(s.crawlOn);
    setCrawlSpeed(s.crawlSpeed);
    setLabelX(s.labelX);
    setLabelY(s.labelY);
    setZoom(s.zoom);
    setPadTop(s.padTop);
    setPadRight(s.padRight);
    setPadBottom(s.padBottom);
    setPadLeft(s.padLeft);
    setFontFamily(s.fontFamily);
    setFontSizeDelta(s.fontSizeDelta);
    setBold(s.bold);
    setItalic(s.italic);
    setCaps(s.caps);
    setLinkPadX(s.linkPadX);
    setLinkPadY(s.linkPadY);
  };

  const flushPendingSnapshot = () => {
    if (!snapshotTimerRef.current) return;
    clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = null;
    const snap = currentSnapshot();
    const top = undoStackRef.current[undoStackRef.current.length - 1];
    if (!top || JSON.stringify(top) !== JSON.stringify(snap)) {
      undoStackRef.current.push(snap);
      redoStackRef.current = [];
    }
  };

  const onUndo = () => {
    flushPendingSnapshot();
    if (undoStackRef.current.length < 2) return;
    const popped = undoStackRef.current.pop()!;
    redoStackRef.current.push(popped);
    const prev = undoStackRef.current[undoStackRef.current.length - 1];
    applySnapshot(prev);
  };

  const onRedo = () => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(next);
    applySnapshot(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      // Cmd/Ctrl+Z = undo; Cmd/Ctrl+Shift+Z (or Cmd/Ctrl+Y) = redo.
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); onUndo(); }
      else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); onRedo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const previewInnerRef = useRef<HTMLDivElement>(null);
  const [previewNatural, setPreviewNatural] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = previewInnerRef.current;
    if (!el) return;
    const measure = () => {
      // We want the natural size, but the element is scaled. Read offsetWidth/Height
      // (layout box, ignores transforms).
      setPreviewNatural({ w: el.offsetWidth, h: el.offsetHeight });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [base, baseParams, labEffects, variant, tone, bloat, label]);

  const loadPreset = (preset: LabPreset) => {
    setBase(preset.base);
    // baseParams in state is typed `Record<string, number | string>`; presets allow array-
    // valued vertices for the polygon base. Cast at the boundary — runtime is fine because
    // BASES[base].build() narrows per-base.
    setBaseParams({ ...defaultsFor(BASE_LAB_CONTROLS[preset.base]), ...preset.baseParams } as Record<string, number | string>);
    let id = nextId;
    const next: LabEffect[] = [];
    for (const e of preset.effects) {
      next.push({
        id,
        type: e.type,
        params: { ...defaultsFor(EFFECT_LAB_CONTROLS[e.type]), ...e.params },
      });
      id += 1;
    }
    setLabEffects(next);
    setNextId(id);
    setExportText(null);
  };

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
  const changeEffectType = (id: number, type: BadgeEffect) =>
    setLabEffects((prev) =>
      prev.map((e) => (e.id === id ? { ...e, type, params: defaultsFor(EFFECT_LAB_CONTROLS[type]) } : e)),
    );
  const reorderEffectTo = (id: number, targetIndex: number) => setLabEffects((prev) => {
    const idx = prev.findIndex((e) => e.id === id);
    if (idx < 0 || idx === targetIndex) return prev;
    const next = [...prev];
    const [moved] = next.splice(idx, 1);
    const clamped = Math.max(0, Math.min(targetIndex, next.length));
    next.splice(clamped, 0, moved);
    return next;
  });
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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
    lines.push(`  tone="${tone}" variant="${variant}" size="${size}"`);
    if (bloat !== 0) lines.push(`  bloat={${bloat}}`);
    if (crawlOn) lines.push(`  crawl={${crawlSpeed}}`);
    lines.push(`>${label}</Badge>`);
    return lines.join('\n');
  };

  const handleExport = () => {
    const text = buildExportText();
    setExportText(text);
    if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  };

  const ctrlLabel: CSSProperties = { fontSize: 10, opacity: 0.7, fontFamily: 'Helvetica, Arial, sans-serif' };
  const LinkIcon = () => (
    <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true" focusable="false" style={{ verticalAlign: 'middle', opacity: 0.85 }}>
      <path d="M6.5 4h-1.5a3 3 0 1 0 0 6h1.5M9.5 4h1.5a3 3 0 0 1 0 6h-1.5M5.5 7h5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const toggleBar = <T extends string>(
    value: T,
    options: readonly T[],
    onChange: (v: T) => void,
    labels?: readonly string[],
  ): ReactElement => (
    <KitToggleBar<T>
      items={options.map((opt, i) => ({ value: opt, label: labels?.[i] ?? opt }))}
      value={value}
      onChange={(v) => { if (v != null) onChange(v); }}
      size="sm"
    />
  );
  const sectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, padding: 12, borderRadius: 6, background: 'rgba(127, 176, 105, 0.06)', border: '1px solid rgba(255,255,255,0.06)' };
  const effectsSectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, padding: 12, borderRadius: 6, background: 'rgba(127, 176, 105, 0.18)', border: '1px solid rgba(127, 176, 105, 0.45)', boxShadow: '0 0 0 1px rgba(127, 176, 105, 0.15) inset, 0 6px 18px -8px rgba(127, 176, 105, 0.5)' };
  const effectCardStyle: CSSProperties = { background: 'rgba(0, 0, 0, 0.18)', border: '1px solid rgba(255,255,255,0.08)' };

  const renderControl = (
    c: LabControl,
    value: number | string,
    onChange: (v: number | string) => void,
  ) => {
    if (c.kind === 'header') {
      return (
        <div key={`__header__${c.key}`} style={{ fontSize: 10, opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6 }}>
          {c.label}
        </div>
      );
    }
    return (
      <label key={c.key} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 48px', alignItems: 'center', gap: 8 }}>
        <span style={ctrlLabel}>{c.key}</span>
        {c.kind === 'range' ? (
          <>
            <input type="range" min={c.min} max={c.max} step={c.step}
              value={value as number} onChange={(e) => onChange(Number(e.target.value))}
              style={{ width: '100%' }} />
            <span style={ctrlLabel}>{value}</span>
          </>
        ) : c.kind === 'select' ? (
          <>
            {toggleBar<string>(value as string, c.options, (v) => onChange(v))}
            <span />
          </>
        ) : c.kind === 'color' ? (
          <>
            <input
              type="color"
              value={typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : c.default}
              onChange={(e) => onChange(e.target.value)}
              style={{ width: '100%', height: 22, padding: 0, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
            />
            <span style={ctrlLabel}>{value}</span>
          </>
        ) : (
          <>
            <input
              type="text"
              value={value as string}
              onChange={(e) => onChange(e.target.value)}
              style={{ width: '100%', fontSize: 10, padding: '2px 4px' }}
            />
            <span />
          </>
        )}
      </label>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(420px, 1fr) minmax(300px, 400px)', gap: 24, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{
            width: previewNatural.w > 0 ? previewNatural.w * zoom : undefined,
            height: previewNatural.h > 0 ? previewNatural.h * zoom : undefined,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: Math.max(40, 40 * zoom),
          }}>
            <div ref={previewInnerRef} style={{ transform: `scale(${zoom})`, transformOrigin: 'center', display: 'inline-block' }}>
              <Badge
                base={base}
                baseParams={baseParams as never}
                effects={effectsForBadge}
                tone={tone}
                variant={variant}
                bloat={bloat}
                size={size}
                padding={`${padTop}px ${padRight}px ${padBottom}px ${padLeft}px`}
                crawl={crawlOn ? crawlSpeed : undefined}
                style={tone === 'custom' ? ({ ['--badge-edge' as never]: customColor }) : undefined}
              >
                <span style={{
                  display: 'inline-block',
                  transform: `translate(${labelX}px, ${labelY}px)`,
                  fontFamily: fontFamily === 'inherit' ? undefined : fontFamily,
                  fontSize: fontSizeDelta !== 0 ? `calc(1em + ${fontSizeDelta}px)` : undefined,
                  fontWeight: bold ? 700 : undefined,
                  fontStyle: italic ? 'italic' : undefined,
                  fontVariantCaps: caps !== 'normal' ? caps : undefined,
                }}>{label}</span>
              </Badge>
            </div>
          </div>
        </div>
        <label style={{ display: 'grid', gridTemplateColumns: '50px 1fr 36px', alignItems: 'center', gap: 8 }}>
          <span style={ctrlLabel}>zoom</span>
          <input type="range" min={1} max={6} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: '100%' }} />
          <span style={ctrlLabel}>{zoom.toFixed(1)}×</span>
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleExport} style={{ fontSize: 11, padding: '6px 12px', cursor: 'pointer' }}>Copy snippet</button>
          <button onClick={() => { setLabEffects([]); setBase('rounded-rect'); setBaseParams(defaultsFor(BASE_LAB_CONTROLS['rounded-rect'])); setExportText(null); }} style={{ fontSize: 11, padding: '6px 12px', cursor: 'pointer' }}>Reset</button>
        </div>
        {exportText && (
          <textarea
            readOnly
            value={exportText}
            rows={Math.min(20, exportText.split('\n').length + 1)}
            style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 11, padding: 8, width: '100%', boxSizing: 'border-box' }}
          />
        )}
        <section style={sectionStyle}>
          <label style={{ display: 'grid', gridTemplateColumns: '110px 1fr', alignItems: 'center', gap: 8 }}>
            <span style={{ ...ctrlLabel, fontSize: 16 }}>base</span>
            <select
              value={base}
              onChange={(e) => onPickBase(e.target.value as BadgeBase)}
              style={{ fontSize: 27, padding: '4px 6px' }}
            >
              {BASE_KEYS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
        </section>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignItems: 'start' }}>
        <section style={sectionStyle}>
          <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7, margin: '0 0 4px', fontFamily: 'Helvetica, Arial, sans-serif' }}>Appearance</h3>
          <label style={{ display: 'grid', gridTemplateColumns: '110px 1fr', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabel}>variant</span>
            {toggleBar<BadgeVariant>(variant, ['outline', 'solid', 'subtle'] as const, setVariant)}
          </label>
          <label style={{ display: 'grid', gridTemplateColumns: '110px 1fr 24px', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabel}>tone</span>
            {toggleBar<BadgeTone>(tone, ['accent', 'info', 'warn', 'danger', 'muted', 'neutral', 'custom'] as const, setTone)}
            <input
              type="color"
              value={customColor}
              onChange={(e) => { setCustomColor(e.target.value); setTone('custom'); }}
              title="Pick a custom tone color"
              style={{ width: 22, height: 22, padding: 0, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
            />
          </label>
          <label style={{ display: 'grid', gridTemplateColumns: '110px 1fr 48px', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabel}>bloat</span>
            <input type="range" min={-10} max={20} step={0.25} value={bloat} onChange={(e) => setBloat(Number(e.target.value))} style={{ width: '100%' }} />
            <span style={ctrlLabel}>{bloat}</span>
          </label>
          <label style={{ display: 'grid', gridTemplateColumns: '110px 1fr', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabel}>size</span>
            {toggleBar<'sm' | 'md'>(size, ['sm', 'md'] as const, setSize)}
          </label>
          <label style={{ display: 'grid', gridTemplateColumns: '110px 1fr', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabel}>label</span>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} style={{ fontSize: 11, padding: '2px 4px' }} />
          </label>
          <label style={{ display: 'grid', gridTemplateColumns: '110px auto 1fr 48px', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabel}>crawl</span>
            <input type="checkbox" checked={crawlOn} onChange={(e) => setCrawlOn(e.target.checked)} />
            <input type="range" min={-2} max={2} step={0.05} value={crawlSpeed} onChange={(e) => setCrawlSpeed(Number(e.target.value))} disabled={!crawlOn} style={{ width: '100%' }} />
            <span style={ctrlLabel}>{crawlSpeed.toFixed(2)}</span>
          </label>
          <label style={{ display: 'grid', gridTemplateColumns: '110px 1fr 48px', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabel}>label X</span>
            <input type="range" min={-30} max={30} step={0.5} value={labelX} onChange={(e) => setLabelX(Number(e.target.value))} style={{ width: '100%' }} />
            <span style={ctrlLabel}>{labelX}</span>
          </label>
          <label style={{ display: 'grid', gridTemplateColumns: '110px 1fr 48px', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabel}>label Y</span>
            <input type="range" min={-30} max={30} step={0.5} value={labelY} onChange={(e) => setLabelY(Number(e.target.value))} style={{ width: '100%' }} />
            <span style={ctrlLabel}>{labelY}</span>
          </label>
        </section>
        <section style={sectionStyle}>
          <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7, margin: '0 0 4px', fontFamily: 'Helvetica, Arial, sans-serif' }}>Type & padding</h3>
          <label style={{ display: 'grid', gridTemplateColumns: '60px 1fr', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabel}>font</span>
            {toggleBar<string>(
              fontFamily,
              ['inherit', 'system-ui, sans-serif', 'Helvetica, Arial, sans-serif', "Georgia, 'Times New Roman', serif", 'ui-monospace, SFMono-Regular, Menlo, monospace', "'Helvetica Neue Condensed', 'Arial Narrow', sans-serif"] as const,
              setFontFamily,
              ['inherit', 'system', 'sans', 'serif', 'mono', 'cond'],
            )}
          </label>
          <label style={{ display: 'grid', gridTemplateColumns: '60px 1fr 36px', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabel}>size Δ</span>
            <input type="range" min={-6} max={24} step={0.5} value={fontSizeDelta} onChange={(e) => setFontSizeDelta(Number(e.target.value))} style={{ width: '100%' }} />
            <span style={ctrlLabel}>{fontSizeDelta > 0 ? `+${fontSizeDelta}` : fontSizeDelta}</span>
          </label>
          <label style={{ display: 'grid', gridTemplateColumns: '60px auto auto 1fr', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabel}>style</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...ctrlLabel }}>
              <input type="checkbox" checked={bold} onChange={(e) => setBold(e.target.checked)} /> B
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...ctrlLabel, fontStyle: 'italic' }}>
              <input type="checkbox" checked={italic} onChange={(e) => setItalic(e.target.checked)} /> I
            </label>
            <span />
          </label>
          <label style={{ display: 'grid', gridTemplateColumns: '60px 1fr', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabel}>caps</span>
            {toggleBar<'normal' | 'small-caps' | 'all-small-caps'>(caps, ['normal', 'small-caps', 'all-small-caps'] as const, setCaps)}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 2 }}>
            <h4 style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6, margin: 0, fontFamily: 'Helvetica, Arial, sans-serif' }}>Padding</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 3, ...ctrlLabel }} title="Lock left/right padding">
                <input type="checkbox" checked={linkPadX} onChange={(e) => toggleLinkPadX(e.target.checked)} />
                <LinkIcon /> X
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 3, ...ctrlLabel }} title="Lock top/bottom padding">
                <input type="checkbox" checked={linkPadY} onChange={(e) => toggleLinkPadY(e.target.checked)} />
                <LinkIcon /> Y
              </label>
            </div>
          </div>
          <label style={{ display: 'grid', gridTemplateColumns: '60px 1fr 36px', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabel}>top</span>
            <input type="range" min={0} max={40} step={0.5} value={padTop} onChange={(e) => onPadTop(Number(e.target.value))} style={{ width: '100%' }} />
            <span style={ctrlLabel}>{padTop}</span>
          </label>
          <label style={{ display: 'grid', gridTemplateColumns: '60px 1fr 36px', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabel}>right</span>
            <input type="range" min={0} max={40} step={0.5} value={padRight} onChange={(e) => onPadRight(Number(e.target.value))} style={{ width: '100%' }} />
            <span style={ctrlLabel}>{padRight}</span>
          </label>
          <label style={{ display: 'grid', gridTemplateColumns: '60px 1fr 36px', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabel}>bottom</span>
            <input type="range" min={0} max={40} step={0.5} value={padBottom} onChange={(e) => onPadBottom(Number(e.target.value))} style={{ width: '100%' }} />
            <span style={ctrlLabel}>{padBottom}</span>
          </label>
          <label style={{ display: 'grid', gridTemplateColumns: '60px 1fr 36px', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabel}>left</span>
            <input type="range" min={0} max={40} step={0.5} value={padLeft} onChange={(e) => onPadLeft(Number(e.target.value))} style={{ width: '100%' }} />
            <span style={ctrlLabel}>{padLeft}</span>
          </label>
        </section>
        <section style={sectionStyle}>
          {(base === 'octant-spline' || base === 'octant-bspline') ? (
            (() => {
              const count = Math.max(3, Math.min(12, Math.floor(Number(baseParams.count ?? 5))));
              const sDefaults = [0, 0.25, 0.5, 0.75, 1, 1, 1, 1, 1, 1, 1, 1];
              const rDefaults = [48, 30, 32, 38, 46, 42, 36, 32, 30, 30, 30, 30];
              const liveAnchors: SplineAnchor[] = Array.from({ length: count }, (_, i) => {
                const sRaw = Number(baseParams[`s${i}`] ?? (i === 0 ? 0 : i === count - 1 ? 1 : sDefaults[i]));
                const s = i === 0 ? 0 : i === count - 1 ? 1 : Math.max(0, Math.min(1, sRaw));
                return {
                  s,
                  r: Math.max(0, Number(baseParams[`r${i}`] ?? rDefaults[i] ?? 30)),
                  w: Math.max(0, Math.min(3, Number(baseParams[`w${i}`] ?? 1))),
                };
              });
              const handleCountChange = (newCount: number) => {
                const n = Math.max(3, Math.min(12, Math.floor(newCount)));
                setBaseParams((p) => {
                  const next: Record<string, number | string> = { ...p, count: n };
                  // Redistribute active anchor s positions evenly.
                  for (let i = 0; i < n; i++) {
                    next[`s${i}`] = i / (n - 1);
                  }
                  return next;
                });
              };
              const mode: 'octant' | 'quadrant' = (baseParams.mode === 'quadrant' ? 'quadrant' : 'octant');
              // In quadrant mode the two endpoints are physically the same point under
              // 4-fold rotation, so editing one of them must mirror to the other to keep
              // the curve continuous.
              const onAnchorChange = (idx: number, next: SplineAnchor) => {
                setBaseParams((p) => {
                  const update: Record<string, number | string> = {
                    ...p,
                    [`s${idx}`]: next.s,
                    [`r${idx}`]: next.r,
                    [`w${idx}`]: next.w,
                  };
                  if (mode === 'quadrant') {
                    if (idx === 0) {
                      update[`r${count - 1}`] = next.r;
                      update[`w${count - 1}`] = next.w;
                    } else if (idx === count - 1) {
                      update.r0 = next.r;
                      update.w0 = next.w;
                    }
                  }
                  return update;
                });
              };
              const onAnchorDelete = (idx: number) => {
                if (count <= 3) return;
                if (idx === 0 || idx === count - 1) return;
                setBaseParams((p) => {
                  const update: Record<string, number | string> = { ...p };
                  for (let i = idx; i < count - 1; i++) {
                    update[`s${i}`] = Number(p[`s${i + 1}`] ?? sDefaults[i + 1] ?? 0);
                    update[`r${i}`] = Number(p[`r${i + 1}`] ?? rDefaults[i + 1] ?? 30);
                    update[`w${i}`] = Number(p[`w${i + 1}`] ?? 1);
                  }
                  update.count = count - 1;
                  return update;
                });
              };
              const onAnchorAdd = (sNew: number, rNew: number) => {
                if (count >= 12) return;
                // Find insertion index among interior anchors (idx 1..count-2). Endpoints stay.
                let insertIdx = 1;
                while (insertIdx < count && liveAnchors[insertIdx].s < sNew) insertIdx++;
                if (insertIdx >= count) insertIdx = count - 1;
                // Don't allow inserting too close to existing neighbors.
                const eps = 0.01;
                const prev = liveAnchors[insertIdx - 1].s;
                const next = liveAnchors[insertIdx].s;
                const sClamped = Math.max(prev + eps, Math.min(next - eps, sNew));
                if (next - prev < 2 * eps) return; // no room
                setBaseParams((p) => {
                  const update: Record<string, number | string> = { ...p };
                  // Shift slots [insertIdx..count-1] up by one.
                  for (let i = count; i > insertIdx; i--) {
                    update[`s${i}`] = Number(p[`s${i - 1}`] ?? sDefaults[i - 1] ?? 1);
                    update[`r${i}`] = Number(p[`r${i - 1}`] ?? rDefaults[i - 1] ?? 30);
                    update[`w${i}`] = Number(p[`w${i - 1}`] ?? 1);
                  }
                  update[`s${insertIdx}`] = Math.round(sClamped * 1000) / 1000;
                  update[`r${insertIdx}`] = rNew;
                  update[`w${insertIdx}`] = 1;
                  update.count = count + 1;
                  return update;
                });
              };
              return (
                <>
                  <label style={{ display: 'grid', gridTemplateColumns: '110px 1fr', alignItems: 'center', gap: 8 }}>
                    <span style={ctrlLabel}>mode</span>
                    {toggleBar<'octant' | 'quadrant'>(mode, ['octant', 'quadrant'] as const, (v) => setBaseParams((p) => ({ ...p, mode: v })))}
                  </label>
                  <OctantSplineEditor
                    anchors={liveAnchors}
                    mode={mode}
                    onAnchorChange={onAnchorChange}
                    onAnchorDelete={onAnchorDelete}
                    onAnchorAdd={onAnchorAdd}
                    evalAtS={base === 'octant-bspline' ? bsplineSplineEval(liveAnchors) : naturalSplineEval(liveAnchors)}
                  />
                  {(BASE_LAB_CONTROLS[base] ?? [])
                    .filter((c) => !/^[srw]\d+$/.test(c.key) && c.key !== 'mode')
                    .map((c) => {
                      if (c.key === 'count' && c.kind !== 'header') {
                        return renderControl(c, baseParams[c.key] ?? c.default, (v) => handleCountChange(Number(v)));
                      }
                      return renderControl(c, baseParams[c.key], (v) => setBaseParams((p) => ({ ...p, [c.key]: v })));
                    })}
                </>
              );
            })()
          ) : (
            (BASE_LAB_CONTROLS[base] ?? []).map((c) =>
              renderControl(c, baseParams[c.key], (v) => setBaseParams((p) => ({ ...p, [c.key]: v }))),
            )
          )}
        </section>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <section style={effectsSectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.85, margin: 0, fontFamily: 'Helvetica, Arial, sans-serif' }}>Effects ({labEffects.length})</h3>
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
            <p style={{ fontSize: 10, opacity: 0.5, fontFamily: 'Helvetica, Arial, sans-serif', margin: 0 }}>No effects. Add one from the dropdown.</p>
          )}
          {labEffects.map((eff, i) => (
            <div
              key={eff.id}
              onDragOver={(e) => {
                if (dragId == null || dragId === eff.id) return;
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                const before = (e.clientY - rect.top) < rect.height / 2;
                setDragOverIndex(before ? i : i + 1);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId != null && dragOverIndex != null) {
                  const fromIdx = labEffects.findIndex((x) => x.id === dragId);
                  const adjusted = fromIdx < dragOverIndex ? dragOverIndex - 1 : dragOverIndex;
                  reorderEffectTo(dragId, adjusted);
                }
                setDragId(null);
                setDragOverIndex(null);
              }}
              style={{
                display: 'grid', gridTemplateColumns: '20px 1fr', gap: 6, padding: 0, borderRadius: 4,
                ...effectCardStyle,
                opacity: dragId === eff.id ? 0.4 : 1,
                borderTop: dragOverIndex === i ? '2px solid #7fb069' : '2px solid transparent',
                borderBottom: dragOverIndex === i + 1 ? '2px solid #7fb069' : '2px solid transparent',
                overflow: 'hidden',
              }}
            >
              <div
                draggable
                onDragStart={(e) => { setDragId(eff.id); e.dataTransfer.effectAllowed = 'move'; }}
                onDragEnd={() => { setDragId(null); setDragOverIndex(null); }}
                title="Drag to reorder"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.04)',
                  cursor: 'grab', userSelect: 'none',
                  fontSize: 14, opacity: 0.5,
                  writingMode: 'vertical-rl',
                  letterSpacing: '2px',
                }}
              >
                ⋮⋮
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <code style={{ fontSize: 11, opacity: 0.85, fontFamily: 'Helvetica, Arial, sans-serif' }}>{i + 1}.</code>
                  <select
                    value={eff.type}
                    onChange={(e) => changeEffectType(eff.id, e.target.value as BadgeEffect)}
                    style={{ fontSize: 11, flex: 1 }}
                  >
                    {EFFECT_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <code style={{ fontSize: 9, opacity: 0.6, fontFamily: 'Helvetica, Arial, sans-serif' }}>{EFFECTS[eff.type].offsetAt ? 'offset' : (EFFECTS[eff.type].zone ?? 'foreground')}</code>
                  <button onClick={() => removeEffect(eff.id)} style={{ fontSize: 10, padding: '0 6px', cursor: 'pointer' }}>×</button>
                </div>
                {(EFFECT_LAB_CONTROLS[eff.type] ?? []).map((c) =>
                  renderControl(c, eff.params[c.key], (v) => updateEffect(eff.id, c.key, v)),
                )}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
    <section style={{ ...sectionStyle, gap: 8 }}>
      <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7, margin: 0, fontFamily: 'Helvetica, Arial, sans-serif' }}>Presets</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {LAB_PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => loadPreset(p)}
            title={`Load ${p.name}`}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, cursor: 'pointer', minWidth: 96 }}
          >
            <Badge
              base={p.base}
              baseParams={p.baseParams as never}
              effects={p.effects as never}
              tone={tone}
              variant={variant}
              bloat={bloat}
              size={size}
              style={tone === 'custom' ? ({ ['--badge-edge' as never]: customColor }) : undefined}
            >
              {label}
            </Badge>
            <code style={{ fontSize: 10, opacity: 0.7, fontFamily: 'Helvetica, Arial, sans-serif' }}>{p.name}</code>
          </button>
        ))}
      </div>
    </section>
    </div>
  );
}

// --- Octant-spline drag editor -------------------------------------------------

interface SplineAnchor { s: number; r: number; w: number }

function solveSplineM(anchors: SplineAnchor[]): number[] {
  const n = anchors.length - 1;
  if (n < 1) return [0];
  const h: number[] = new Array(n);
  for (let i = 0; i < n; i++) h[i] = Math.max(1e-9, anchors[i + 1].s - anchors[i].s);
  const a: number[] = new Array(n + 1);
  const b: number[] = new Array(n + 1);
  const c: number[] = new Array(n + 1);
  const d: number[] = new Array(n + 1);
  a[0] = 0; b[0] = h[0] / 3; c[0] = h[0] / 6;
  d[0] = (anchors[1].r - anchors[0].r) / h[0];
  for (let i = 1; i < n; i++) {
    a[i] = h[i - 1] / 6;
    b[i] = (h[i - 1] + h[i]) / 3;
    c[i] = h[i] / 6;
    d[i] = (anchors[i + 1].r - anchors[i].r) / h[i] - (anchors[i].r - anchors[i - 1].r) / h[i - 1];
  }
  a[n] = h[n - 1] / 6; b[n] = h[n - 1] / 3; c[n] = 0;
  d[n] = -(anchors[n].r - anchors[n - 1].r) / h[n - 1];
  for (let i = 1; i <= n; i++) {
    const w = a[i] / b[i - 1];
    b[i] -= w * c[i - 1];
    d[i] -= w * d[i - 1];
  }
  const M: number[] = new Array(n + 1);
  M[n] = d[n] / b[n];
  for (let i = n - 1; i >= 0; i--) M[i] = (d[i] - c[i] * M[i + 1]) / b[i];
  return M;
}

function splineEval(s: number, anchors: SplineAnchor[], M: number[]): number {
  const N = anchors.length;
  if (N === 0) return 0;
  if (N === 1) return anchors[0].r;
  if (s <= anchors[0].s) return anchors[0].r;
  if (s >= anchors[N - 1].s) return anchors[N - 1].r;
  let i = 0;
  while (i < N - 1 && anchors[i + 1].s <= s) i++;
  const p0 = anchors[i];
  const p1 = anchors[i + 1];
  const h = p1.s - p0.s;
  if (h <= 0) return p0.r;
  const A = (p1.s - s) / h;
  const B = (s - p0.s) / h;
  const liftA = ((A * A * A - A) * h * h) / 6;
  const liftB = ((B * B * B - B) * h * h) / 6;
  return A * p0.r + B * p1.r + liftA * M[i] * p0.w + liftB * M[i + 1] * p1.w;
}

function naturalSplineEval(anchors: SplineAnchor[]): (s: number) => number {
  const M = solveSplineM(anchors);
  return (s) => splineEval(s, anchors, M);
}

function bsplineSplineEval(anchors: SplineAnchor[]): (s: number) => number {
  // Mirror phantom controls for zero-slope endpoint closure.
  const N = anchors.length;
  const left1 = { s: -anchors[1].s, r: anchors[1].r, w: anchors[1].w };
  const left2 = { s: -anchors[Math.min(2, N - 1)].s, r: anchors[Math.min(2, N - 1)].r, w: anchors[Math.min(2, N - 1)].w };
  const right1 = { s: 2 - anchors[N - 2].s, r: anchors[N - 2].r, w: anchors[N - 2].w };
  const right2 = { s: 2 - anchors[Math.max(N - 3, 0)].s, r: anchors[Math.max(N - 3, 0)].r, w: anchors[Math.max(N - 3, 0)].w };
  const ctrl = [left2, left1, ...anchors, right1, right2];
  const degree = 3;
  const m = ctrl.length + degree + 1;
  const knots: number[] = new Array(m);
  for (let i = 0; i <= degree; i++) knots[i] = 0;
  const interior = ctrl.length - degree - 1;
  for (let i = 1; i <= interior; i++) knots[degree + i] = i / (interior + 1);
  for (let i = m - degree - 1; i < m; i++) knots[i] = 1;
  const findSpan = (u: number): number => {
    if (u >= knots[ctrl.length]) return ctrl.length - 1;
    if (u <= knots[degree]) return degree;
    let lo = degree, hi = ctrl.length, mid = (lo + hi) >>> 1;
    while (u < knots[mid] || u >= knots[mid + 1]) {
      if (u < knots[mid]) hi = mid; else lo = mid;
      mid = (lo + hi) >>> 1;
    }
    return mid;
  };
  const basisFns = (span: number, u: number): number[] => {
    const Nb: number[] = new Array(degree + 1).fill(0);
    const left: number[] = new Array(degree + 1);
    const right: number[] = new Array(degree + 1);
    Nb[0] = 1;
    for (let j = 1; j <= degree; j++) {
      left[j] = u - knots[span + 1 - j];
      right[j] = knots[span + j] - u;
      let saved = 0;
      for (let r = 0; r < j; r++) {
        const denom = right[r + 1] + left[j - r];
        const temp = denom === 0 ? 0 : Nb[r] / denom;
        Nb[r] = saved + right[r + 1] * temp;
        saved = left[j - r] * temp;
      }
      Nb[j] = saved;
    }
    return Nb;
  };
  const evalU = (u: number): { s: number; r: number } => {
    const span = findSpan(u);
    const Nb = basisFns(span, u);
    let sN = 0, rN = 0, wS = 0;
    for (let i = 0; i <= degree; i++) {
      const c = ctrl[span - degree + i];
      const wn = c.w * Nb[i];
      sN += wn * c.s;
      rN += wn * c.r;
      wS += wn;
    }
    return wS > 0 ? { s: sN / wS, r: rN / wS } : { s: 0, r: 0 };
  };
  return (s) => {
    if (s <= 0) return evalU(0).r;
    if (s >= 1) return evalU(1).r;
    let lo = 0, hi = 1;
    for (let iter = 0; iter < 30; iter++) {
      const mid = (lo + hi) * 0.5;
      const { s: sMid } = evalU(mid);
      if (sMid < s) lo = mid; else hi = mid;
      if (hi - lo < 1e-5) break;
    }
    return evalU((lo + hi) * 0.5).r;
  };
}

function OctantSplineEditor({
  anchors,
  onAnchorChange,
  onAnchorDelete,
  onAnchorAdd,
  mode,
  evalAtS,
}: {
  anchors: SplineAnchor[];
  onAnchorChange: (idx: number, next: SplineAnchor) => void;
  onAnchorDelete: (idx: number) => void;
  onAnchorAdd: (s: number, r: number) => void;
  mode: 'octant' | 'quadrant';
  evalAtS: (s: number) => number;
}) {
  const N = anchors.length;
  const maxAngle = mode === 'octant' ? Math.PI / 4 : Math.PI / 2;
  // In octant mode anchors sit at θ = arcsin(s)/2 (so s = sin(2θ)). In quadrant mode the
  // mapping is linear: θ = s · π/2.
  const sToTheta = (s: number) => mode === 'octant'
    ? Math.asin(Math.max(0, Math.min(1, s))) / 2
    : Math.max(0, Math.min(1, s)) * (Math.PI / 2);
  const thetaToS = (θ: number) => mode === 'octant'
    ? Math.sin(2 * Math.max(0, Math.min(Math.PI / 4, θ)))
    : Math.max(0, Math.min(1, θ / (Math.PI / 2)));
  const anchorTheta = anchors.map((a) => sToTheta(a.s));
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [normalAxis, setNormalAxis] = useState<{ nx: number; ny: number; ox: number; oy: number } | null>(null);

  const screenToViewBox = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  };

  const onMove = (clientX: number, clientY: number) => {
    if (dragIdx === null) return;
    const local = screenToViewBox(clientX, clientY);
    if (!local) return;
    const isFirst = dragIdx === 0;
    const isLast = dragIdx === N - 1;
    if (isFirst || isLast) {
      // Endpoints are locked to their respective cardinal/diagonal rays. Project the pointer
      // onto that ray to derive a new radius.
      const θFixed = isFirst ? 0 : maxAngle;
      const projected = local.x * Math.cos(θFixed) + (-local.y) * Math.sin(θFixed);
      const r = Math.round(Math.max(0, Math.min(71, projected)) * 2) / 2;
      onAnchorChange(dragIdx, { s: isFirst ? 0 : 1, r, w: anchors[dragIdx].w });
      return;
    }
    if (normalAxis) {
      // Shift-drag: motion constrained to the curve's local normal at the anchor's nearest
      // curve point. Slides the anchor along that normal axis only — its tangential position
      // along the curve stays fixed.
      const dx = local.x - normalAxis.ox;
      const dy = local.y - normalAxis.oy;
      const proj = dx * normalAxis.nx + dy * normalAxis.ny;
      const px = normalAxis.ox + proj * normalAxis.nx;
      const py = normalAxis.oy + proj * normalAxis.ny;
      const radius = Math.max(0, Math.min(71, Math.hypot(px, py)));
      const θClamped = Math.max(0, Math.min(maxAngle, Math.atan2(-py, Math.max(0.001, px))));
      const sRaw = thetaToS(θClamped);
      const prevS = anchors[dragIdx - 1].s;
      const nextS = anchors[dragIdx + 1].s;
      const eps = 0.005;
      const s = Math.max(prevS + eps, Math.min(nextS - eps, sRaw));
      onAnchorChange(dragIdx, { s: Math.round(s * 1000) / 1000, r: Math.round(radius * 2) / 2, w: anchors[dragIdx].w });
      return;
    }
    // Interior anchor: free 2D drag. Convert pointer (x, -y) → polar; clamp s to the gap
    // between neighbors so anchors stay sorted.
    const radius = Math.max(0, Math.min(71, Math.hypot(local.x, local.y)));
    const θClamped = Math.max(0, Math.min(maxAngle, Math.atan2(-local.y, Math.max(0.001, local.x))));
    const sRaw = thetaToS(θClamped);
    const prev = anchors[dragIdx - 1].s;
    const next = anchors[dragIdx + 1].s;
    const eps = 0.005;
    const s = Math.max(prev + eps, Math.min(next - eps, sRaw));
    onAnchorChange(dragIdx, { s: Math.round(s * 1000) / 1000, r: Math.round(radius * 2) / 2, w: anchors[dragIdx].w });
  };

  useEffect(() => {
    if (dragIdx === null) return;
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onMouseUp = () => { setDragIdx(null); setNormalAxis(null); };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragIdx]);

  const curveSamples: { x: number; y: number }[] = [];
  const samplePoints: string[] = [];
  for (let i = 0; i <= 192; i++) {
    const s = i / 192;
    const r = evalAtS(s);
    const θSample = sToTheta(s);
    const x = r * Math.cos(θSample);
    const y = -r * Math.sin(θSample);
    curveSamples.push({ x, y });
    samplePoints.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }

  const axisLen = 75;
  // viewBox needs more room vertically in quadrant mode (the curve sweeps from east to north).
  const viewBox = mode === 'octant' ? '-8 -80 90 90' : '-8 -82 90 92';
  const endLabel = mode === 'octant' ? 'diagonal (s = 1)' : 'next cardinal (s = 1)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <svg
        ref={svgRef}
        viewBox={viewBox}
        style={{ width: '100%', aspectRatio: '1', background: '#0a0806', borderRadius: 4, cursor: dragIdx !== null ? 'grabbing' : 'default', userSelect: 'none' }}
        onClick={(e) => {
          if (!e.altKey) return;
          if (anchors.length >= 12) return;
          const local = screenToViewBox(e.clientX, e.clientY);
          if (!local) return;
          const r = Math.max(0, Math.min(71, Math.hypot(local.x, local.y)));
          const θ = Math.max(0, Math.min(maxAngle, Math.atan2(-local.y, Math.max(0.001, local.x))));
          onAnchorAdd(thetaToS(θ), Math.round(r * 2) / 2);
        }}
      >
        {/* Radial grid */}
        {[10, 20, 30, 40, 50, 60, 70].map((r) => (
          <path
            key={r}
            d={`M ${r} 0 A ${r} ${r} 0 0 0 ${(r * Math.cos(maxAngle)).toFixed(2)} ${(-r * Math.sin(maxAngle)).toFixed(2)}`}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="0.3"
          />
        ))}
        {/* Cardinal (s=0) and end (s=1) reference rays */}
        <line x1="0" y1="0" x2={axisLen} y2="0" stroke="rgba(255,255,255,0.25)" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
        <line x1="0" y1="0" x2={(axisLen * Math.cos(maxAngle)).toFixed(2)} y2={(-axisLen * Math.sin(maxAngle)).toFixed(2)} stroke="rgba(255,255,255,0.25)" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
        <text x="76" y="2" fontSize="3" fill="rgba(255,255,255,0.45)" fontFamily="Helvetica, Arial, sans-serif">cardinal (s = 0)</text>
        <text x={(axisLen * Math.cos(maxAngle) + 2).toFixed(2)} y={(-axisLen * Math.sin(maxAngle) - 1).toFixed(2)} fontSize="3" fill="rgba(255,255,255,0.45)" fontFamily="Helvetica, Arial, sans-serif">{endLabel}</text>
        {/* Spline curve */}
        <polyline points={samplePoints.join(' ')} fill="rgba(127,176,105,0.18)" stroke="#7fb069" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
        {/* Anchors */}
        {anchorTheta.map((θ, idx) => {
          const a = anchors[idx];
          const x = a.r * Math.cos(θ);
          const y = -a.r * Math.sin(θ);
          const isPinned = idx === 0 || idx === N - 1;
          return (
            <g key={idx}>
              <line x1="0" y1="0" x2={x.toFixed(2)} y2={y.toFixed(2)} stroke="rgba(255,255,255,0.08)" strokeWidth="0.25" />
              <circle
                cx={x}
                cy={y}
                r={dragIdx === idx ? 2.6 : (1.5 + a.w * 0.7)}
                fill={dragIdx === idx ? '#fff' : (isPinned ? '#3a2c1e' : '#1e1610')}
                stroke={isPinned ? '#a59685' : '#7fb069'}
                strokeWidth="0.7"
                style={{ cursor: 'grab' }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setDragIdx(idx);
                  if (e.shiftKey && !isPinned) {
                    // Lock motion to the curve's local normal at the curve sample nearest
                    // this anchor. Find nearest sample, compute tangent from neighbors,
                    // rotate 90° for the normal, orient it to point away from the curve
                    // toward the anchor.
                    let closest = 0;
                    let minD2 = Infinity;
                    for (let k = 0; k < curveSamples.length; k++) {
                      const dx = curveSamples[k].x - x;
                      const dy = curveSamples[k].y - y;
                      const d2 = dx * dx + dy * dy;
                      if (d2 < minD2) { minD2 = d2; closest = k; }
                    }
                    const prev = curveSamples[Math.max(0, closest - 1)];
                    const next = curveSamples[Math.min(curveSamples.length - 1, closest + 1)];
                    const tx = next.x - prev.x;
                    const ty = next.y - prev.y;
                    const tl = Math.hypot(tx, ty) || 1;
                    let nx = -ty / tl;
                    let ny = tx / tl;
                    const towardX = x - curveSamples[closest].x;
                    const towardY = y - curveSamples[closest].y;
                    if (towardX * nx + towardY * ny < 0) { nx = -nx; ny = -ny; }
                    setNormalAxis({ nx, ny, ox: curveSamples[closest].x, oy: curveSamples[closest].y });
                  } else {
                    setNormalAxis(null);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!isPinned && N > 3) onAnchorDelete(idx);
                }}
                onWheel={(e) => {
                  e.preventDefault();
                  const delta = e.deltaY > 0 ? -0.1 : 0.1;
                  const newW = Math.max(0, Math.min(3, Math.round((a.w + delta) * 10) / 10));
                  onAnchorChange(idx, { s: a.s, r: a.r, w: newW });
                }}
              />
              <text x={x + 2.5} y={y - 1.5} fontSize="2.8" fill="rgba(255,255,255,0.7)" fontFamily="Helvetica, Arial, sans-serif">
                {`(${a.s.toFixed(2)}, ${a.r.toFixed(1)}) w${a.w.toFixed(1)}`}
              </text>
            </g>
          );
        })}
      </svg>
      <p style={{ fontSize: 9, opacity: 0.55, margin: 0, fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <strong>Drag</strong> a dot to move it freely. <strong>Shift-drag</strong> locks motion to the curve's local normal axis (slides the anchor toward/away from the curve without changing its tangential position). <strong>Scroll</strong> over a dot to change its weight (visual size scales with weight). <strong>Right-click</strong> an interior dot to delete it. <strong>Alt-click</strong> anywhere on the canvas to insert a new anchor. Endpoint anchors (cream) are pinned to the cardinal / diagonal axes.
      </p>
    </div>
  );
}

// --- Quatrefoil octant explorer ------------------------------------------------

type QFParams = Parameters<typeof import('./bases/Quatrefoil').quatrefoilVertices>[0];

const QF_DEFAULTS: Required<NonNullable<QFParams>> = {
  spikeR: 50,
  lobeR: 42,
  valleyR: 25,
  valleyAt: 0.5,
  spikeCurvature: 1,
  spikeBend: 0,
  spikeTipErosion: 0,
  lobeCurvature: 1,
  lobeBend: 0,
  lobeTipErosion: 0,
  valleySmooth: 3,
  rotation: 0,
  samples: 192,
};

function smoothMaxOctant(a: number, b: number, g: number): number {
  const d = a - b;
  return (a + b + Math.sqrt(d * d + g * g)) / 2;
}

function octantR(s: number, p: Required<NonNullable<QFParams>>): number {
  const spike = Math.max(5, Math.min(p.spikeR, 50));
  const lobe = Math.max(5, Math.min(p.lobeR, 50 * Math.SQRT2));
  const valley = Math.max(0, Math.min(p.valleyR, Math.min(spike, lobe)));
  const vAt = Math.max(0.05, Math.min(p.valleyAt, 0.95));
  const sCurv = Math.max(0.2, p.spikeCurvature);
  const sBend = Math.max(-0.95, Math.min(p.spikeBend, 0.95));
  const sErode = Math.max(0, Math.min(p.spikeTipErosion, 1));
  const lCurv = Math.max(0.2, p.lobeCurvature);
  const lBend = Math.max(-0.95, Math.min(p.lobeBend, 0.95));
  const lErode = Math.max(0, Math.min(p.lobeTipErosion, 1));
  const smooth = Math.max(0, p.valleySmooth);
  const seg = (t: number, curv: number, bend: number, erode: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1 - erode;
    const a = Math.max(0.1, curv * (1 + bend));
    const b = Math.max(0.1, curv * (1 - bend));
    const v = Math.pow(1 - Math.pow(1 - t, a), 1 / b);
    return Math.min(v, 1 - erode);
  };
  const t1 = (vAt - s) / vAt;
  const t2 = (s - vAt) / (1 - vAt);
  const rSpike = valley + (spike - valley) * seg(Math.max(0, t1), sCurv, sBend, sErode);
  const rLobe = valley + (lobe - valley) * seg(Math.max(0, t2), lCurv, lBend, lErode);
  return smoothMaxOctant(rSpike, rLobe, smooth);
}

function OctantCell({ params, label, size = 100 }: { params: Partial<NonNullable<QFParams>>; label: string; size?: number }) {
  const full: Required<NonNullable<QFParams>> = { ...QF_DEFAULTS, ...params };
  const N = 96;
  // Octant arc from θ=0 (cardinal, east) to θ=π/4 (diagonal, NE). SVG y is flipped so we
  // negate y to draw the diagonal going up-right.
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const θ = (i / N) * (Math.PI / 4);
    const s = Math.sin(2 * θ);
    const r = octantR(s, full);
    const x = r * Math.cos(θ);
    const y = -r * Math.sin(θ);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  // Coordinate frame: -5..80 horizontal, -80..5 vertical. Pad a bit for the diagonal end.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg viewBox="-5 -80 90 85" width={size} height={size} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 4 }}>
        {/* Reference axes */}
        <line x1="0" y1="0" x2="75" y2="0" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" strokeDasharray="2 2" />
        <line x1="0" y1="0" x2={(75 * Math.cos(Math.PI / 4)).toFixed(2)} y2={(-75 * Math.sin(Math.PI / 4)).toFixed(2)} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" strokeDasharray="2 2" />
        {/* Curve */}
        <polyline points={pts.join(' ')} fill="rgba(127,176,105,0.18)" stroke="#7fb069" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        <circle cx="0" cy="0" r="1.2" fill="rgba(255,255,255,0.3)" />
      </svg>
      <code style={{ fontSize: 9, opacity: 0.7, fontFamily: 'Helvetica, Arial, sans-serif' }}>{label}</code>
    </div>
  );
}

function ParamSweep({ title, paramKey, values, fmt }: {
  title: string;
  paramKey: keyof NonNullable<QFParams>;
  values: number[];
  fmt?: (v: number) => string;
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.75, margin: 0, fontFamily: 'Helvetica, Arial, sans-serif' }}>{title}</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {values.map((v) => (
          <OctantCell key={`${String(paramKey)}-${v}`} params={{ [paramKey]: v } as Partial<NonNullable<QFParams>>} label={`${String(paramKey)} = ${fmt ? fmt(v) : v}`} />
        ))}
      </div>
    </section>
  );
}

export const QuatrefoilOctants: Story = {
  name: 'Quatrefoil octants',
  args: { children: 'OCTANT' },
  argTypes: {
    shape: { table: { disable: true } }, shapeParams: { table: { disable: true } },
    base: { table: { disable: true } }, baseParams: { table: { disable: true } },
    effects: { table: { disable: true } }, tone: { table: { disable: true } },
    variant: { table: { disable: true } }, size: { table: { disable: true } },
    crawl: { table: { disable: true } }, bloat: { table: { disable: true } },
    padding: { table: { disable: true } },
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: 16, fontFamily: 'Helvetica, Arial, sans-serif' }}>
      <p style={{ fontSize: 12, opacity: 0.7, margin: 0, maxWidth: 760, lineHeight: 1.5 }}>
        One octant of the quatrefoil curve. The horizontal dashed line is the cardinal axis (s = 0);
        the 45° dashed line is the diagonal axis (s = 1). All other params default; only the
        labeled param varies. Green polyline traces r(s) from cardinal to diagonal.
      </p>
      <ParamSweep title="spikeCurvature" paramKey="spikeCurvature" values={[0.4, 0.7, 1, 1.5, 2.5, 4]} />
      <ParamSweep title="spikeBend" paramKey="spikeBend" values={[-0.8, -0.4, 0, 0.4, 0.8]} fmt={(v) => v.toFixed(2)} />
      <ParamSweep title="spikeTipErosion" paramKey="spikeTipErosion" values={[0, 0.2, 0.4, 0.6, 0.85]} fmt={(v) => v.toFixed(2)} />
      <ParamSweep title="valleyAt" paramKey="valleyAt" values={[0.15, 0.3, 0.5, 0.7, 0.85]} fmt={(v) => v.toFixed(2)} />
      <ParamSweep title="valleyR" paramKey="valleyR" values={[5, 15, 25, 35, 45]} />
      <ParamSweep title="valleySmooth" paramKey="valleySmooth" values={[0, 1.5, 3, 6, 12]} />
      <ParamSweep title="lobeCurvature" paramKey="lobeCurvature" values={[0.4, 0.7, 1, 1.5, 2.5, 4]} />
      <ParamSweep title="lobeBend" paramKey="lobeBend" values={[-0.8, -0.4, 0, 0.4, 0.8]} fmt={(v) => v.toFixed(2)} />
      <ParamSweep title="lobeTipErosion" paramKey="lobeTipErosion" values={[0, 0.2, 0.4, 0.6, 0.85]} fmt={(v) => v.toFixed(2)} />
      <ParamSweep title="lobeR (peak radius)" paramKey="lobeR" values={[25, 42, 55, 65, 70]} />
      <ParamSweep title="spikeR (tip radius)" paramKey="spikeR" values={[15, 25, 35, 45, 50]} />
    </div>
  ),
};

export const ComposeLab: Story = {
  name: 'Compose lab',
  args: { children: 'COMPOSE', tone: 'accent', variant: 'solid' },
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
           label={typeof args.children === 'string' ? args.children : 'COMPOSE'}
    />
  ),
};
