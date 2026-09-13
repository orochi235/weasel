import { f, meta, story } from '@weasel-js/forge';

export default meta({ title: 'forge/Counter' });

export const Counter = story({
  config: f.schema({ label: f.string('clicks'), step: f.number(1).range(1, 10).slider() }),
  state: () => ({ n: 0 }),
  render: ({ config, state, setState }) => (
    <button type="button" onClick={() => setState((s) => ({ n: s.n + config.step }))}>
      {config.label}: {state.n}
    </button>
  ),
});
