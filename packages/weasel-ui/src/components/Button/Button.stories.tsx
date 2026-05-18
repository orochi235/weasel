import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { Button, type ButtonVariant, type ButtonSize } from './Button';
import { ToggleBar as KitToggleBar } from '../ToggleBar/ToggleBar';

const meta: Meta<typeof Button> = {
  title: 'weasel-ui/Foundations/Button',
  component: Button,
  args: {
    children: 'Save',
    variant: 'secondary',
    size: 'md',
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost'] },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    fullWidth: { control: 'boolean' },
    iconOnly: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

const PlusIcon = (): ReactElement => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M8 3v10M3 8h10" />
  </svg>
);

const ChevronIcon = (): ReactElement => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4l4 4-4 4" />
  </svg>
);

const TrashIcon = (): ReactElement => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 4h10M6.5 4V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M4.5 4l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8" />
  </svg>
);

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Ghost: Story = { args: { variant: 'ghost' } };

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Button size="sm" variant="primary">Small</Button>
      <Button size="md" variant="primary">Medium</Button>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <Button variant="primary" leadingIcon={<PlusIcon />}>Add layer</Button>
      <Button variant="secondary" trailingIcon={<ChevronIcon />}>Next</Button>
      <Button variant="ghost" leadingIcon={<TrashIcon />} trailingIcon={<ChevronIcon />}>
        Delete
      </Button>
    </div>
  ),
};

export const IconOnly: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Button iconOnly ariaLabel="Add" variant="primary"><PlusIcon /></Button>
      <Button iconOnly ariaLabel="Add" variant="secondary"><PlusIcon /></Button>
      <Button iconOnly ariaLabel="Add" variant="ghost"><PlusIcon /></Button>
      <Button iconOnly ariaLabel="Delete" variant="secondary" size="sm"><TrashIcon /></Button>
    </div>
  ),
};

export const Loading: Story = {
  args: { variant: 'primary', loading: true, children: 'Saving…' },
};

export const Disabled: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Button variant="primary" disabled>Primary</Button>
      <Button variant="secondary" disabled>Secondary</Button>
      <Button variant="ghost" disabled>Ghost</Button>
    </div>
  ),
};

export const FullWidth: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <Button variant="primary" fullWidth>Submit</Button>
    </div>
  ),
};

const VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'ghost'];
const SIZES: ButtonSize[] = ['sm', 'md'];

export const Matrix: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(3, 1fr)', gap: 12, alignItems: 'center' }}>
      <div />
      {VARIANTS.map((v) => (
        <div key={v} style={{ fontSize: 11, color: 'var(--wzl-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {v}
        </div>
      ))}
      {SIZES.flatMap((sz) => [
        <div key={`lbl-${sz}`} style={{ fontSize: 11, color: 'var(--wzl-fg-muted)' }}>{sz}</div>,
        ...VARIANTS.map((v) => (
          <div key={`${sz}-${v}`} style={{ display: 'flex', gap: 8 }}>
            <Button variant={v} size={sz}>Button</Button>
            <Button variant={v} size={sz} disabled>Off</Button>
          </div>
        )),
      ])}
    </div>
  ),
};

// ---------- Lab ----------

interface LabParams {
  // Geometry
  radius: number;
  height: number;
  padx: number;
  fontsize: number;
  fontweight: 200 | 300 | 400;
  label: string;
  // Tone (overrides --wzl-accent)
  accent: string;
  // Body gradient
  topAlpha: number;
  upperAlpha: number;
  equator: number;
  equatorSpread: number;
  equatorTint: number;
  baseTint: number;
  blur: number;
  saturate: number;
  // Gloss
  glossTop: number;
  glossMid: number;
  glossBottom: number;
  // Shadows
  rim: number;
  dropNear: number;
  dropFar: number;
  insetHi: number;
  insetLo: number;
  // Text
  textShadow: number;
  textInset: number;
  textInsetAngle: number;
  textInsetDist: number;
  // Lab UX
  zoom: number;
  backdrop: 'glass' | 'panel' | 'photo' | 'gradient' | 'grid';
  variant: ButtonVariant;
  target: 'button' | 'togglebar';
}

