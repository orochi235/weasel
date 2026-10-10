import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { expect, userEvent, within } from '@weasel-js/forge/play';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { PrefControl } from './PrefControl';
import { PrefsForm } from './PrefsForm';

const meta: Meta<typeof PrefsForm> = {
  title: 'Primitives/Prefs/Compound kinds',
  component: PrefsForm,
};
export default meta;

type Story = StoryObj<typeof PrefsForm>;

const DEFAULT_PHASES = [0.5, 2, 0.25];

function CompoundKindsStory() {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const schema: PrefGroup = {
    name: 'Timing',
    children: {
      phases: {
        kind: 'list',
        name: 'Phases',
        description: 'Seconds each phase holds. At least one.',
        default: DEFAULT_PHASES,
        item: { kind: 'number', name: 'Phase', description: '', default: 1, min: 0, step: 0.25 },
        minItems: 1,
      },
      ignore: {
        kind: 'list',
        name: 'Ignore',
        description: 'Globs left out. Enter adds one, Backspace in an empty one removes it.',
        default: ['*.tmp'],
        item: { kind: 'string', name: 'Glob', description: '', default: '' },
      },
      stops: {
        kind: 'list',
        name: 'Stops',
        description: 'A list of objects: each entry is the rows of its item.',
        default: [
          { at: 0, color: '#1d4ed8' },
          { at: 1, color: '#f59e0b' },
        ],
        item: {
          kind: 'object',
          name: 'Stop',
          description: '',
          default: { at: 0.5, color: '#888888' },
          children: {
            at: { kind: 'number', name: 'At', description: '', default: 0.5, min: 0, max: 1, step: 0.05 },
            color: { kind: 'color', name: 'Color', description: '', default: '#888888' },
          },
        },
      },
      limits: {
        kind: 'map',
        name: 'Limits',
        description: 'A map: a cap per host, keyed by whatever is typed.',
        default: { studio: 8, laptop: 2 },
        item: { kind: 'number', name: 'Limit', description: '', default: 4, min: 0 },
      },
      ramp: {
        kind: 'union',
        name: 'Ramp',
        description: 'A union: the fields follow the variant chosen.',
        tag: 'type',
        default: { type: 'linear', angle: 90 },
        variants: {
          linear: {
            kind: 'object',
            name: 'Linear',
            description: '',
            default: { angle: 90 },
            children: { angle: { kind: 'number', name: 'Angle', description: '', default: 90, min: 0, max: 360 } },
          },
          radial: {
            kind: 'object',
            name: 'Radial',
            description: '',
            default: { radius: 1 },
            children: { radius: { kind: 'number', name: 'Radius', description: '', default: 1, min: 0 } },
          },
        },
      },
      reset: {
        kind: 'action',
        name: 'Timing defaults',
        description: 'Put every value here back to its default.',
        default: undefined,
        label: 'Reset',
        run: () => setValues({}),
      },
    },
  };
  return (
    <PrefsForm
      schema={schema}
      values={values}
      onChange={(path, value) => setValues((prev) => ({ ...prev, [path]: value }))}
    />
  );
}

export const CompoundKinds: Story = {
  render: () => <CompoundKindsStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Phase 3' }));
    await expect(canvas.queryByRole('button', { name: 'Remove Phase 3' })).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await expect(canvas.queryByRole('button', { name: 'Remove Phase 3' })).not.toBeNull();
  },
};

const STOP: PrefLeaf = {
  kind: 'object',
  name: 'Stop',
  description: '',
  default: { at: 0.5, color: '#1d4ed8' },
  children: {
    at: { kind: 'number', name: 'At', description: '', default: 0.5, min: 0, max: 1, step: 0.05 },
    color: { kind: 'color', name: 'Color', description: '', default: '#888888' },
  },
};

function BareControlStory() {
  const [value, setValue] = useState<unknown>(undefined);
  return <PrefControl pref={STOP} value={value} onChange={setValue} />;
}

/** `PrefControl`: one leaf's control with no row around it, for a surface that lays out its own. */
export const BareControl: Story = {
  render: () => <BareControlStory />,
};
