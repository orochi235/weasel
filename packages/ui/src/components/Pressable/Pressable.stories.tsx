import type { Meta, StoryObj } from '@weasel-js/forge';
import { Pressable } from '@weasel-js/ui/components/Pressable';
import { Callout, CalloutTrigger } from '@weasel-js/ui/components/Callout';
import { Button } from '@weasel-js/ui/components/Button';

const meta: Meta<typeof Pressable> = {
  title: 'ui/Pressable',
  component: Pressable,
};
export default meta;

type Story = StoryObj<typeof Pressable>;

/** The kit `Button` opening a callout: `Pressable` hands it the trigger's press. */
export const KitButtonTrigger: Story = {
  render: () => (
    <CalloutTrigger>
      <Pressable>
        <Button variant="ghost">What does this do?</Button>
      </Pressable>
      <Callout title="Boolean union" placement="bottom">
        Merges the selected paths into a single shape.
      </Callout>
    </CalloutTrigger>
  ),
};
