import { f } from '@weasel-js/labkit/config';
import { story } from './define';

export const Grouped = story({
  config: f.schema({
    label: f.string('clicks'),
    grid: f.group({ on: f.boolean(true), mode: f.enum('a', ['a', 'b']) }).label('Grid'),
  }),
  state: () => ({ n: 0 }),
  render: ({ config, state }) => `${config.label}${config.grid.on}${config.grid.mode}${state.n}`,
});
