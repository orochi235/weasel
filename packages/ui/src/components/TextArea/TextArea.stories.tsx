import type { Meta, StoryObj } from '@weasel-js/forge';
import { TextArea } from '@weasel-js/ui/components/TextArea';

const meta: Meta<typeof TextArea> = {
  title: 'Primitives/TextArea',
  component: TextArea,
};
export default meta;

type Story = StoryObj<typeof TextArea>;

export const Basic: Story = {
  args: { label: 'Description', placeholder: 'What did you expect, and what happened?' },
};

export const WithDescription: Story = {
  args: { label: 'Notes', description: 'Markdown is fine.', defaultValue: 'First line\nSecond line' },
};

export const Invalid: Story = {
  args: { label: 'Description', isInvalid: true, errorMessage: 'Say what went wrong.' },
};

export const Disabled: Story = {
  args: { label: 'Description', isDisabled: true, defaultValue: 'Read only for now.' },
};
