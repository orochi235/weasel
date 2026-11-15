import type { Meta, StoryObj } from '@weasel-js/forge';
import { Bar } from '@weasel-js/ui/components/Bar';
import { Button } from '@weasel-js/ui/components/Button';
import { ControlSizeScope, type ControlSize } from '@weasel-js/ui/components/ControlSize';
import { Input } from '@weasel-js/ui/components/Input';
import { NumberField, UnitField } from '@weasel-js/ui/components/NumberField';
import { Select } from '@weasel-js/ui/components/Select';
import s from './ControlSize.stories.module.css';

const meta: Meta<typeof ControlSizeScope> = {
  title: 'ui/ControlSize',
  component: ControlSizeScope,
  args: { size: 'sm' },
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'md'] } },
};
export default meta;

type Story = StoryObj<typeof ControlSizeScope>;

const OPTIONS = [{ value: 'linear', label: 'Linear' }, { value: 'ease', label: 'Ease' }];

function Controls({ size }: { size?: ControlSize }) {
  return (
    <>
      <Button size={size}>Apply</Button>
      <Select aria-label="Curve" options={OPTIONS} defaultSelectedKey="linear" width="fit" size={size} />
      <Input aria-label="Name" defaultValue="Layer 1" size={size} />
      <NumberField aria-label="Count" defaultValue={3} width="fit" size={size} />
      <UnitField aria-label="Width" value={120} onChange={() => {}} width="fit" size={size} />
    </>
  );
}

/** One scope sizes a row of mixed controls; switch the theme's density to see both sizes scale together. */
export const MixedRow: Story = {
  render: ({ size }) => (
    <ControlSizeScope size={size}>
      <div className={s.row}><Controls /></div>
    </ControlSizeScope>
  ),
};

/** The nearest scope wins, and a control's own `size` wins over any scope. */
export const Precedence: Story = {
  render: () => (
    <div className={s.rows}>
      <ControlSizeScope size="sm">
        <div className={s.row}><Controls /></div>
        <ControlSizeScope size="md">
          <div className={s.row}><Controls /></div>
        </ControlSizeScope>
        <div className={s.row}><Controls size="md" /></div>
      </ControlSizeScope>
    </div>
  ),
};

/** A container's `size` is a scope over what it holds: a compact bar lines its fields up with its buttons. */
export const CompactBar: Story = {
  render: () => (
    <Bar label="Tools" size="sm" framed="band">
      <Controls />
    </Bar>
  ),
};
