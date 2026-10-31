import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState, type ReactNode } from 'react';
import { ActionsProvider, type Action } from '@weasel-js/core';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { Bar, type BarProps } from '@weasel-js/ui/components/Bar';
import { Along } from '@weasel-js/ui/components/Along';
import { Slider, type Thumb } from '@weasel-js/ui/components/Slider';
import s from './Bar.stories.module.css';
import type { IconRef } from '@weasel-js/icons';
import { icon } from '../../icons.gen';
import { RegisterActions } from '@weasel-js/routing/testing/registerAction';

const meta: Meta<typeof Bar> = {
  title: 'ui/Bar/Bar',
  component: Bar,
};
export default meta;
type Story = StoryObj<typeof Bar>;

const action = (name: string, key: string, glyph?: IconRef): PrefGroup['children'][string] => ({
  kind: 'action',
  name,
  description: '',
  default: undefined,
  action: key,
  ...(glyph ? { icon: glyph } : {}),
});

const TEXT: PrefGroup = {
  name: 'Text',
  as: 'bar',
  children: {
    history: {
      name: 'History',
      as: 'section',
      children: { undo: action('Undo', 'edit.undo', icon('core:undo')), redo: action('Redo', 'edit.redo', icon('core:redo')) },
    },
    size: { kind: 'number', name: 'Size', description: 'Type size.', default: 12, min: 1 },
    style: {
      name: 'Style',
      as: 'section',
      children: {
        bold: {
          kind: 'boolean',
          name: 'Bold',
          icon: icon('core:bold'),
          description: 'Heavier weight.',
          short: ['B'],
          control: 'toggle',
          pair: { with: ['style.italic'], label: 'Style' },
          default: false,
        },
        italic: { kind: 'boolean', name: 'Italic', icon: icon('core:italic'), description: 'Sloped face.', short: ['I'], control: 'toggle', default: false },
      },
    },
    align: {
      kind: 'enum',
      name: 'Align',
      description: 'Where the line sits.',
      default: 'left',
      control: 'toggle',
      options: [
        { value: 'left', label: 'Left', icon: icon('core:textAlignLeft') },
        { value: 'center', label: 'Center', icon: icon('core:textAlignCenter') },
        { value: 'right', label: 'Right', icon: icon('core:textAlignRight') },
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
      <RegisterActions actions={actions} />
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

const ARRANGE_ACTIONS: Action[] = [
  { id: 'arrange.front', label: 'Bring to front', group: 'arrange', icon: icon('core:bringToFront'), invoker: { timing: 'immediate', run: () => {} } },
  { id: 'arrange.back', label: 'Send to back', group: 'arrange', icon: icon('core:sendToBack'), invoker: { timing: 'immediate', run: () => {} } },
  {
    id: 'arrange.flip',
    label: 'Flip',
    group: 'arrange',
    invoker: { timing: 'immediate', run: () => {} },
    variants: [
      { key: 'x', label: 'Flip horizontally', icon: icon('core:flipX'), params: { axis: 'x' } },
      { key: 'y', label: 'Flip vertically', icon: icon('core:flipY'), params: { axis: 'y' } },
    ],
  },
];

const ARRANGE: PrefGroup = pref.group('Arrange', {
  order: pref.actions('arrange'),
  zoom: { ...pref.number('Zoom', 100, { description: 'A readout: the value, with nothing to edit it.' }), readout: true },
  snap: { ...pref.boolean('Snap', true, { control: 'toggle' }), readout: true },
  view: pref.group('View', {
    grid: pref.boolean('Grid', true),
    rulers: pref.boolean('Rulers', false),
    units: pref.enum('Units', 'px', ['px', 'mm', 'in']),
    more: pref.actions('arrange'),
  }, { as: 'menu' }),
}, { as: 'bar' });

function ArrangeBar(args: BarProps) {
  const [values, setValues] = useState<Record<string, unknown>>({ zoom: 150, snap: true, 'view.grid': true, 'view.units': 'px' });
  return (
    <ActionsProvider>
      <RegisterActions actions={ARRANGE_ACTIONS} />
      <div className={args.orientation === 'vertical' ? s.rail : s.strip}>
        <Bar {...args} schema={ARRANGE} values={values} onChange={(path, value) => setValues((v) => ({ ...v, [path]: value }))} />
      </div>
    </ActionsProvider>
  );
}

/** An `actions` leaf draws one button per action registered in its group, a variant each; Zoom and Snap are
 *  `readout` leaves, shown as values; View is a group `as: 'menu'`, which opens as a menu of checked items, radio
 *  rows, and the same actions. */
export const ActionsReadoutsAndMenus: Story = { args: { label: 'Arrange' }, render: (args) => <ArrangeBar {...args} /> };

const NESTED: PrefGroup = pref.group('Shape', {
  width: pref.number('Width', 120),
  more: pref.group('More', {
    gap: pref.number('Gap', 4),
    fill: pref.group('Fill', { opacity: pref.number('Opacity', 1), blend: pref.enum('Blend', 'normal', ['normal', 'multiply', 'screen']) }, { as: 'tab' }),
    edge: pref.group('Edge', { stroke: pref.number('Stroke', 1) }, { as: 'tab' }),
    box: pref.group('Box', { inset: pref.number('Inset', 0), round: pref.boolean('Rounded', false) }, { as: 'panel' }),
    shadow: pref.group('Shadow', {
      on: { ...pref.boolean('Shadow on', true, { control: 'switch' }), heading: true },
      blur: pref.number('Blur', 4),
    }, { as: 'section' }),
    loose: pref.group('', { label: pref.string('Label', 'Box 1') }, { as: 'fragment' }),
  }, { as: 'page' }),
}, { as: 'bar' });

/** A group the bar opens from a button draws its nested groups as a form does: neighboring tabs as one strip, a
 *  panel in a box, a section under its heading, a fragment's rows among the rest. A `heading` leaf stays a row. */
export const OpensNestedGroups: Story = {
  args: { label: 'Shape' },
  render: function NestedStory(args) {
    const [values, setValues] = useState<Record<string, unknown>>({ width: 120 });
    return (
      <div className={s.strip}>
        <Bar {...args} schema={NESTED} values={values} onChange={(path, value) => setValues((v) => ({ ...v, [path]: value }))} />
      </div>
    );
  },
};

const LENS_ACTIONS: Action[] = [
  { id: 'lens.undo', label: 'Undo', icon: icon('core:undo'), invoker: { timing: 'immediate', run: () => {} } },
  { id: 'lens.redo', label: 'Redo', icon: icon('core:redo'), invoker: { timing: 'immediate', run: () => {} } },
  { id: 'lens.flipX', label: 'Flip across', icon: icon('core:flipX'), invoker: { timing: 'immediate', run: () => {} } },
  { id: 'lens.flipY', label: 'Flip down', icon: icon('core:flipY'), invoker: { timing: 'immediate', run: () => {} } },
  { id: 'lens.front', label: 'Bring to front', icon: icon('core:bringToFront'), invoker: { timing: 'immediate', run: () => {} } },
  { id: 'lens.back', label: 'Send to back', icon: icon('core:sendToBack'), invoker: { timing: 'immediate', run: () => {} } },
];
const LENS: PrefGroup = {
  name: 'Lens',
  children: Object.fromEntries(LENS_ACTIONS.map((a) => [a.id.slice('lens.'.length), action(a.label, a.id, a.icon)])),
};
const ZOOM_STOPS = [2, 4, 8, 16].map((v) => ({ value: v, label: `${v}×` }));

function LensStory({ overflow }: Pick<BarProps, 'overflow'>) {
  const [thumbs, setThumbs] = useState<Thumb[]>([{ value: 4 }]);
  return (
    <ActionsProvider>
      <RegisterActions actions={LENS_ACTIONS} />
      <div className={s.lens}>
        <button type="button" className={s.lensImage}>Image</button>
        <Along arc={{ start: 300, end: 60, inset: 18 }}>
          <Bar label="Lens" schema={LENS} overflow={overflow} />
        </Along>
        <Along arc={{ start: 240, end: 120, direction: 'ccw', inset: 16 }}>
          <Slider ariaLabel="Zoom" min={2} max={16} stops={ZOOM_STOPS} spacing="even" snap="strict" thumbs={thumbs} onInput={setThumbs} />
        </Along>
      </div>
    </ActionsProvider>
  );
}

/** Two `Along` wrappers over one lens: a Bar of six actions along its top rim, and the zoom Slider along its
 *  bottom rim. A press in the middle reaches the image beneath. `overflow` switches the bar between scrolling
 *  its run and opening the rest from More. */
export const ActionsAlongALensTop: Story = {
  args: { overflow: 'scroll' },
  render: (args) => <LensStory overflow={args.overflow} />,
};
