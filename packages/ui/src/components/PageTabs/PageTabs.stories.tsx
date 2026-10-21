import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { PageTabs, type PageTabItem } from '@weasel-js/ui/components/PageTabs';
import s from './PageTabs.stories.module.css';

const meta: Meta<typeof PageTabs> = {
  title: 'ui/PageTabs',
  component: PageTabs,
};
export default meta;

type Story = StoryObj<typeof PageTabs>;

/** A document's pages, kept in the story's own state the way an editor keeps them in its document. */
function Document({ initial, current: start = initial[0]?.id ?? null }: { initial: PageTabItem[]; current?: string | null }) {
  const [pages, setPages] = useState(initial);
  const [current, setCurrent] = useState<string | null>(start);
  return (
    <PageTabs
      aria-label="Pages"
      pages={pages}
      current={current}
      onSelect={setCurrent}
      onRename={(id, name) => setPages((ps) => ps.map((p) => (p.id === id ? { ...p, name } : p)))}
      onMove={(id, index) => setPages((ps) => {
        const next = ps.filter((p) => p.id !== id);
        next.splice(index, 0, ps.find((p) => p.id === id)!);
        return next;
      })}
      onAdd={() => setPages((ps) => [...ps, { id: `p${ps.length + 1}-${Date.now()}` }])}
    />
  );
}

/** Press a tab to light it, double-press to rename, drag to reorder, and + to add a page. */
export const Editable: Story = {
  render: () => <Document initial={[{ id: 'a', name: 'Overview' }, { id: 'b' }, { id: 'c', name: 'Appendix' }]} />,
};

/** With no page current, as when the view sits between pages, no tab is lit. */
export const NoneLit: Story = {
  render: () => <Document initial={[{ id: 'a' }, { id: 'b' }]} current={null} />,
};

/** Without the editing callbacks the strip only navigates: no + button, no rename, no drag. */
export const NavigateOnly: Story = {
  render: () => (
    <PageTabs pages={[{ id: 'a' }, { id: 'b' }, { id: 'c' }]} current="b" onSelect={() => {}} />
  ),
};

/** More pages than fit scroll sideways inside the strip. */
export const ManyPages: Story = {
  render: () => (
    <div className={s.narrow}>
      <Document initial={Array.from({ length: 14 }, (_, i) => ({ id: `p${i}` }))} />
    </div>
  ),
};
