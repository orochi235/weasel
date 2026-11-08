import { useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { cssColorLiteral } from '@weasel-js/paint';
import { PropertyControl } from '@weasel-js/ui/components/Properties';
import s from './StackList.stories.module.css';
import { StackList, type StackKind, type StackListItem, type StackListProps } from '@weasel-js/ui/components/StackList';

const meta: Meta<typeof StackList> = {
  title: 'ui/StackList',
  component: StackList,
};
export default meta;

type Story = StoryObj<typeof StackList>;

interface Stage extends StackListItem {
  strength: number;
}

const KINDS: Record<string, StackKind> = {
  match: { label: 'Match', color: cssColorLiteral('#7fd0ff') },
  unify: { label: 'Unify', color: cssColorLiteral('#ff9a5c') },
  weld: { label: 'Weld', color: cssColorLiteral('#8fe07a') },
};

const START: Stage[] = [
  { id: 's1', kind: 'match', name: 'Serifs', on: true, strength: 40 },
  { id: 's2', kind: 'unify', name: 'Bowls', on: true, strength: 70 },
  { id: 's3', kind: 'weld', name: 'Joins', on: false, strength: 25 },
  { id: 's4', kind: 'match', name: 'Terminals', on: true, strength: 55 },
];

let minted = 0;

function Stages({ args }: { args: Story['args'] }): ReactElement {
  const [items, setItems] = useState(START);
  const [selected, setSelected] = useState<string | null>('s2');
  return (
    <div className={s.frame}>
      <StackList<Stage>
        {...(args as Partial<StackListProps<Stage>>)}
        ariaLabel="Stages"
        items={items}
        kinds={KINDS}
        onChange={setItems}
        selected={selected}
        onSelect={setSelected}
        onDuplicate={(st) => ({ ...st, id: `copy-${++minted}`, name: `${st.name} copy` })}
        renderBody={(st) => (
          <PropertyControl
            kind="number"
            name="Strength"
            value={st.strength}
            onChange={(strength) => setItems((list) => list.map((x) => (x.id === st.id ? { ...x, strength } : x)))}
          />
        )}
      />
    </div>
  );
}

/** Drag a card by its number, or press Alt+Up / Alt+Down in it; press the number to open its settings. */
export const Default: Story = {
  render: (args) => <Stages args={args} />,
};
