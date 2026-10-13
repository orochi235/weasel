import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState, type ReactNode } from 'react';
import { ActionsProvider, useAction, type Action } from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';
import { Bar, type BarProps } from './Bar';
import s from './Bar.stories.module.css';

const meta: Meta<typeof Bar> = {
  title: 'ui/Bar/Bar',
  component: Bar,
};
export default meta;
type Story = StoryObj<typeof Bar>;

const action = (name: string, key: string, icon?: string): PrefGroup['children'][string] => ({
  kind: 'action',
  name,
  description: '',
  default: undefined,
  action: key,
  ...(icon ? { icon } : {}),
});

const TEXT: PrefGroup = {
  name: 'Text',
  as: 'bar',
  children: {
    history: {
      name: 'History',
      as: 'section',
      children: { undo: action('Undo', 'edit.undo', 'undo'), redo: action('Redo', 'edit.redo', 'redo') },
    },
    size: { kind: 'number', name: 'Size', description: 'Type size.', default: 12, min: 1 },
    style: {
      name: 'Style',
      as: 'section',
      children: {
        bold: {
          kind: 'boolean',
          name: 'Bold',
          description: 'Heavier weight.',
          short: ['B'],
          control: 'toggle',
          pair: { with: ['style.italic'], label: 'Style' },
          default: false,
        },
        italic: { kind: 'boolean', name: 'Italic', description: 'Sloped face.', short: ['I'], control: 'toggle', default: false },
      },
    },
    align: {
      kind: 'enum',
      name: 'Align',
      description: 'Where the line sits.',
      default: 'left',
      control: 'toggle',
      options: [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Center' },
        { value: 'right', label: 'Right' },
      ],
    },
    color: { kind: 'color', name: 'Color', description: 'Text color.', default: '#7ec8e3' },
    spacing: {
      name: 'Spacing',
      as: 'panel',
      children: {
        leading: { kind: 'number', name: 'Leading', description: 'Line spacing.', default: 1.2, step: 0.1 },
        tracking: { kind: 'number', name: 'Tracking', description: 'Letter spacing.', default: 0 },
      },
    },
    snap: action('Snap', 'view.snap'),
  },
};

function Register({ action: a }: { action: Action }) {
  useAction(a);
  return null;
}

function Host({ children }: { children: (snap: boolean) => ReactNode }) {
  const [snap, setSnap] = useState(true);
  const immediate = { timing: 'immediate', run: () => {} } as const;
  const actions: Action[] = [
    { id: 'edit.undo', label: 'Undo', shortcut: '⌘Z', invoker: immediate },
    { id: 'edit.redo', label: 'Redo', shortcut: '⇧⌘Z', invoker: immediate, enabled: () => 'not-applicable' },
    { id: 'view.snap', label: 'Snap', invoker: { timing: 'immediate', run: () => setSnap((v) => !v) }, active: () => snap },
  ];
  return (
    <ActionsProvider>
      {actions.map((a) => (
        <Register key={a.id} action={a} />
      ))}
      {children(snap)}
    </ActionsProvider>
  );
}

function TextBar(args: BarProps) {
  const [values, setValues] = useState<Record<string, unknown>>({ size: 12, align: 'left', color: '#7ec8e3' });
  return (
    <Host>
      {() => (
        <div className={args.orientation === 'vertical' ? s.rail : s.strip}>
          <Bar
            {...args}
            schema={TEXT}
            values={values}
            onChange={(path, value) => setValues((v) => ({ ...v, [path]: value }))}
          />
        </div>
      )}
    </Host>
  );
}

/** Fields and actions on one line. Each section is a run between dividers,
 *  and the panel group opens from a button. */
export const FieldsAndActions: Story = { args: { label: 'Text' }, render: (args) => <TextBar {...args} /> };

/** Down a side there is no room beside a field, so every leaf but an action
 *  opens from a button. */
export const Vertical: Story = { args: { label: 'Text', orientation: 'vertical' }, render: (args) => <TextBar {...args} /> };

const CONDITIONED: PrefGroup = {
  name: 'Text',
  as: 'bar',
  children: {
    snap: { kind: 'boolean', name: 'Snap', description: 'Turns the cells beside it on.', control: 'toggle', default: false },
    step: { kind: 'number', name: 'Step', description: 'Disabled while Snap is off.', default: 8, min: 1, enableIf: { path: 'snap' } },
    angle: { kind: 'number', name: 'Angle', description: 'Drawn only while Snap is on.', default: 45, showIf: { path: 'snap' } },
    guides: {
      name: 'Guides',
      as: 'panel',
      enableIf: { path: 'snap' },
      children: { color: { kind: 'color', name: 'Color', description: 'Guide color.', default: '#7ec8e3' } },
    },
  },
};

/** `enableIf` and `showIf`: with Snap off, Step is disabled, Angle is not drawn, and Guides opens to a disabled row. */
export const Conditions: Story = {
  args: { label: 'Snapping' },
  render: function ConditionsStory(args) {
    const [values, setValues] = useState<Record<string, unknown>>({ snap: false, step: 8, angle: 45 });
    return (
      <div className={s.strip}>
        <Bar {...args} schema={CONDITIONED} values={values} onChange={(path, value) => setValues((v) => ({ ...v, [path]: value }))} />
      </div>
    );
  },
};

const DIALOG: PrefGroup = {
  name: 'Preferences',
  children: {
    view: {
      name: 'View',
      children: {
        grid: { kind: 'boolean', name: 'Grid', description: 'Draws the grid.', control: 'toggle', default: true },
        spacing: { kind: 'number', name: 'Spacing', description: 'Disabled while Grid is off.', default: 8, min: 1, enableIf: { path: 'view.grid' } },
      },
    },
  },
};
const alias = (of: string): PrefGroup['children'][string] => ({ kind: 'alias', name: '', description: '', default: undefined, of });
const SHORTCUTS: PrefGroup = { name: 'View', as: 'bar', children: { grid: alias('view.grid'), spacing: alias('view.spacing') } };

/** `over`: a bar of aliases into another schema, the one a preferences dialog is drawn from. Each cell is that
 *  schema's leaf, reads and writes its path, and follows its conditions: Spacing is disabled while Grid is off. */
export const AliasesIntoAnotherSchema: Story = {
  args: { label: 'View' },
  render: function OverStory(args) {
    const [values, setValues] = useState<Record<string, unknown>>({ 'view.grid': true, 'view.spacing': 8 });
    return (
      <div className={s.strip}>
        <Bar {...args} schema={SHORTCUTS} over={DIALOG} values={values} onChange={(path, value) => setValues((v) => ({ ...v, [path]: value }))} />
      </div>
    );
  },
};
