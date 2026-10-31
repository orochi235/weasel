import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import type { PrefMap } from '@weasel-js/prefs';
import { MapEditor } from '@weasel-js/ui/components/Prefs';
import { prefStoryLeaf } from './prefStoryLeaf';

const PREF: PrefMap = {
  kind: 'map',
  name: 'Spacing',
  description: 'Gap per breakpoint.',
  default: {},
  item: { kind: 'number', name: 'Gap', description: '', default: 8, min: 0, max: 64 },
};

const meta: Meta<typeof MapEditor> = {
  title: 'ui/Foundations/Prefs/MapEditor',
  component: MapEditor,
  args: { disabled: false },
};
export default meta;

type Story = StoryObj<typeof MapEditor>;

function Live({ disabled }: { disabled?: boolean }) {
  const [value, setValue] = useState<Record<string, unknown>>({ small: 4, medium: 8, large: 16 });
  return (
    <MapEditor
      disabled={disabled}
      pref={PREF}
      value={value}
      onChange={setValue}
      renderValue={(held, set, name) => prefStoryLeaf(PREF.item, held, set, name, disabled)}
    />
  );
}

/** A key field and the item's control per entry, a remove button beside each, and an add button under them. */
export const Default: Story = {
  render: (args) => <Live disabled={args.disabled} />,
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => <Live disabled={args.disabled} />,
};
