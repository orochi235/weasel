import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { Disclosure, DisclosureRow } from '@weasel-js/ui/components/Disclosure';
import s from './Disclosure.stories.module.css';

const meta: Meta<typeof Disclosure> = {
  title: 'ui/Disclosure',
  component: Disclosure,
};
export default meta;
type Story = StoryObj<typeof Disclosure>;

export const Closed: Story = {
  args: { open: false, label: 'Shapes', onOpenChange: () => {} },
};

export const Open: Story = {
  args: { open: true, label: 'Shapes', onOpenChange: () => {} },
};

/** Proofed large, because an off-center bar is a blurry pixel at 13px and
 *  obviously wrong at 104. The right-hand column is the size it actually ships. */
export const Sizes: Story = {
  render: (args) => (
    <div className={`${s.row} ${s.proof}`}>
      {[104, 52, 26, 13].map((size) => (
        <Disclosure {...args} key={size} open={false} onOpenChange={() => {}} label={`${size}px`} size={size} />
      ))}
    </div>
  ),
};

const FACETS: ReadonlyArray<readonly [string, string[]]> = [
  ['Brackets', ['1 x 2', '1 x 4', '2 x 2 corner']],
  ['Plates', ['1 x 1', '2 x 4', '6 x 8']],
  ['Slopes', ['33°', '45°', 'inverted 45°']],
];

/**
 * The case this was built for: a facet tree whose rows each hold a checkbox.
 * The twisty is a sibling of the checkbox's label, not a child, so expanding a
 * family does not tick its box.
 */
export const FacetTree: Story = {
  render: () => {
    const [open, setOpen] = useState<Record<string, boolean>>({ Brackets: true });
    const [checked, setChecked] = useState<Record<string, boolean>>({});
    return (
      <div className={s.tree}>
        {FACETS.map(([family, members]) => (
          <div key={family}>
            <DisclosureRow
              open={!!open[family]}
              onOpenChange={(next) => setOpen((o) => ({ ...o, [family]: next }))}
              label={`${family} categories`}
              aria-controls={`facet-${family}`}
            >
              <Checkbox
                isSelected={!!checked[family]}
                onChange={(on) => setChecked((c) => ({ ...c, [family]: on }))}
              >
                {family}
              </Checkbox>
            </DisclosureRow>
            {open[family] && (
              <div id={`facet-${family}`} className={s.members}>
                {members.map((m) => (
                  <div key={m}>{m}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  },
};

/** Every state side by side: shut, open, and disabled. */
export const States: Story = {
  render: (args) => (
    <div className={s.row}>
      <Disclosure {...args} open={false} onOpenChange={() => {}} label="Shut" />
      <Disclosure {...args} open onOpenChange={() => {}} label="Open" />
      <Disclosure {...args} open={false} onOpenChange={() => {}} label="Disabled" disabled />
    </div>
  ),
};
