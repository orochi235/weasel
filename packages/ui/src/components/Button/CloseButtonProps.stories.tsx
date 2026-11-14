import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { Button, CLOSE_BUTTON_PROPS } from '@weasel-js/ui/components/Button';
import s from './CloseButtonProps.stories.module.css';

interface CloseArgs {
  'aria-label': string;
  tooltip?: string;
  disabled?: boolean;
  disabledReason?: string;
}

function Close(args: CloseArgs) {
  return <Button {...CLOSE_BUTTON_PROPS} {...args} />;
}

const meta: Meta<typeof Close> = {
  title: 'ui/Button/Close',
  component: Close,
  args: { 'aria-label': 'Close' },
};
export default meta;

type Story = StoryObj<typeof Close>;

/** `<Button {...CLOSE_BUTTON_PROPS} aria-label="Close" />`. */
export const Basic: Story = {};

export const WithTooltip: Story = {
  args: { 'aria-label': 'Hide panel', tooltip: 'Hide panel' },
};

export const Disabled: Story = {
  args: { disabled: true },
};

/** A disabled close button given a reason keeps its tooltip, which reads it. */
export const DisabledWithReason: Story = {
  args: { disabled: true, disabledReason: 'A document needs one layer at least' },
};

/** Removing rows from a list, the way `ListEditor` and `LayerList` use it. */
export const RemoveRows: Story = {
  render: () => {
    function Wrap() {
      const [rows, setRows] = useState(['Glow', 'Drop shadow', 'Blur']);
      return (
        <ul className={s.rows}>
          {rows.map((r) => (
            <li key={r}>
              <span>{r}</span>
              <Button {...CLOSE_BUTTON_PROPS} aria-label={`Remove ${r}`} onClick={() => setRows(rows.filter((x) => x !== r))} />
            </li>
          ))}
        </ul>
      );
    }
    return <Wrap />;
  },
};
