import { defineInstrument } from '@labkit/react';

interface StubState {
  doubled: number;
}

interface StubConfig {
  value: number;
  showHint: boolean;
  label: string;
}

export const StubInstrument = defineInstrument<StubState, StubConfig>({
  name: 'Stub',
  configSchema: () => [
    { key: 'value', label: 'Value', type: 'slider', min: 0, max: 100, step: 1, default: 50 },
    { key: 'showHint', label: 'Show hint', type: 'checkbox', default: true },
    { key: 'label', label: 'Label', type: 'text', default: 'doubled' },
  ],
  defaultConfig: () => ({ value: 50, showHint: true, label: 'doubled' }),
  initialState: (config) => ({ doubled: config.value * 2 }),
  onConfigChange: (config) => ({ doubled: config.value * 2 }),
  render: ({ state, config }) => (
    <div className="lk-stub-display">
      <strong>
        {config.label}: {state.doubled}
      </strong>
      {config.showHint ? (
        <p>
          Slide <em>Value</em> in the sidebar — state recomputes via <code>onConfigChange</code>.
        </p>
      ) : null}
    </div>
  ),
});
