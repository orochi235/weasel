import type { Meta, StoryObj } from '@weasel-js/forge';
import { BarField, BarLayout, type BarNode } from '@weasel-js/ui/components/Bar';
import { useStoryFields } from './barStoryFields';
import s from './Bar.stories.module.css';

const meta: Meta<typeof BarLayout> = {
  title: 'ui/Bar/BarLayout',
  component: BarLayout,
  args: { label: 'Text', framed: true },
};
export default meta;
type Story = StoryObj<typeof BarLayout>;

/** Cells a surface drew for itself, laid on one line: a divider each side of a run. */
function Line({ args, ids }: { args: Story['args']; ids: readonly (readonly string[])[] }) {
  const fields = useStoryFields();
  const cell = (id: string): BarNode => {
    const { field } = fields.find((f) => f.id === id)!;
    return { kind: 'cell', path: id, content: <BarField {...field} /> };
  };
  const nodes: BarNode[] = ids.map((run, i) => (run.length === 1 ? cell(run[0]!) : { kind: 'run', path: `run${i}`, nodes: run.map(cell) }));
  return (
    <div className={args?.orientation === 'vertical' ? s.rail : undefined}>
      <BarLayout {...args} nodes={nodes} cells={() => []} />
    </div>
  );
}

const RUNS = [['number'], ['boolean', 'boolean switch'], ['enum', 'color']] as const;

/** A framed bar's line: a lone cell, then two runs set off by dividers. */
export const Default: Story = { render: (args) => <Line args={args} ids={RUNS} /> };

/** The same cells run down the side, each upright. */
export const Vertical: Story = { args: { orientation: 'vertical' }, render: (args) => <Line args={args} ids={RUNS} /> };
