import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { ToggleBar } from '../ToggleBar';
import { FitLabel } from './FitLabel';
import s from './FitLabel.stories.module.css';

const meta: Meta<typeof FitLabel> = {
  title: 'ui/Foundations/FitLabel',
  component: FitLabel,
};

export default meta;
type Story = StoryObj<typeof FitLabel>;

const CASES = [
  { value: 'none', forms: ['None', '–'] },
  { value: 'upper', forms: ['Uppercase', 'Upper', 'AA'] },
  { value: 'lower', forms: ['Lowercase', 'Lower', 'aa'] },
  { value: 'title', forms: ['Capitalize', 'Title', 'Aa'] },
];

/** Drag the box's corner: the segments step down together as it narrows. */
export const InAToggleBar: Story = {
  render: () => {
    const [v, setV] = useState<string | null>('none');
    return (
      <div className={s.room}>
        <ToggleBar
          ariaLabel="Case"
          items={CASES.map((c) => ({ value: c.value, label: <FitLabel forms={c.forms} />, ariaLabel: c.forms[0] }))}
          value={v}
          onChange={setV}
        />
      </div>
    );
  },
};
