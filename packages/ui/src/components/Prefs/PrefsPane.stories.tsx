import type { Meta, StoryObj } from '@weasel-js/forge';
import { useRef, useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefsPane } from '@weasel-js/ui/components/Prefs';

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

/** `values` with `value` written at the dotted `path`. */
function withValueAt(values: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const next = structuredClone(values);
  const parts = path.split('.');
  let at = next;
  for (const part of parts.slice(0, -1)) at = (at[part] ??= {}) as Record<string, unknown>;
  at[parts.at(-1)!] = value;
  return next;
}

const meta: Meta<typeof PrefsPane> = {
  title: 'ui/Foundations/Prefs/PrefsPane',
  component: PrefsPane,
};
export default meta;

type Story = StoryObj<typeof PrefsPane>;

/** One rail page: its heading and description, its leaves, a nested group as a section, and sibling `tab` groups as one strip. */
export const Default: Story = {
  render: (args) => {
    const [values, setValues] = useState<Record<string, unknown>>({});
    const scrollRef = useRef<HTMLDivElement | null>(null);
    return (
      <PrefsPane
        className={args.className}
        ctx={{ values, onChange: (path, value) => setValues((prev) => withValueAt(prev, path, value)) }}
        group={PAGE}
        path=""
        scrollRef={scrollRef}
      />
    );
  },
};
