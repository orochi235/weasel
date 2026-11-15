import type { Meta, StoryObj } from '@weasel-js/forge';
import { useRef, useState } from 'react';
import { openPrefsSync, type PrefGroup } from '@weasel-js/prefs';
import { usePrefsValues } from '@weasel-js/prefs/react';
import { createMemoryAdapter } from '@weasel-js/storage';
import { PrefsPane } from '@weasel-js/ui/components/Prefs';
import { useValuesSource } from '@weasel-js/ui/components/PrefsSource';

const PAGE: PrefGroup = {
  name: 'Canvas',
  description: 'How the workspace draws.',
  children: {
    showGrid: { kind: 'boolean', name: 'Show grid', description: 'Alignment grid.', default: true },
    gridSize: { kind: 'number', name: 'Grid size', description: 'In world units.', default: 16, min: 2, max: 128 },
    snapping: {
      name: 'Snapping',
      children: {
        toGrid: { kind: 'boolean', name: 'To grid', description: '', default: true },
        toShapes: { kind: 'boolean', name: 'To shapes', description: '', default: false },
      },
    },
    look: {
      name: 'Look',
      children: {
        lines: { name: 'Lines', as: 'tab', children: { dashed: { kind: 'boolean', name: 'Dashed', description: '', default: false } } },
        dots: { name: 'Dots', as: 'tab', children: { size: { kind: 'number', name: 'Dot size', description: '', default: 2, min: 1, max: 8 } } },
      },
    },
  },
};

const meta: Meta<typeof PrefsPane> = {
  title: 'ui/Prefs/PrefsPane',
  component: PrefsPane,
};
export default meta;

type Story = StoryObj<typeof PrefsPane>;

/** One rail page: its heading and description, its leaves, a nested group as a section, and sibling `tab` groups as one strip. */
export const Default: Story = {
  render: (args) => {
    const [store] = useState(() => openPrefsSync(PAGE, { storage: createMemoryAdapter(), prefix: 'story.' }));
    const { values, set: onChange } = usePrefsValues(store);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const source = useValuesSource(PAGE, values, onChange);
    return (
      <PrefsPane
        className={args.className}
        ctx={{ source, values, onChange }}
        group={PAGE}
        path=""
        scrollRef={scrollRef}
      />
    );
  },
};
