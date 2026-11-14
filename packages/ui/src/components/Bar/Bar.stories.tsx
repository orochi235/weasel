import type { Meta, StoryObj } from '@weasel-js/forge';
import { Button } from '@weasel-js/ui/components/Button';
import { Bar, BarField } from '@weasel-js/ui/components/Bar';
import { useStoryFields } from './BarField.fixtures';
import s from './Bar.stories.module.css';

const meta: Meta<typeof Bar> = {
  title: 'ui/Bar',
  component: Bar,
};
export default meta;

type Story = StoryObj<typeof Bar>;

/** A group is set off from its neighbors by a divider; an `end` group sits at the far end. */
export const Groups: Story = {
  render: (args) => (
    <Bar {...args} label="Document">
      <Bar.Group aria-label="History">
        <Button variant="ghost">Undo</Button>
        <Button variant="ghost">Redo</Button>
      </Bar.Group>
      <Bar.Group aria-label="Clipboard">
        <Button variant="ghost">Cut</Button>
        <Button variant="ghost">Copy</Button>
        <Button variant="ghost">Paste</Button>
      </Bar.Group>
      <Bar.Group end aria-label="File">
        <Button>Save</Button>
      </Bar.Group>
    </Bar>
  ),
};

/** A spacer pushes what follows to the far end. `roving` leaves one button in the tab order, for the arrow keys. */
export const Spacer: Story = {
  render: (args) => (
    <Bar {...args} label="Trial" roving>
      <Button variant="ghost">Undo</Button>
      <Button variant="ghost" pressed>Grid</Button>
      <Bar.Spacer />
      <Button variant="ghost" grade="danger">Discard</Button>
    </Bar>
  ),
};

/** `size="sm"` and `framed="band"`: a compact strip of its own, as chrome around a working surface, led by its name. */
export const CompactBand: Story = {
  render: (args) => (
    <Bar {...args} label="My Trial" lead="label" size="sm" framed="band">
      <Bar.Group aria-label="History">
        <Bar.Button onClick={() => {}}>Undo</Bar.Button>
        <Bar.Button onClick={() => {}} disabled>
          Redo
        </Bar.Button>
      </Bar.Group>
      <Bar.Group end aria-label="File">
        <Bar.Button onClick={() => {}}>Save</Bar.Button>
      </Bar.Group>
    </Bar>
  ),
};

/** `wrap` lets a long run take a second line rather than overflow. */
export const Wrapping: Story = {
  render: (args) => (
    <div className={s.narrow}>
      <Bar {...args} label="Many" wrap>
        {['One', 'Two', 'Three', 'Four', 'Five', 'Six'].map((n) => (
          <Bar.Group key={n}>
            <Button variant="ghost">{n}</Button>
          </Bar.Group>
        ))}
      </Bar>
    </div>
  ),
};

/** `framed="status"`: the readout strip along an editor's foot. A spacer splits live readouts from reference. */
export const Status: Story = {
  render: (args) => (
    <Bar {...args} framed="status" label="Editor status" divided>
      <Bar.Readout>tool: pencil</Bar.Readout>
      <Bar.Readout>sel: 0</Bar.Readout>
      <Bar.Spacer />
      <Bar.Readout>zoom: 55%</Bar.Readout>
      <Bar.Readout muted title="@weasel-js/core 0.7.0 — built 2026-07-30T18:22:04.000Z">
        0.7.0 · Jul 30
      </Bar.Readout>
    </Bar>
  ),
};

/** Fields in their bar forms, laid on one line: a divider each side of a group. */
function Fields({ args }: { args: Story['args'] }) {
  const fields = useStoryFields();
  const field = (id: string) => <BarField key={id} {...fields.find((f) => f.id === id)!.field} />;
  return (
    <div className={args?.orientation === 'vertical' ? s.rail : undefined}>
      <Bar {...args} label="Text" framed>
        {field('number')}
        <Bar.Group>{field('boolean')}{field('boolean switch')}</Bar.Group>
        <Bar.Group>{field('enum')}{field('color')}</Bar.Group>
      </Bar>
    </div>
  );
}

/** A framed bar of fields. */
export const FieldLine: Story = { render: (args) => <Fields args={args} /> };

/** The same fields run down the side, each upright. */
export const Vertical: Story = { args: { orientation: 'vertical' }, render: (args) => <Fields args={args} /> };
