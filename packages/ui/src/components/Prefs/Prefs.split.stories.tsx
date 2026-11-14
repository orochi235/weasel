import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { openPrefsSync, type PrefGroup, type PrefScope } from '@weasel-js/prefs';
import { usePrefsValues } from '@weasel-js/prefs/react';
import { createMemoryAdapter } from '@weasel-js/storage';
import { PrefsForm, type PrefsLayout } from '@weasel-js/ui/components/Prefs';

const MODE = 'look.mode';
const DENSITY = 'look.density';

const SCHEMA = {
  name: 'Theme',
  children: {
    look: {
      name: 'Look',
      children: {
        mode: {
          kind: 'enum', name: 'Mode', description: '', default: 'dark', control: 'toggle',
          options: [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }],
        },
        density: {
          kind: 'enum', name: 'Density', description: '', default: 'compact', control: 'toggle',
          options: [{ value: 'compact', label: 'Compact' }, { value: 'roomy', label: 'Roomy' }],
        },
      },
    },
    panel: {
      name: 'Panel',
      children: {
        gap: { kind: 'number', name: 'Gap', description: 'Between two rows.', default: 4, min: 0, max: 48, scopes: [{ selector: MODE }, { selector: DENSITY }] },
        surface: { kind: 'color', name: 'Surface', description: '', default: '#1d1b26', scopes: [{ selector: MODE }] },
        title: { kind: 'string', name: 'Title', description: '', default: 'Untitled' },
      },
    },
  },
} satisfies PrefGroup;

const byMode = (dark: unknown, light: unknown): PrefScope => ({ $by: MODE, $in: { dark, light } });
const byDensity = (compact: unknown, roomy: unknown): PrefScope => ({ $by: DENSITY, $in: { compact, roomy } });

interface SplitFormProps {
  layout: PrefsLayout;
  /** What the store holds when the story opens, by path: a value, or a scope for a split one. */
  held: Record<string, unknown>;
  /** The split rows open when the story opens. */
  open: string[];
}

/** A form over a store in memory: what `usePrefsValues` returns is what the form takes. */
function SplitForm({ layout, held, open }: SplitFormProps) {
  const [store] = useState(() => openPrefsSync(SCHEMA, { storage: createMemoryAdapter(new Map(Object.entries(held).map(([path, value]) => [`p.${path}`, value]))), prefix: 'p.' }));
  const { values, set, scopes, setAt } = usePrefsValues(store);
  return (
    <PrefsForm layout={layout} schema={SCHEMA} values={values} onChange={set} scopes={scopes}
      onChangeAt={setAt} defaultSplitOpen={open} />
  );
}

const meta: Meta<typeof SplitForm> = {
  title: 'ui/Prefs',
  component: SplitForm,
  args: { layout: 'columns', held: {}, open: [] },
};
export default meta;

type Story = StoryObj<typeof SplitForm>;

/** A scoped pref with nothing stored: the row marks the option each selector is set to, and opens to a control per option. */
export const NotSplit: Story = {};

/** Split by one selector: the row marks the option the selector is set to, and its control edits that member. */
export const SplitByOne: Story = { args: { held: { 'panel.gap': byMode(4, 8) } } };

/** The same row open: a control for each option, each writing its own member. */
export const SplitByOneOpen: Story = { args: { held: { 'panel.gap': byMode(4, 8) }, open: ['panel.gap'] } };

/** Split by two: the first selector's options, each holding the second's. */
export const SplitByTwoOpen: Story = {
  args: { held: { 'panel.gap': byMode(byDensity(4, 8), byDensity(6, 12)) }, open: ['panel.gap'] },
};

/** A color held once per mode. */
export const ColorByMode: Story = {
  args: { held: { 'panel.surface': byMode('#1d1b26', '#f4f1fa') }, open: ['panel.surface'] },
};
