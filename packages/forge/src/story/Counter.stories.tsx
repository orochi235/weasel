import { f, meta, story } from '@weasel-js/forge';

/** A story with a config and state of its own: forge keeps both in the trial's record, so a relaunch restores them. */
export default meta({ title: 'forge/Counter' });

export const Counter = story({
  config: f.schema({ label: f.string('clicks'), step: f.number(1).range(1, 10).slider() }),
  initialState: () => ({ n: 0 }),
  render: ({ config, state, setState }) => (
    <button type="button" onClick={() => setState((s) => ({ n: s.n + config.step }))}>
      {config.label}: {state.n}
    </button>
  ),
});
