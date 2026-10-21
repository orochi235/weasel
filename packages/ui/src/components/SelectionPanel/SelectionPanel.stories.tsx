import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import {
  asNodeId,
  createScene,
  defaultNodeProperties,
  inferredNodeProperties,
  inferredNodeRouting,
  gradientForBounds,
  solid,
  strokeOf,
  type NodePropertiesEntry,
  type NodeRoutingEntry,
  type RectPose,
} from '@weasel-js/core';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { SelectionPanel, type SelectionPanelProps } from '@weasel-js/ui/components/SelectionPanel';
import s from './SelectionPanel.stories.module.css';

interface Data {
  path?: unknown;
  text?: string;
  style?: unknown;
  fill?: unknown;
  stroke?: unknown;
}

const POSE: RectPose = { x: 40, y: 24, width: 220, height: 140 };

function sceneWith(data: Data) {
  const scene = createScene<Data, 'default', RectPose>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('n'), kind: 'leaf', layer: 'default', pose: POSE, data });
  return scene;
}

const selection = { current: [asNodeId('n')] };

type Marks = Pick<SelectionPanelProps<Data, 'default', RectPose>, 'selected' | 'onSelect'>;

function Panel({ data, selected, onSelect }: { data: Data } & Marks) {
  // One scene per story, so an edit outlasts the render a pressed row causes.
  const scene = useMemo(() => sceneWith(data), [data]);
  return (
    <div style={{ inlineSize: 260 }}>
      <SelectionPanel
        scene={scene}
        selection={selection}
        properties={[...defaultNodeProperties, ...inferredNodeProperties]}
        routing={inferredNodeRouting}
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  );
}

