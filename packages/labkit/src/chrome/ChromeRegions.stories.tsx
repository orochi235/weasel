import type { Meta, StoryObj } from '@storybook/react-vite';
import { CrosshairIcon, HandIcon, PencilIcon } from '@weasel-js/ui';
import type { ConfigField } from '../controls/types';
import type { Instrument } from '../instrument/types';
import { Lab } from '../lab/Lab';

interface DemoConfig extends Record<string, unknown> {
  radius: number;
  filled: boolean;
}

interface DemoState extends Record<string, unknown> {
  spokes: number;
}

const fields: ConfigField[] = [
  { key: 'radius', label: 'Radius', type: 'slider', default: 60, min: 10, max: 120, step: 1 },
  { key: 'filled', label: 'Filled', type: 'checkbox', default: true },
];

/** Declares every capability that contributes chrome, so all five trial
 *  regions render at once. */
const FullInstrument: Instrument<DemoState, DemoConfig> = {
  name: 'Every Region',
  defaultConfig: () => ({ radius: 60, filled: true }),
  initialState: () => ({ spokes: 7 }),
  configSchema: () => fields,
  undo: {},
  layers: { ids: ['wheel'] },
  tools: {
    tools: [
      { id: 'draw', label: 'Draw', icon: PencilIcon, shortcut: 'D' },
      { id: 'pan', label: 'Pan', icon: HandIcon, shortcut: 'H' },
      { id: 'measure', label: 'Measure', icon: CrosshairIcon, shortcut: 'M' },
    ],
  },
  canvas: {
    layers: [
      {
        id: 'wheel',
        draw: (ctx, { state, config }) => {
          ctx.strokeStyle = '#8ab';
          ctx.fillStyle = 'rgba(136, 170, 187, 0.25)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(160, 120, config.radius, 0, Math.PI * 2);
          if (config.filled) ctx.fill();
          ctx.stroke();
          for (let i = 0; i < state.spokes; i++) {
            const a = (i / state.spokes) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(160, 120);
            ctx.lineTo(160 + Math.cos(a) * config.radius, 120 + Math.sin(a) * config.radius);
            ctx.stroke();
          }
        },
      },
    ],
  },
  render: ({ trial }) => (
    <div className="lk-region-demo-readout">tool: {trial.activeToolId ?? 'none'}</div>
  ),
};

const meta: Meta<typeof Lab> = {
  title: 'labkit/Chrome/Regions',
  component: Lab,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof Lab>;

export const EveryRegion: Story = {
  args: {
    instruments: [FullInstrument],
    defaultInstrument: 'Every Region',
    title: 'Chrome Regions',
    storage: null,
  },
};

/** A consumer dropping a built-in and adding its own in its place. */
export const SuppressedAndReplaced: Story = {
  args: {
    instruments: [FullInstrument],
    defaultInstrument: 'Every Region',
    title: 'Suppress + Replace',
    storage: null,
    suppress: ['snapshot'],
    chrome: [
      {
        id: 'export',
        region: 'toolbar',
        group: 'trial',
        end: true,
        item: {
          icon: CrosshairIcon,
          label: 'Export',
          showLabel: true,
          onActivate: () => {},
        },
      },
    ],
  },
};