const LAB_DEFAULTS: LabParams = {
  radius: 999,
  height: 28,
  padx: 16,
  fontsize: 14,
  fontweight: 400,
  label: 'Continue',
  accent: '#2e1f7a',
  topAlpha: 45,
  upperAlpha: 70,
  equator: 52,
  equatorSpread: 12,
  equatorTint: 95,
  baseTint: 70,
  blur: 6,
  saturate: 1.3,
  glossTop: 0.7,
  glossMid: 0.18,
  glossBottom: 50,
  rim: 0.22,
  dropNear: 0.3,
  dropFar: 0.18,
  insetHi: 0.7,
  insetLo: 0.3,
  textShadow: 0.35,
  textInset: 0.55,
  textInsetAngle: 180,
  textInsetDist: 1,
  zoom: 2,
  backdrop: 'photo',
  variant: 'primary',
  target: 'togglebar',
};

function buttonStyleFromLab(p: LabParams): CSSProperties {
  return {
    ['--wzl-accent' as never]: p.accent,
    ['--btn-radius' as never]: `${p.radius}px`,
    ['--btn-height' as never]: `${p.height}px`,
    ['--btn-padx' as never]: `${p.padx}px`,
    ['--btn-fontsize' as never]: `${p.fontsize}px`,
    ['--btn-fontweight' as never]: String(p.fontweight),
    ['--btn-top-alpha' as never]: `${p.topAlpha}%`,
    ['--btn-upper-alpha' as never]: `${p.upperAlpha}%`,
    ['--btn-equator' as never]: `${p.equator}%`,
    ['--btn-equator-spread' as never]: `${p.equatorSpread}%`,
    ['--btn-equator-tint' as never]: `${p.equatorTint}%`,
    ['--btn-base-tint' as never]: `${p.baseTint}%`,
    ['--btn-blur' as never]: `${p.blur}px`,
    ['--btn-saturate' as never]: String(p.saturate),
    ['--btn-gloss-top' as never]: String(p.glossTop),
    ['--btn-gloss-mid' as never]: String(p.glossMid),
    ['--btn-gloss-bottom' as never]: `${p.glossBottom}%`,
    ['--btn-rim' as never]: String(p.rim),
    ['--btn-drop-near' as never]: String(p.dropNear),
    ['--btn-drop-far' as never]: String(p.dropFar),
    ['--btn-inset-hi' as never]: String(p.insetHi),
    ['--btn-inset-lo' as never]: String(p.insetLo),
    ['--btn-text-shadow' as never]: String(p.textShadow),
    ['--btn-text-inset' as never]: String(p.textInset),
    // Compass angle: 0° = up, 90° = right, 180° = down (CSS gradient convention).
    ['--btn-text-inset-x' as never]: `${(Math.sin((p.textInsetAngle * Math.PI) / 180) * p.textInsetDist).toFixed(2)}px`,
    ['--btn-text-inset-y' as never]: `${(-Math.cos((p.textInsetAngle * Math.PI) / 180) * p.textInsetDist).toFixed(2)}px`,
  };
}

const BACKDROP_STYLE: Record<LabParams['backdrop'], CSSProperties> = {
  panel: { background: 'var(--wzl-surface)' },
  glass: { background: 'var(--wzl-surface-raised)' },
  gradient: { background: 'conic-gradient(from 180deg at 30% 40%, #2a4cff, #ff3da5, #ffb800, #14d97e, #2a4cff)' },
  photo: {
    background:
      'linear-gradient(140deg, #1a2a6c, #b21f1f 60%, #fdbb2d), radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2), transparent 50%)',
    backgroundBlendMode: 'overlay',
  },
  grid: {
    background:
      'repeating-linear-gradient(0deg, var(--wzl-surface-raised) 0 12px, var(--wzl-surface) 12px 24px),' +
      'repeating-linear-gradient(90deg, transparent 0 12px, rgba(255,255,255,0.04) 12px 24px)',
  },
};

const ctrlLabelStyle: CSSProperties = {
  fontSize: 10,
  opacity: 0.7,
  fontFamily: 'Helvetica, Arial, sans-serif',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};
const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 12,
  borderRadius: 6,
  background: 'rgba(127, 176, 105, 0.06)',
  border: '1px solid rgba(255,255,255,0.06)',
};
const subheadStyle: CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  opacity: 0.7,
  margin: '0 0 4px',
  fontFamily: 'Helvetica, Arial, sans-serif',
};

function Slider({
  label, value, min, max, step, onChange, format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}): ReactElement {
  return (
    <label style={{ display: 'grid', gridTemplateColumns: '100px 1fr 48px', alignItems: 'center', gap: 8 }}>
      <span style={ctrlLabelStyle}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%' }}
      />
      <span style={{ ...ctrlLabelStyle, textAlign: 'right' }}>
        {format ? format(value) : value}
      </span>
    </label>
  );
}

