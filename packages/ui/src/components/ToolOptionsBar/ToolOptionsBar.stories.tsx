import type { Meta, StoryObj } from '@storybook/react-vite';
import { ToolOptionsBar } from './ToolOptionsBar';
import { Button } from '../Button';

const meta: Meta<typeof ToolOptionsBar> = {
  title: 'weasel-ui/Foundations/ToolOptionsBar',
  component: ToolOptionsBar,
};
export default meta;

type Story = StoryObj<typeof ToolOptionsBar>;

// The app reserves this row permanently — this is what it looks like
// with no active tool contributing controls.
export const Empty: Story = {
  render: () => <ToolOptionsBar />,
};

export const OneControlGroup: Story = {
  render: () => (
    <ToolOptionsBar label="Text">
      <Button size="sm" variant="ghost" iconOnly ariaLabel="Bold">B</Button>
      <Button size="sm" variant="ghost" iconOnly ariaLabel="Italic">I</Button>
      <Button size="sm" variant="ghost" iconOnly ariaLabel="Underline">U</Button>
    </ToolOptionsBar>
  ),
};

// Contents exceed the row's width — the controls slot scrolls
// horizontally in place rather than wrapping (which would grow the
// row's fixed height) or clipping (which would strand controls with
// no way to reach them).
export const ManyControlsOverflow: Story = {
  render: () => (
    <div style={{ width: 360, border: '1px dashed var(--wzl-panel-border)' }}>
      <ToolOptionsBar label="Text">
        {Array.from({ length: 16 }, (_, i) => (
          <Button key={i} size="sm" variant="ghost">
            {`Opt ${i + 1}`}
          </Button>
        ))}
      </ToolOptionsBar>
    </div>
  ),
};
