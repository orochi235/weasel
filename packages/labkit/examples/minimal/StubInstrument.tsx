import type { Instrument } from '@labkit/react';

interface StubState {
  doubled: number;
}

interface StubConfig {
  value: number;
}

export const StubInstrument: Instrument<StubState, StubConfig> = {
  name: 'Stub',
  configSchema: () => [
    { key: 'value', label: 'Value', type: 'slider', min: 0, max: 100, default: 50 },
  ],
  defaultConfig: () => ({ value: 50 }),
  initialState: (config) => ({ doubled: config.value * 2 }),
  render: ({ state }) => <div className="lk-stub-display">doubled: {state.doubled}</div>,
};