function ToggleBar<T extends string>({
  value, options, onChange, labels,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  labels?: readonly string[];
}): ReactElement {
  return (
    <KitToggleBar<T>
      items={options.map((opt, i) => ({ value: opt, label: labels?.[i] ?? opt }))}
      value={value}
      onChange={(v) => { if (v != null) onChange(v); }}
      size="sm"
    />
  );
}

const TOGGLE_ITEMS = [
  { value: 'one', label: 'One' },
  { value: 'two', label: 'Two' },
  { value: 'three', label: 'Three' },
] as const;

const LAB_STORAGE_KEY = 'weasel-ui:ButtonLab:v1';

function loadLabSnapshot(): Partial<LabParams> {
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

function ButtonLabView(): ReactElement {
  const [p, setP] = useState<LabParams>(() => ({ ...LAB_DEFAULTS, ...loadLabSnapshot() }));
  const [toggleValue, setToggleValue] = useState<string>('two');
  const [exportText, setExportText] = useState<string | null>(null);
  // Persist lab state on every change. Cheap — params are small.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(LAB_STORAGE_KEY, JSON.stringify(p));
    } catch { /* quota / private mode */ }
  }, [p]);
  const set = <K extends keyof LabParams>(k: K, v: LabParams[K]) => setP((prev) => ({ ...prev, [k]: v }));
  const style = buttonStyleFromLab(p);
  const reset = () => {
    setP(LAB_DEFAULTS);
    setExportText(null);
    if (typeof window !== 'undefined') {
      try { window.localStorage.removeItem(LAB_STORAGE_KEY); } catch { /* noop */ }
    }
  };

  // Diff the current style against the default style. Only emits CSS custom
  // properties whose resolved value differs from the lab's baseline — the
  // bag you'd paste into `Button.module.css` (or a scoped wrapper) to ship
  // the tuned look as a new default.
  const buildExportDeltas = (): string => {
    const current = buttonStyleFromLab(p) as Record<string, string>;
    const baseline = buttonStyleFromLab(LAB_DEFAULTS) as Record<string, string>;
    const lines: string[] = [];
    const keys = Object.keys(current).sort();
    for (const k of keys) {
      if (!k.startsWith('--')) continue;
      if (current[k] !== baseline[k]) {
        lines.push(`  ${k}: ${current[k]};`);
      }
    }
    if (lines.length === 0) return '/* No deltas — every param matches the lab defaults. */';
    return `.button {\n${lines.join('\n')}\n}`;
  };

  const handleExportDeltas = () => {
    const text = buildExportDeltas();
    setExportText(text);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => { /* noop */ });
    }
  };

  const renderTarget = (extraStyle?: CSSProperties): ReactElement => {
    const combined = { ...(style as CSSProperties), ...extraStyle };
    if (p.target === 'togglebar') {
      return (
        <KitToggleBar
          items={TOGGLE_ITEMS}
          value={toggleValue}
          onChange={(v) => v != null && setToggleValue(v)}
          height={p.height}
          // ToggleBar doesn't accept `style` — the lab vars are applied to a
          // wrapper instead. Pass through via the wrapper around the call site.
          className={undefined}
        />
      );
    }
    return (
      <Button variant={p.variant} style={combined}>
        {p.label}
      </Button>
    );
  };

  // For toggle bar, we need to apply --btn-* vars on a wrapper since
  // ToggleBar doesn't accept a style prop directly.
  const wrapTarget = (extraStyle?: CSSProperties): ReactElement => {
    if (p.target === 'togglebar') {
      return (
        <div style={{ display: 'inline-block', ...(style as CSSProperties), ...extraStyle }}>
          {renderTarget()}
        </div>
      );
    }
    return renderTarget(extraStyle);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(280px, 1fr))', gap: 16, alignItems: 'start' }}>
      {/* Preview cell — cols 1-2, rows 1-2 */}
      <div style={{ gridColumn: '1 / 3', gridRow: '1 / 3', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            minHeight: 220,
            borderRadius: 8,
            overflow: 'hidden',
            ...BACKDROP_STYLE[p.backdrop],
          }}
        >
          <div style={{ transform: `scale(${p.zoom})`, transformOrigin: 'center', display: 'inline-block' }}>
            {wrapTarget()}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 12, background: 'var(--wzl-surface-raised)', borderRadius: 6, flexWrap: 'wrap' }}>
          <span style={ctrlLabelStyle}>states</span>
          {p.target === 'button' ? (
            <>
              <Button variant={p.variant} style={style as never}>{p.label}</Button>
              <Button variant={p.variant} style={{ ...(style as CSSProperties), filter: 'brightness(1.08) saturate(1.06)' }}>{p.label}</Button>
              <Button variant={p.variant} disabled style={style as never}>{p.label}</Button>
            </>
          ) : (
            wrapTarget()
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'center' }}>
          <label style={{ display: 'grid', gridTemplateColumns: '60px 1fr 48px', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabelStyle}>zoom</span>
            <input type="range" min={1} max={6} step={0.1} value={p.zoom} onChange={(e) => set('zoom', Number(e.target.value))} style={{ width: '100%' }} />
            <span style={{ ...ctrlLabelStyle, textAlign: 'right' }}>{p.zoom.toFixed(1)}×</span>
          </label>
          <label style={{ display: 'grid', gridTemplateColumns: '60px 1fr', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabelStyle}>behind</span>
            <ToggleBar<LabParams['backdrop']>
              value={p.backdrop}
              options={['panel', 'glass', 'gradient', 'photo', 'grid'] as const}
              onChange={(v) => set('backdrop', v)}
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-start' }}>
          <button type="button" onClick={reset} style={{ fontSize: 11, padding: '6px 12px', cursor: 'pointer' }}>
            Reset to defaults
          </button>
          <button type="button" onClick={handleExportDeltas} style={{ fontSize: 11, padding: '6px 12px', cursor: 'pointer' }}>
            Export deltas
          </button>
        </div>
        {exportText !== null && (
          <textarea
            readOnly
            value={exportText}
            rows={Math.min(20, exportText.split('\n').length + 1)}
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, padding: 8, width: '100%', boxSizing: 'border-box' }}
          />
        )}
      </div>

      {/* Shape & type — col 3, row 1 */}
      <section style={{ ...sectionStyle, gridColumn: 3, gridRow: 1 }}>
        <h3 style={subheadStyle}>Shape & type</h3>
          <label style={{ display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabelStyle}>component</span>
            <ToggleBar<LabParams['target']>
              value={p.target}
              options={['togglebar', 'button'] as const}
              onChange={(v) => set('target', v)}
            />
          </label>
          <label style={{ display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabelStyle}>variant</span>
            <ToggleBar<ButtonVariant>
              value={p.variant}
              options={['primary', 'secondary', 'ghost'] as const}
              onChange={(v) => set('variant', v)}
            />
          </label>
          <label style={{ display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabelStyle}>weight</span>
            <ToggleBar<'200' | '300' | '400'>
              value={String(p.fontweight) as '200' | '300' | '400'}
              options={['200', '300', '400'] as const}
              onChange={(v) => set('fontweight', Number(v) as 200 | 300 | 400)}
            />
          </label>
          <label style={{ display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabelStyle}>label</span>
            <input type="text" value={p.label} onChange={(e) => set('label', e.target.value)} style={{ fontSize: 11, padding: '2px 4px' }} />
          </label>
          <Slider label="radius" value={p.radius} min={0} max={999} step={1} onChange={(v) => set('radius', v)} format={(v) => v >= 999 ? 'pill' : `${v}px`} />
          <Slider label="height" value={p.height} min={16} max={64} step={1} onChange={(v) => set('height', v)} format={(v) => `${v}px`} />
          <Slider label="pad x" value={p.padx} min={0} max={32} step={1} onChange={(v) => set('padx', v)} format={(v) => `${v}px`} />
        <Slider label="font size" value={p.fontsize} min={10} max={24} step={0.5} onChange={(v) => set('fontsize', v)} format={(v) => `${v}px`} />
      </section>

      {/* Tone — col 3, row 2 */}
      <section style={{ ...sectionStyle, gridColumn: 3, gridRow: 2 }}>
        <h3 style={subheadStyle}>Tone</h3>
          <label style={{ display: 'grid', gridTemplateColumns: '100px 1fr 36px', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabelStyle}>accent</span>
            <input
              type="color"
              value={p.accent}
              onChange={(e) => set('accent', e.target.value)}
              style={{ width: '100%', height: 22, padding: 0, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
            />
            <code style={{ ...ctrlLabelStyle, textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{p.accent}</code>
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(['#2e1f7a', '#1d1454', '#5841b8', '#0a5e7a', '#1f6e3a', '#a8341f', '#a8821f', '#5e1f5a'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set('accent', c)}
                title={c}
                style={{ width: 22, height: 22, padding: 0, border: p.accent === c ? '2px solid white' : '1px solid rgba(255,255,255,0.2)', borderRadius: 4, background: c, cursor: 'pointer' }}
              />
            ))}
          </div>
      </section>

      {/* Glass body — col 1, row 3 */}
      <section style={{ ...sectionStyle, gridColumn: 1, gridRow: 3 }}>
        <h3 style={subheadStyle}>Glass body</h3>
          <Slider label="top α" value={p.topAlpha} min={0} max={100} step={1} onChange={(v) => set('topAlpha', v)} format={(v) => `${v}%`} />
          <Slider label="upper α" value={p.upperAlpha} min={0} max={100} step={1} onChange={(v) => set('upperAlpha', v)} format={(v) => `${v}%`} />
          <Slider label="equator y" value={p.equator} min={15} max={85} step={1} onChange={(v) => set('equator', v)} format={(v) => `${v}%`} />
          <Slider label="equator soft" value={p.equatorSpread} min={1} max={40} step={1} onChange={(v) => set('equatorSpread', v)} format={(v) => `${v}%`} />
          <Slider label="equator tint" value={p.equatorTint} min={50} max={100} step={1} onChange={(v) => set('equatorTint', v)} format={(v) => `${v}%`} />
          <Slider label="base tint" value={p.baseTint} min={20} max={100} step={1} onChange={(v) => set('baseTint', v)} format={(v) => `${v}%`} />
          <Slider label="blur" value={p.blur} min={0} max={20} step={0.5} onChange={(v) => set('blur', v)} format={(v) => `${v}px`} />
          <Slider label="saturate" value={p.saturate} min={0.5} max={2.5} step={0.05} onChange={(v) => set('saturate', v)} format={(v) => v.toFixed(2)} />
        </section>

      {/* Specular gloss — col 2, row 3 */}
      <section style={{ ...sectionStyle, gridColumn: 2, gridRow: 3 }}>
        <h3 style={subheadStyle}>Specular gloss</h3>
          <Slider label="top α" value={p.glossTop} min={0} max={1} step={0.02} onChange={(v) => set('glossTop', v)} format={(v) => v.toFixed(2)} />
          <Slider label="mid α" value={p.glossMid} min={0} max={1} step={0.02} onChange={(v) => set('glossMid', v)} format={(v) => v.toFixed(2)} />
          <Slider label="extent" value={p.glossBottom} min={0} max={90} step={1} onChange={(v) => set('glossBottom', v)} format={(v) => `${100 - v}%`} />
        </section>

      {/* 3D depth — col 3, row 3 */}
      <section style={{ ...sectionStyle, gridColumn: 3, gridRow: 3 }}>
        <h3 style={subheadStyle}>3D depth</h3>
          <Slider label="rim" value={p.rim} min={0} max={0.8} step={0.02} onChange={(v) => set('rim', v)} format={(v) => v.toFixed(2)} />
          <Slider label="drop near" value={p.dropNear} min={0} max={0.8} step={0.02} onChange={(v) => set('dropNear', v)} format={(v) => v.toFixed(2)} />
          <Slider label="drop far" value={p.dropFar} min={0} max={0.8} step={0.02} onChange={(v) => set('dropFar', v)} format={(v) => v.toFixed(2)} />
          <Slider label="inset top" value={p.insetHi} min={0} max={1} step={0.02} onChange={(v) => set('insetHi', v)} format={(v) => v.toFixed(2)} />
          <Slider label="inset bot" value={p.insetLo} min={0} max={1} step={0.02} onChange={(v) => set('insetLo', v)} format={(v) => v.toFixed(2)} />
          <Slider label="text shadow" value={p.textShadow} min={0} max={1} step={0.02} onChange={(v) => set('textShadow', v)} format={(v) => v.toFixed(2)} />
          <Slider label="inset α" value={p.textInset} min={0} max={1} step={0.02} onChange={(v) => set('textInset', v)} format={(v) => v.toFixed(2)} />
          <Slider label="inset angle" value={p.textInsetAngle} min={0} max={360} step={1} onChange={(v) => set('textInsetAngle', v)} format={(v) => `${v}°`} />
        <Slider label="inset dist" value={p.textInsetDist} min={0} max={4} step={0.25} onChange={(v) => set('textInsetDist', v)} format={(v) => `${v}px`} />
      </section>
    </div>
  );
}

export const Lab: Story = {
  parameters: { layout: 'fullscreen', controls: { disable: true } },
  render: () => <div style={{ padding: 16, fontFamily: 'Helvetica, Arial, sans-serif' }}><ButtonLabView /></div>,
};
