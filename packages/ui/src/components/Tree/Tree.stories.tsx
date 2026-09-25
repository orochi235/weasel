import type { Meta, StoryObj } from '@weasel-js/forge';
import { useMemo, useState } from 'react';
import { Badge } from '../Badge';
import { Input } from '../Input';
import { Tree, filterTree, treeBranchIds, type TreeNode } from './Tree';

const meta: Meta<typeof Tree> = {
  title: 'ui/Tree',
  component: Tree,
};
export default meta;
type Story = StoryObj<typeof Tree>;

const FILES: readonly TreeNode[] = [
  {
    id: 'src',
    label: 'src',
    children: [
      {
        id: 'components',
        label: 'components',
        children: [
          { id: 'Button.tsx', label: 'Button.tsx' },
          { id: 'Tree.tsx', label: 'Tree.tsx' },
          { id: 'Legacy.tsx', label: 'Legacy.tsx', muted: true },
        ],
      },
      { id: 'index.ts', label: 'index.ts' },
    ],
  },
  { id: 'docs', label: 'docs', children: [{ id: 'README.md', label: 'README.md' }] },
  { id: 'empty', label: 'empty', children: [] },
  { id: 'package.json', label: 'package.json' },
  { id: 'locked', label: 'locked.bin', disabled: true },
];

export const Basic: Story = {
  args: {
    'aria-label': 'Files',
    nodes: FILES,
    defaultExpandedIds: ['src'],
  },
};

/** Click, Enter or Space selects. `selectionMode="multiple"` adds Cmd/Ctrl to
 *  toggle a row and Shift to extend over the visible rows between. */
export const Selectable: Story = {
  render: function Render() {
    const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(['Tree.tsx']));
    return (
      <div style={{ width: 240 }}>
        <Tree
          aria-label="Files"
          nodes={FILES}
          defaultExpandedIds={['src', 'components']}
          selectionMode="multiple"
          selectedIds={selected}
          onSelectionChange={setSelected}
        />
        <p>Selected: {[...selected].join(', ') || 'nothing'}</p>
      </div>
    );
  },
};

const REGISTRY: readonly TreeNode[] = [
  ['Actions', ['Delete', 'Duplicate', 'Group', 'Ungroup']],
  ['Gestures', ['click', 'drag', 'wheel']],
  ['Tools', ['Ellipse', 'Pen', 'Rectangle', 'Select']],
].map(([label, leaves]) => ({
  id: label as string,
  label: label as string,
  trailing: <Badge shape="pill" size="sm" status="neutral" variant="solid">{leaves.length}</Badge>,
  children: (leaves as string[]).map((leaf, i) => ({
    id: `${label}/${leaf}`,
    label: leaf,
    trailing: <Badge shape="pill" size="sm" status="neutral" variant="subtle">{(i * 7) % 11}</Badge>,
  })),
}));

/** `trailing` is decoration — a count here. It is read as part of the row's
 *  name, so a screen reader hears "drag 7". */
export const WithCounts: Story = {
  render: () => (
    <div style={{ width: 240 }}>
      <Tree aria-label="Registry" nodes={REGISTRY} defaultExpandedIds={['Gestures']} selectionMode="single" />
    </div>
  ),
};

/** The consumer filters: `filterTree` keeps the matches and their ancestors,
 *  and `treeBranchIds` of the result opens every branch that holds one. With
 *  no filter the tree goes back to the rows the user had open. */
export const Filtered: Story = {
  render: function Render() {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
    const q = query.trim().toLowerCase();
    const nodes = useMemo(
      () => (q ? filterTree(REGISTRY, (n) => !n.children && String(n.label).toLowerCase().includes(q)) : REGISTRY),
      [q],
    );
    return (
      <div style={{ width: 240 }}>
        <Input aria-label="Filter" placeholder="Filter…" value={query} onChange={setQuery} />
        <Tree
          aria-label="Registry"
          nodes={nodes}
          empty="No matches"
          expandedIds={q ? treeBranchIds(nodes) : open}
          onExpandedChange={q ? undefined : setOpen}
        />
      </div>
    );
  },
};

/** Tab in, then: Up/Down between visible rows, Right to open or step in, Left
 *  to close or step out, Home/End, Enter/Space to activate, and type a name's
 *  first letters to jump to it. */
export const Keyboard: Story = {
  render: function Render() {
    const [last, setLast] = useState<string | null>(null);
    return (
      <div style={{ width: 240 }}>
        <Tree aria-label="Files" nodes={FILES} selectionMode="single" onAction={setLast} />
        <p>Last activated: {last ?? 'nothing'}</p>
      </div>
    );
  },
};
