import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { CloseButton } from '@weasel-js/ui/components/CloseButton';
import s from './CloseButton.stories.module.css';

const meta: Meta<typeof CloseButton> = {
  title: 'ui/Foundations/CloseButton',
  component: CloseButton,
  args: { 'aria-label': 'Close' },
};
export default meta;

type Story = StoryObj<typeof CloseButton>;

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
  render: (args) => {
    function Wrap() {
      const [rows, setRows] = useState(['Glow', 'Drop shadow', 'Blur']);
      return (
        <ul className={s.rows}>
          {rows.map((r) => (
            <li key={r}>
              <span>{r}</span>
              <CloseButton {...args} aria-label={`Remove ${r}`} onClick={() => setRows(rows.filter((x) => x !== r))} />
            </li>
          ))}
        </ul>
      );
    }
    return <Wrap />;
  },
};
