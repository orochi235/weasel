import { useState, type CSSProperties } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Badge } from './Badge';
import { ALL_SHAPES, SHAPES } from './shapes';
import type { BadgeShape, BadgeStatus, BadgeVariant } from './types';
import { quatrefoilRadius, type QuatrefoilParams } from './bases/Quatrefoil';
import { SHAPE_CONTROLS, defaultParamsFor } from './shapeControls';
import { ComposeLabView } from './lab/ComposeLabView';
import { BADGE_STATUS_ICONS } from './statusIcons';
import { BADGE_VARIANT_ICONS } from './variantIcons';

const STATUSES: BadgeStatus[] = ['accent', 'info', 'success', 'warn', 'danger', 'muted', 'neutral'];
const VARIANTS: BadgeVariant[] = ['outline', 'solid', 'subtle'];

const meta: Meta<typeof Badge> = {
  title: 'ui/Foundations/Badge',
  component: Badge,
  args: {
    children: 'LABEL',
    shape: 'pill',
    status: 'accent',
    variant: 'outline',
    size: 'sm',
  },
  argTypes: {
    children: { control: 'text', description: 'Badge label content' },
    shape: { control: 'select', options: ALL_SHAPES },
    status: { control: { type: 'inline-radio', icons: BADGE_STATUS_ICONS }, options: STATUSES },
    variant: { control: { type: 'inline-radio', icons: BADGE_VARIANT_ICONS }, options: VARIANTS },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md'] },
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

function ShapeCard({ shape, status, variant, label, params, onChange }: {
  shape: BadgeShape;
  status: BadgeStatus;
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
  const labelStyle: CSSProperties = { fontSize: 9, opacity: 0.7 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 6, background: 'rgba(255,255,255,0.02)', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', minHeight: 56 }}>
        <Badge shape={shape} status={status} variant={variant} shapeParams={params as never}>{label}</Badge>
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

function AllShapesView({ status, variant, label }: {
  status: BadgeStatus;
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
          style={{ fontFamily: 'var(--wzl-font-mono)', fontSize: 11, padding: 8, width: '100%', boxSizing: 'border-box' }}
        />
      )}
      {SHAPE_CATEGORIES.map((cat) => (
        <section key={cat.title}>
          <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7, margin: '0 0 12px' }}>{cat.title}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, alignItems: 'start' }}>
            {cat.shapes.map((shape) => (
              <ShapeCard
                key={shape}
                shape={shape}
                status={status}
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
  tags: ['gallery'],
  args: {
    children: 'ZORF',
    status: 'muted',
    variant: 'outline',
  },
  argTypes: {
    shape: { table: { disable: true } },
    shapeParams: { table: { disable: true } },
  },
  render: (args) => (
    <AllShapesView
           status={args.status ?? 'accent'}
      variant={args.variant ?? 'outline'}
      label={typeof args.children === 'string' ? args.children : 'LABEL'}
    />
  ),
};

export const StatusVariantMatrix: Story = {
  tags: ['gallery'],
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
          {STATUSES.map((status) => (
            <tr key={status}>
              <td style={{ fontSize: 10, textTransform: 'uppercase', opacity: 0.7 }}>{status}</td>
              {VARIANTS.map((variant) => (
                <td key={variant}>
                  <Badge
                    shape={args.shape as never}
                    status={status}
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

/** `tone` says which of its peers a badge is: an index into the theme's tone
 *  list, the same one a panel takes. It paints over the status. */
export const PeerTones: Story = {
  render: (args) => (
    <div>
      {VARIANTS.map((variant) => (
        <p key={variant}>
          {[0, 1, 2, 3, 4, 5].map((tone) => (
            <span key={tone}>
              <Badge shape={args.shape as never} variant={variant} size={args.size} tone={tone}>
                {`peer ${tone}`}
              </Badge>{' '}
            </span>
          ))}
        </p>
      ))}
    </div>
  ),
};

export const BaselineRow: Story = {
  name: 'Baseline justification',
  render: (_args) => (
    <p style={{ fontSize: 14, lineHeight: 1.6 }}>
      Inline text with{' '}
      <Badge shape="pill" status="accent" >pill</Badge>{' '}
      <Badge shape="square" status="info" >square</Badge>{' '}
      <Badge shape="notched" status="warn" >notched</Badge>{' '}
      <Badge shape="shield" status="danger" >shield</Badge>{' '}
      <Badge shape="ribbon" status="muted" shapeParams={{ left: 'outward', right: 'outward' } as never} >ribbon</Badge>{' '}
      <Badge shape="house" status="accent" >house</Badge>{' '}
      and trailing copy.
    </p>
  ),
};

export const Sizes: Story = {
  render: (args) => {
    const label = typeof args.children === 'string' ? args.children : 'LABEL';
    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
        <Badge size="xs" shape={args.shape as never} status={args.status} variant={args.variant}>{label} xs</Badge>
        <Badge size="sm" shape={args.shape as never} status={args.status} variant={args.variant}>{label} sm</Badge>
        <Badge size="md" shape={args.shape as never} status={args.status} variant={args.variant}>{label} md</Badge>
      </div>
    );
  },
};

export const Removable: Story = { args: { onRemove: () => {} } };

export const Clickable: Story = { args: { onClick: () => {} } };

/** A plain badge with `tooltip` joins the tab order as an image named by its
 *  text; hover or Tab to it. */
export const WithTooltip: Story = {
  args: { children: '?', status: 'muted', size: 'xs', tooltip: 'Matched by a predicate, not a fixed id' },
};

export const EdgeCases: Story = {
  render: (_args) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
      <Badge status="info" >A very long label that tests overflow</Badge>
      <Badge shape="plain" status="warn" >
        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'currentColor', marginRight: 4, verticalAlign: 'middle' }} />
        live
      </Badge>
      <Badge shape="starburst" status="danger" variant="solid" >NEW</Badge>
      <Badge shape="ribbon" status="accent" shapeParams={{ left: 'outward', right: 'outward' } as never} >RIBBON</Badge>
      <Badge shape="perforated" status="muted" >STAMP</Badge>
      <Badge shape="house" status="info" >HOME</Badge>
      <Badge shape="cloud" status="warn" >CLOUDY</Badge>
    </div>
  ),
};

export const InlineWrapping: Story = {
  name: 'Edge case: inline wrap mid-badge',
  render: (_args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 360, lineHeight: 1.7 }}>
      <p style={{ margin: 0 }}>
        A normal paragraph that contains{' '}
        <Badge shape="pill" status="accent" >
          a sufficiently long inline badge label
        </Badge>{' '}
        and continues afterward to force the badge to be broken across two visual lines.
      </p>
      <p style={{ margin: 0 }}>
        With <code>display: inline-flex</code>, badges don't fragment — they stay whole and either fit the line or push to a new one.
        Here's the same thing with a longer payload:{' '}
        <Badge shape="square" status="info" >
          this badge has even more text inside that the line can't hold
        </Badge>{' '}
        trailing copy.
      </p>
      <p style={{ margin: 0 }}>
        Constrained-width container —{' '}
        <Badge shape="ribbon" status="warn" >
          a ribbon badge that wraps because of width
        </Badge>{' '}
        and we keep going.
      </p>
    </div>
  ),
};

export const ComposeShowcase: Story = {
  tags: ['gallery'],
  name: 'Compose: base + effects',
  args: { children: 'COMPOSE', status: 'danger', variant: 'solid' },
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
        status="accent"
        variant="outline"
        base="chamfered-rect"
        baseParams={{ chamfer: 12 }}
        effects={[{ type: 'spikes', params: { count: 60, length: 14, baseWidth: 2.5, vertScale: 1.8, irregularity: 0.3 } }]}
      >
        URCHIN
      </Badge>
      <Badge
        {...args}
        status="info"
        variant="outline"
        base="rounded-rect"
        baseParams={{ erosion: 0.5 }}
        effects={[{ type: 'puffs', params: { bumpWidth: 16, puffiness: 10 } }]}
      >
        CLOUD
      </Badge>
      <Badge
        {...args}
        status="warn"
        variant="solid"
        base="rounded-rect"
        baseParams={{ erosion: 0.75 }}
        effects={[{ type: 'puffs', params: { bumpWidth: 14, puffiness: 8, irregularity: 0.6 } }]}
      >
        BUMPY
      </Badge>
      <Badge
        {...args}
        status="muted"
        variant="outline"
        base="rounded-rect"
        baseParams={{ erosion: 0.27 }}
        effects={[{ type: 'bites', params: { biteRadius: 3, biteSpacing: 8 } }]}
      >
        STAMP
      </Badge>
      <Badge
        {...args}
        status="info"
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
        status="accent"
        variant="outline"
        base="rounded-rect"
        baseParams={{ erosion: 0.4 }}
        effects={[{ type: 'scallops', params: { scallopRadius: 5, scallopSpacing: 12 } }]}
      >
        SCALLOPS
      </Badge>
      <Badge
        {...args}
        status="muted"
        variant="solid"
        base="rounded-rect"
        baseParams={{ erosion: 0.67 }}
        effects={[{ type: 'scallops', params: { scallopRadius: 3, scallopSpacing: 7, irregularity: 0.5 } }]}
      >
        WAVY
      </Badge>
      <Badge
        {...args}
        status="warn"
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
        status="info"
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
      <Badge shape="pill" status="accent" variant="outline" >active</Badge>
      <Badge shape="pill" status="warn" variant="outline" >ambient</Badge>
      <Badge shape="pill" status="info" variant="outline" >hotkey</Badge>
      <Badge shape="pill" status="danger" variant="solid" >inactive</Badge>
    </div>
  ),
};

// --- Quatrefoil octant explorer ------------------------------------------------

function OctantCell({ params, label }: { params: QuatrefoilParams; label: string }) {
  const radiusAt = quatrefoilRadius(params);
  const N = 96;
  // Octant arc from θ=0 (cardinal, east) to θ=π/4 (diagonal, NE). SVG y is flipped so we
  // negate y to draw the diagonal going up-right.
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const θ = (i / N) * (Math.PI / 4);
    const s = Math.sin(2 * θ);
    const r = radiusAt(s);
    const x = r * Math.cos(θ);
    const y = -r * Math.sin(θ);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  // Coordinate frame: -5..80 horizontal, -80..5 vertical. Pad a bit for the diagonal end.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg viewBox="-5 -80 90 85" width={100} height={100} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 4 }}>
        {/* Reference axes */}
        <line x1="0" y1="0" x2="75" y2="0" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" strokeDasharray="2 2" />
        <line x1="0" y1="0" x2={(75 * Math.cos(Math.PI / 4)).toFixed(2)} y2={(-75 * Math.sin(Math.PI / 4)).toFixed(2)} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" strokeDasharray="2 2" />
        {/* Curve */}
        <polyline points={pts.join(' ')} fill="rgba(127,176,105,0.18)" stroke="#7fb069" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        <circle cx="0" cy="0" r="1.2" fill="rgba(255,255,255,0.3)" />
      </svg>
      <code style={{ fontSize: 9, opacity: 0.7 }}>{label}</code>
    </div>
  );
}

function ParamSweep({ title, paramKey, values, fmt }: {
  title: string;
  paramKey: keyof QuatrefoilParams;
  values: number[];
  fmt?: (v: number) => string;
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.75, margin: 0 }}>{title}</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {values.map((v) => (
          <OctantCell key={`${String(paramKey)}-${v}`} params={{ [paramKey]: v } as QuatrefoilParams} label={`${String(paramKey)} = ${fmt ? fmt(v) : v}`} />
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
    effects: { table: { disable: true } }, status: { table: { disable: true } },
    variant: { table: { disable: true } }, size: { table: { disable: true } },
    crawl: { table: { disable: true } }, bloat: { table: { disable: true } },
    padding: { table: { disable: true } },
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: 16 }}>
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
  args: { children: 'COMPOSE', status: 'accent', variant: 'solid' },
  argTypes: {
    shape: { table: { disable: true } },
    shapeParams: { table: { disable: true } },
    base: { table: { disable: true } },
    baseParams: { table: { disable: true } },
    effects: { table: { disable: true } },
  },
  render: (args) => (
    <ComposeLabView
      status={args.status ?? 'accent'}
      variant={args.variant ?? 'solid'}
      label={typeof args.children === 'string' ? args.children : 'COMPOSE'}
    />
  ),
};
