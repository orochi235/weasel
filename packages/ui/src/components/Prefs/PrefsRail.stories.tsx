import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefsRail, prefRailItems } from '@weasel-js/ui/components/Prefs';

const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    canvas: {
      name: 'Canvas',
      children: {
        showGrid: { kind: 'boolean', name: 'Show grid', description: '', default: true },
        snapping: {
          name: 'Snapping',
          children: {
            enabled: { kind: 'boolean', name: 'Enabled', description: '', default: true },
            wrap: {
              name: 'Wrapping',
              children: { atEdge: { kind: 'boolean', name: 'Wrap at edge', description: '', default: false } },
            },
          },
        },
      },
    },
    io: {
      name: 'Import / Export',
      children: { author: { kind: 'string', name: 'Author', description: '', default: '' } },
    },
  },
};

const ITEMS = prefRailItems(SCHEMA);

const meta: Meta<typeof PrefsRail> = {
  title: 'ui/Foundations/Prefs/PrefsRail',
  component: PrefsRail,
  args: { foldable: false },
};
export default meta;

type Story = StoryObj<typeof PrefsRail>;

function Live({ foldable }: { foldable?: boolean }) {
  const [section, setSection] = useState(ITEMS[0]?.path ?? '');
  return <PrefsRail items={ITEMS} section={section} onOpen={setSection} ariaLabel="Preference pages" foldable={foldable} />;
}

/** Each page's entry, followed by those of the pages nested in it. The open page's entry is marked current. */
export const Default: Story = {
  render: (args) => <Live foldable={args.foldable} />,
};

/** Nested pages fold away until the open page is the one holding them or one under it. */
export const Foldable: Story = {
  args: { foldable: true },
  render: (args) => <Live foldable={args.foldable} />,
};
