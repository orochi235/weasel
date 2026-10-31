import type { Meta, StoryObj } from '@weasel-js/forge';
import { Fragment, useState } from 'react';
import { isPrefLeaf, type PrefUnion } from '@weasel-js/prefs';
import { UnionPicker } from '@weasel-js/ui/components/Prefs';
import { prefStoryLeaf } from './prefStoryLeaf';

const PREF: PrefUnion = {
  kind: 'union',
  name: 'Camera',
  description: '',
  default: { type: 'perspective', fov: 50 },
  tag: 'type',
  variants: {
    perspective: {
      kind: 'object',
      name: 'Perspective',
      description: '',
      default: undefined,
      children: { fov: { kind: 'number', name: 'Field of view', description: '', default: 50, min: 10, max: 120 } },
    },
    orthographic: {
      kind: 'object',
      name: 'Orthographic',
      description: '',
      default: undefined,
      children: { zoom: { kind: 'number', name: 'Zoom', description: '', default: 1, min: 0.1, max: 10, step: 0.1 } },
    },
  },
};

const meta: Meta<typeof UnionPicker> = {
  title: 'ui/Foundations/Prefs/UnionPicker',
  component: UnionPicker,
  args: { mixed: false, disabled: false },
};
export default meta;

type Story = StoryObj<typeof UnionPicker>;

function Live({ mixed, disabled }: { mixed?: boolean; disabled?: boolean }) {
  const [value, setValue] = useState<Record<string, unknown>>({ type: 'perspective', fov: 50 });
  return (
    <UnionPicker pref={PREF} value={value} mixed={mixed} disabled={disabled} onChange={setValue}>
      {(variant) => Object.entries(variant.children).map(([key, leaf]) =>
        isPrefLeaf(leaf) && (
          <Fragment key={key}>
            {prefStoryLeaf(leaf, value[key], (next) => setValue({ ...value, [key]: next }), leaf.name, disabled)}
          </Fragment>
        ))}
    </UnionPicker>
  );
}

/** A select of the variants over the fields of the one chosen. Choosing another starts it from its default. */
export const Default: Story = {
  render: (args) => <Live mixed={args.mixed} disabled={args.disabled} />,
};

/** Values whose variants differ: nothing is chosen, and no fields are drawn. */
export const Mixed: Story = {
  args: { mixed: true },
  render: (args) => <Live mixed={args.mixed} disabled={args.disabled} />,
};
