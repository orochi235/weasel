import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState, type ReactNode } from 'react';
import { ActionsProvider, useAction, type Action } from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';
import { Bar } from './Bar';
import type { BarOrientation } from './BarLayout';
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

function TextBar({ orientation }: { orientation?: BarOrientation }) {
  const [values, setValues] = useState<Record<string, unknown>>({ size: 12, align: 'left', color: '#7ec8e3' });
  return (
    <Host>
      {() => (
        <div className={orientation === 'vertical' ? s.rail : s.strip}>
          <Bar
            schema={TEXT}
            label="Text"
            orientation={orientation}
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
export const FieldsAndActions: Story = { render: () => <TextBar /> };

/** Down a side there is no room beside a field, so every leaf but an action
 *  opens from a button. */
export const Vertical: Story = { render: () => <TextBar orientation="vertical" /> };
