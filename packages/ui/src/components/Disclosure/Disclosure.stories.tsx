import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Disclosure, DisclosureRow } from './Disclosure';

const meta: Meta<typeof Disclosure> = {
  title: 'weasel-ui/Disclosure',
  component: Disclosure,
};
export default meta;
type Story = StoryObj<typeof Disclosure>;

export const Closed: Story = {
  args: { open: false, label: 'Shapes', onToggle: () => {} },
};

export const Open: Story = {
  args: { open: true, label: 'Shapes', onToggle: () => {} },
};

/** Proofed large, because a misplaced vertex is two blurry pixels at 12px and
 *  obviously wrong at 96. The right-hand column is the size it actually ships. */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      {[96, 48, 24, 12].map((size) => (
        <Disclosure key={size} open={false} onToggle={() => {}} label={`${size}px`} size={size} />
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
 * The twisty is a sibling of the `<label>`, not a child, so expanding a family
 * does not tick its box.
 */
export const FacetTree: Story = {
  render: () => {
    const [open, setOpen] = useState<Record<string, boolean>>({ Brackets: true });
    const [checked, setChecked] = useState<Record<string, boolean>>({});
    return (
      <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {FACETS.map(([family, members]) => (
          <div key={family}>
            <DisclosureRow
              open={!!open[family]}
              onToggle={() => setOpen((o) => ({ ...o, [family]: !o[family] }))}
              label={`${family} categories`}
              controls={`facet-${family}`}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={!!checked[family]}
                  onChange={() => setChecked((c) => ({ ...c, [family]: !c[family] }))}
                />
                <span>{family}</span>
              </label>
            </DisclosureRow>
            {open[family] && (
              <div id={`facet-${family}`} style={{ paddingLeft: 30 }}>
                {members.map((m) => (
                  <div key={m} style={{ opacity: 0.7 }}>
                    {m}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  },
};

/** `direction="down"` for a section whose closed state points down and lifts
 *  to point up — a sort header, an accordion that opens upward. */
export const PointingDown: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16 }}>
      <Disclosure open={false} onToggle={() => {}} label="Closed" direction="down" />
      <Disclosure open onToggle={() => {}} label="Open" direction="down" />
      <Disclosure open={false} onToggle={() => {}} label="Disabled" direction="down" disabled />
    </div>
  ),
};
