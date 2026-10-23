import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { expect, userEvent, within } from '@weasel-js/forge/play';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { PrefControl, PrefsForm, type PrefsFormProps } from '@weasel-js/ui/components/Prefs';

const meta: Meta<typeof PrefsForm> = {
  title: 'Primitives/Prefs',
  component: PrefsForm,
};
export default meta;

type Story = StoryObj<typeof PrefsForm>;

const DEFAULT_PHASES = [0.5, 2, 0.25];

function CompoundKindsStory(args: Partial<PrefsFormProps>) {
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
      {...args}
      schema={schema}
      values={values}
      onChange={(path, value) => setValues((prev) => ({ ...prev, [path]: value }))}
    />
  );
}

export const CompoundKinds: Story = {
  render: (args) => <CompoundKindsStory {...args} />,
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

const SEVERAL: PrefGroup = {
  name: 'Several marks',
  children: {
    stroke: {
      kind: 'object',
      name: 'Stroke',
      description: '',
      default: { width: 1, color: '#1d4ed8' },
      children: {
        width: { kind: 'number', name: 'Width', description: '', default: 1, min: 0 },
        color: { kind: 'color', name: 'Color', description: '', default: '#888888' },
      },
    },
    dash: { kind: 'list', name: 'Dash', description: '', default: [], item: { kind: 'number', name: 'Length', description: '', default: 1 } },
    tags: { kind: 'map', name: 'Tags', description: '', default: {}, item: { kind: 'string', name: 'Tag', description: '', default: '' } },
    end: {
      kind: 'union',
      name: 'End',
      description: '',
      tag: 'type',
      default: { type: 'arrow', size: 4 },
      variants: {
        arrow: { kind: 'object', name: 'Arrow', description: '', default: { size: 4 }, children: { size: { kind: 'number', name: 'Size', description: '', default: 4 } } },
        dot: { kind: 'object', name: 'Dot', description: '', default: { radius: 2 }, children: { radius: { kind: 'number', name: 'Radius', description: '', default: 2 } } },
      },
    },
  },
};

const DIFFER: ReadonlySet<string> = new Set(['stroke.width', 'dash', 'tags', 'end']);

function MixedStory(args: Partial<PrefsFormProps>) {
  const [last, setLast] = useState('');
  return (
    <>
      <PrefsForm layout="list" {...args} schema={SEVERAL} mixed={DIFFER} values={{ stroke: { width: 1, color: '#1d4ed8' } }}
        onChange={(path, value) => setLast(`${path} = ${JSON.stringify(value)}`)} />
      <output>{last}</output>
    </>
  );
}

/**
 * A form standing for several values that disagree. `mixed` names a field inside an object leaf, and while it does
 * each of that object's fields is written at its own path. A list or a map draws the word `Mixed`, and a union
 * draws its choice as mixed with no variant's fields.
 */
export const Mixed: Story = {
  render: (args) => <MixedStory {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('Mixed').length).toBeGreaterThanOrEqual(2);
    await expect(canvas.queryByRole('button', { name: 'Add' })).toBeNull();
  },
};
