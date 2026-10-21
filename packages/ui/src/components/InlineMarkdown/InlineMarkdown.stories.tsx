import type { Meta, StoryObj } from '@weasel-js/forge';
import { InlineMarkdown } from '@weasel-js/ui/components/InlineMarkdown';

const meta: Meta<typeof InlineMarkdown> = {
  title: 'ui/Foundations/InlineMarkdown',
  component: InlineMarkdown,
  args: {
    text: 'Sets `fill` on **every** stop, *not* ~~one~~, as [the spec](https://example.com) says. A glob like *.ts stays as written. <kbd>Mod+Z</kbd> undoes it.',
    links: 'anchor',
  },
  argTypes: { links: { control: 'inline-radio', options: ['anchor', 'text'] } },
};
export default meta;
type Story = StoryObj<typeof InlineMarkdown>;

export const Default: Story = {};

export const LinksAsText: Story = { args: { links: 'text' } };