const meta: Meta<typeof Panel> = {
  title: 'ui/SelectionPanel',
  component: Panel,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<typeof Panel>;

/** A path node: pose, fill, and the stroke's fields under one block. */
export const Shape: Story = {
  args: {
    data: {
      path: { kind: 'rect', x: 40, y: 24, width: 220, height: 140 },
      fill: { paint: solid('#7fb069') },
      stroke: { ...strokeOf('#1c1c1c', 6), cap: 'round', join: 'bevel' },
    },
  },
};

/** A stroke carrying a dash array that matches no preset — what an SVG import
 *  produces. Style reports it as Custom, which it does not offer to author. */
export const ImportedDash: Story = {
  args: {
    data: {
      path: { kind: 'rect', x: 40, y: 24, width: 220, height: 140 },
      fill: { paint: solid('#7fb069') },
      stroke: { ...strokeOf('#1c1c1c', 6), dash: [9, 2, 2, 2] },
    },
  },
};

/** A text node: the same appearance block, plus the style leaf's Character and
 *  Paragraph groups. */
export const Text: Story = {
  args: {
    data: {
      text: 'The quick brown fox',
      fill: { paint: solid('#1c1c1c') },
      style: { fontSize: 18, fontFamily: 'sans-serif', fontWeight: 500, align: 'center', lineHeight: 1.4 },
    },
  },
};

const UNIT_BOX = { x: 0, y: 0, width: 1, height: 1 };
const RAMP = [
  { offset: 0, color: '#7fb069ff' },
  { offset: 1, color: '#1c1c1cff' },
];

/** A gradient fill, which the paint leaf now previews and edits in place
 *  rather than degrading to the indeterminate chip. */
export const GradientFillPaint: Story = {
  args: {
    data: {
      path: { kind: 'rect', x: 40, y: 24, width: 220, height: 140 },
      fill: { paint: gradientForBounds('linear-gradient', UNIT_BOX, RAMP, 'bounds') },
      stroke: strokeOf('#1c1c1c', 4),
    },
  },
};

/** A gradient on the stroke too — the same leaf, so both paints get the same
 *  editor. FILL and STROKE read as peer sections. */
export const GradientStrokePaint: Story = {
  args: {
    data: {
      path: { kind: 'rect', x: 40, y: 24, width: 220, height: 140 },
      fill: { paint: solid('#7fb069') },
      stroke: {
        ...strokeOf('#1c1c1c', 6),
        paint: gradientForBounds('radial-gradient', UNIT_BOX, RAMP, 'bounds'),
      },
    },
  },
};

/** A pattern fill: the tile grid and size switch, promoted into the kit. */
export const PatternFillPaint: Story = {
  args: {
    data: {
      path: { kind: 'rect', x: 40, y: 24, width: 220, height: 140 },
      fill: { paint: { kind: 'crosshatch', color: '#7fb069ff', size: 8, units: 'bounds' } },
      stroke: strokeOf('#1c1c1c', 4),
    },
  },
};

/** What `selected` marks: the Position row, which `pose.y` shares with `pose.x`, and the Appearance section,
 *  named by its own key. A press on a row or on a section's heading selects it, and Cmd or Ctrl on a press adds
 *  it or takes it out. */
export const SelectedRows: Story = {
  args: Shape.args,
  render: function SelectedRowsStory(args) {
    const [selected, setSelected] = useState<readonly string[]>(['pose.y', 'appearance']);
    return (
      <Panel
        {...args}
        selected={selected}
        onSelect={(path, how) => setSelected((cur) =>
          !how.toggle ? [path] : cur.includes(path) ? cur.filter((p) => p !== path) : [...cur, path])}
      />
    );
  },
};

const field = (name: string, kind: 'string' | 'number' = 'number'): PrefLeaf =>
  ({ kind, name, description: '', default: kind === 'number' ? 0 : '' }) as PrefLeaf;

const SECTIONED: PrefSection = {
  name: 'Card',
  members: {
    'data.title': field('Title', 'string'),
    size: { name: 'Size', as: 'tab', members: { 'pose.width': field('Width'), 'pose.height': field('Height') } },
    place: { name: 'Place', as: 'tab', members: { 'pose.x': field('X'), 'pose.y': field('Y') } },
    edge: { name: 'Edge', as: 'panel', members: { 'data.radius': field('Radius'), 'data.inset': field('Inset') } },
    notes: { name: 'Notes', members: { 'data.note': field('Note', 'string') } },
  },
};
const SECTIONED_PROPERTIES: NodePropertiesEntry[] = [{ name: 'card', schema: SECTIONED }];
const SECTIONED_ROUTING: NodeRoutingEntry[] = [{ name: 'card', matches: () => true }];

/** A schema's sections each drawn their own way: neighboring `as: 'tab'` sections as one strip of tabs, an
 *  `as: 'panel'` section in a box, and a plain section under its heading. */
export const Sections: Story = {
  render: () => (
    <div style={{ inlineSize: 260 }}>
      <SelectionPanel
        scene={sceneWith({ text: '' })}
        selection={selection}
        properties={SECTIONED_PROPERTIES}
        routing={SECTIONED_ROUTING}
      />
    </div>
  ),
};

const CONDITIONED: PrefSection = {
  name: 'Card',
  members: {
    'data.locked': { kind: 'boolean', name: 'Locked', description: 'Disables the rows below.', default: false } as PrefLeaf,
    'data.title': { ...field('Title', 'string'), enableIf: { path: 'data.locked', is: false } },
    'data.rounded': { kind: 'boolean', name: 'Rounded', description: 'Shows the radius.', default: false, enableIf: { path: 'data.locked', is: false } } as PrefLeaf,
    'data.radius': { ...field('Radius'), showIf: { path: 'data.rounded' }, enableIf: { path: 'data.locked', is: false } },
    edge: {
      name: 'Edge',
      as: 'panel',
      enableIf: { path: 'data.locked', is: false },
      members: { 'data.inset': field('Inset'), 'data.weight': field('Weight') },
    },
  },
};
const CONDITIONED_PROPERTIES: NodePropertiesEntry[] = [{ name: 'card', schema: CONDITIONED }];

/** `enableIf` and `showIf`: Locked disables every row under it, and Radius is drawn only while Rounded is on. */
export const Conditions: Story = {
  render: function ConditionsStory() {
    const scene = useMemo(() => sceneWith({ text: '', locked: true, title: 'Card', rounded: false } as Data), []);
    return (
      <div className={s.narrow}>
        <SelectionPanel scene={scene} selection={selection} properties={CONDITIONED_PROPERTIES} routing={SECTIONED_ROUTING} />
      </div>
    );
  },
};

const HEADED: PrefSection = {
  name: 'Card',
  members: {
    'data.title': field('Title', 'string'),
    shadow: {
      name: 'Shadow',
      members: {
        'data.shadow': { kind: 'boolean', name: 'Shadow', description: '', default: false, control: 'switch', heading: true } as PrefLeaf,
        'data.blur': { ...field('Blur'), enableIf: { path: 'data.shadow' } },
      },
    },
  },
};
const HEADED_PROPERTIES: NodePropertiesEntry[] = [{ name: 'card', schema: HEADED }];

/** A leaf marked `heading` is drawn in the title row of the section holding it, and has no row beneath. */
export const HeadingControl: Story = {
  render: function HeadingStory() {
    const scene = useMemo(() => sceneWith({ text: '', title: 'Card', shadow: false } as Data), []);
    return (
      <div className={s.narrow}>
        <SelectionPanel scene={scene} selection={selection} properties={HEADED_PROPERTIES} routing={SECTIONED_ROUTING} />
      </div>
    );
  },
};

const CARD: PrefSection = {
  name: 'Card',
  members: {
    'data.rounded': { kind: 'boolean', name: 'Rounded', description: 'Enables the radius.', default: false } as PrefLeaf,
    'data.radius': { ...field('Radius'), enableIf: { path: 'data.rounded' } },
    'data.title': field('Title', 'string'),
  },
};
const pointer = (of: string): PrefLeaf => ({ kind: 'alias', name: '', description: '', default: undefined, of });
const CORNERS: PrefSection = {
  name: 'Card',
  members: { corners: { name: 'Corners', members: { 'layout.rounded': pointer('data.rounded'), 'layout.radius': pointer('data.radius') } } },
};
const CORNERS_PROPERTIES: NodePropertiesEntry[] = [{ name: 'card', schema: CORNERS }];

/** `over`: a panel drawn from a layout of aliases into another schema, the one that holds the kind's settings.
 *  Each row is that schema's leaf, reads and writes its path on the node, and follows its conditions: Radius is
 *  disabled while Rounded is off. */
export const AliasesIntoAnotherSchema: Story = {
  render: function OverStory() {
    const scene = useMemo(() => sceneWith({ text: '', rounded: true, radius: 6 } as Data), []);
    return (
      <div className={s.narrow}>
        <SelectionPanel scene={scene} selection={selection} properties={CORNERS_PROPERTIES} routing={SECTIONED_ROUTING} over={CARD} />
      </div>
    );
  },
};
