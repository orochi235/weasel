import type { Meta, StoryObj } from '@weasel-js/forge';
import type { ColorInterpolationSpace } from '@weasel-js/core';
import { oklchToHex, chromaAt, type ChromaCurve } from './oklch';
import { colorRamp, type ColorRampOptions } from './ramp';

const meta: Meta = {
  title: 'ui/Color/ColorRamp',
};

export default meta;
type Story = StoryObj;

function Strip({ colors, label }: { colors: string[]; label: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: 'system-ui', fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', height: 32, borderRadius: 4, overflow: 'hidden' }}>
        {colors.map((c, i) => (
          <div key={i} style={{ flex: 1, background: c }} />
        ))}
      </div>
    </div>
  );
}

function ramp(make: (t: number) => string, n = 32): string[] {
  return Array.from({ length: n }, (_, i) => make(i / (n - 1)));
}

export const HueRamp: Story = {
  render: () => (
    <Strip
      label="oklchToHex(L=0.7, C=0.18, H=0..360)"
      colors={ramp((t) => oklchToHex(0.7, 0.18, t * 360))}
    />
  ),
};

export const LightnessRamp: Story = {
  render: () => (
    <>
      <Strip
        label="oklchToHex(L=0..1, C=0.12, H=30)"
        colors={ramp((t) => oklchToHex(t, 0.12, 30))}
      />
      <Strip
        label="oklchToHex(L=0..1, C=0.12, H=200)"
        colors={ramp((t) => oklchToHex(t, 0.12, 200))}
      />
      <Strip
        label="oklchToHex(L=0..1, C=0.12, H=320)"
        colors={ramp((t) => oklchToHex(t, 0.12, 320))}
      />
    </>
  ),
};

export const ChromaCurveAlongL: Story = {
  render: () => {
    const curve: ChromaCurve = {
      lRange: [0.2, 0.95],
      midL: 0.65,
      cBot: 0.04,
      cPeak: 0.22,
      cTop: 0.06,
    };
    const samples = 48;
    const hue = 30;
    return (
      <>
        <Strip
          label="L=0..1 with chromaAt(L) — peaks mid-range"
          colors={ramp((t) => oklchToHex(t, chromaAt(t, curve), hue), samples)}
        />
        <div style={{ fontFamily: 'system-ui', fontSize: 12, color: '#666' }}>
          curve = {JSON.stringify(curve)}
        </div>
      </>
    );
  },
};

const SPACES: ColorInterpolationSpace[] = ['oklch', 'oklab', 'hsl', 'srgb', 'srgb-linear'];

function EachSpace({ from, to, options }: { from: string; to: string; options?: ColorRampOptions }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontFamily: 'system-ui', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        {from} → {to}
        {options?.hue ? ` (hue: ${options.hue})` : ''}
        {options?.chroma ? ' with a chroma curve' : ''}
      </div>
      {SPACES.map((space) => (
        <Strip key={space} label={space} colors={colorRamp(from, to, 32, { ...options, space })} />
      ))}
    </div>
  );
}

export const EachInterpolationSpace: Story = {
  render: () => (
    <>
      <EachSpace from="#1d3b8a" to="#f6d743" />
      <EachSpace from="#ff0000" to="#0000ff" />
      <EachSpace from="#ff0000" to="#0000ff" options={{ hue: 'longer' }} />
      <EachSpace from="#e0287a" to="#f08a1c" />
      <EachSpace
        from="#2a1a12"
        to="#fbefe6"
        options={{ chroma: { lRange: [0.2, 0.95], midL: 0.65, cBot: 0.04, cPeak: 0.22, cTop: 0.06 } }}
      />
    </>
  ),
};
