import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { defineInstrument } from './defineInstrument';
import type { RenderContext } from './types';
import { validateConfigSchema } from './validateConfigSchema';

interface SineState {
  frame: number;
}

interface SineConfig {
  frequency: number;
  amplitude: number;
  showGrid: boolean;
}

const SineWaveInstrument = defineInstrument<SineState, SineConfig>({
  name: 'Sine Wave',
  configSchema: () => [
    {
      key: 'frequency',
      label: 'Frequency',
      type: 'slider',
      min: 0.1,
      max: 10,
      step: 0.1,
      default: 2,
    },
    { key: 'amplitude', label: 'Amplitude', type: 'slider', min: 0.1, max: 1, default: 0.5 },
    { key: 'showGrid', label: 'Show grid', type: 'checkbox', default: true },
  ],
  defaultConfig: () => ({ frequency: 2, amplitude: 0.5, showGrid: true }),
  initialState: () => ({ frame: 0 }),
  render: ({ state }) => <div className="lk-sine-wave">frame: {state.frame}</div>,
  onConfigChange: (_config, _prev, state) => ({ ...state, frame: 0 }),
  serialize: (state) => ({ frame: state.frame }),
  deserialize: (data) => {
    const d = data as { frame?: number };
    return { frame: typeof d.frame === 'number' ? d.frame : 0 };
  },
});

describe('SineWave instrument smoke test', () => {
  it('configSchema validates clean', () => {
    const result = validateConfigSchema(SineWaveInstrument.configSchema?.() ?? []);
    expect(result.valid).toBe(true);
  });

  it('initialState produces { frame: 0 }', () => {
    const s = SineWaveInstrument.initialState(SineWaveInstrument.defaultConfig());
    expect(s).toEqual({ frame: 0 });
  });

  it('onConfigChange resets frame', () => {
    const next = SineWaveInstrument.onConfigChange?.(
      { frequency: 5, amplitude: 0.5, showGrid: true },
      { frequency: 2, amplitude: 0.5, showGrid: true },
      { frame: 3 },
    );
    expect(next).toEqual({ frame: 0 });
  });

  it('serialize round-trips', () => {
    expect(SineWaveInstrument.serialize?.({ frame: 7 })).toEqual({ frame: 7 });
  });

  it('deserialize preserves valid data', () => {
    expect(SineWaveInstrument.deserialize?.({ frame: 7 }, SineWaveInstrument.defaultConfig())).toEqual({
      frame: 7,
    });
  });

  it('deserialize falls back when field missing', () => {
    expect(SineWaveInstrument.deserialize?.({}, SineWaveInstrument.defaultConfig())).toEqual({
      frame: 0,
    });
  });

  it('renders into the DOM', () => {
    const ctx: RenderContext<SineState, SineConfig> = {
      state: { frame: 0 },
      config: SineWaveInstrument.defaultConfig(),
      setState: vi.fn(),
      setConfig: vi.fn(),
      workspace: { id: 'w', zoom: 1, setZoom: vi.fn() },
      emit: vi.fn(),
    };
    const { container } = render(<>{SineWaveInstrument.render(ctx)}</>);
    expect(container.querySelector('.lk-sine-wave')).not.toBeNull();
  });
});
