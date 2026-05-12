import type { Meta, StoryObj } from '@storybook/react-vite';
import { oklchToHex, chromaAt, type ChromaCurve } from './oklch';

const meta: Meta = {
  title: 'weasel-ui/color/oklch',
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
