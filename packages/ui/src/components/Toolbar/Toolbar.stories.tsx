import type { Meta, StoryObj } from '@weasel-js/forge';
import { Button } from '@weasel-js/ui/components/Button';
import { Toolbar } from '@weasel-js/ui/components/Toolbar';
import s from './Toolbar.stories.module.css';

const meta: Meta<typeof Toolbar> = {
  title: 'ui/Foundations/Toolbar',
  component: Toolbar,
};
export default meta;

type Story = StoryObj<typeof Toolbar>;

/** Groups rule themselves off; an `end` group sits at the far end, unruled. */
export const Groups: Story = {
  render: () => (
    <Toolbar aria-label="Document">
      <Toolbar.Group aria-label="History">
        <Button variant="ghost">Undo</Button>
        <Button variant="ghost">Redo</Button>
      </Toolbar.Group>
      <Toolbar.Group aria-label="Clipboard">
        <Button variant="ghost">Cut</Button>
        <Button variant="ghost">Copy</Button>
        <Button variant="ghost">Paste</Button>
      </Toolbar.Group>
      <Toolbar.Group end aria-label="File">
        <Button>Save</Button>
      </Toolbar.Group>
    </Toolbar>
  ),
};

/** A spacer pushes what follows to the far end. */
export const Spacer: Story = {
  render: () => (
    <Toolbar aria-label="Trial">
      <Button variant="ghost">Undo</Button>
      <Button variant="ghost" pressed>Grid</Button>
      <Toolbar.Spacer />
      <Button variant="ghost" grade="danger">Discard</Button>
    </Toolbar>
  ),
};

/** `wrap` lets a long run take a second line rather than overflow. */
export const Wrapping: Story = {
  render: () => (
    <div className={s.narrow}>
      <Toolbar aria-label="Many" wrap>
        {['One', 'Two', 'Three', 'Four', 'Five', 'Six'].map((n) => (
          <Toolbar.Group key={n}>
            <Button variant="ghost">{n}</Button>
          </Toolbar.Group>
        ))}
      </Toolbar>
    </div>
  ),
};
