import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { CloseButton } from './CloseButton';
import s from './CloseButton.stories.module.css';

const meta: Meta<typeof CloseButton> = {
  title: 'Primitives/CloseButton',
  component: CloseButton,
  args: { ariaLabel: 'Close' },
};
export default meta;

type Story = StoryObj<typeof CloseButton>;

export const Basic: Story = {};

export const WithTooltip: Story = {
  args: { ariaLabel: 'Hide panel', tooltip: 'Hide panel' },
};

export const Disabled: Story = {
  args: { disabled: true },
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
              <CloseButton ariaLabel={`Remove ${r}`} onClick={() => setRows(rows.filter((x) => x !== r))} />
            </li>
          ))}
        </ul>
      );
    }
    return <Wrap />;
  },
};
