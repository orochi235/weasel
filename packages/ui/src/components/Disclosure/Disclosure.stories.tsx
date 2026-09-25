import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { Disclosure, DisclosureRow } from './Disclosure';

const meta: Meta<typeof Disclosure> = {
  title: 'ui/Disclosure',
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

/** Proofed large, because an off-center bar is a blurry pixel at 13px and
 *  obviously wrong at 104. The right-hand column is the size it actually ships. */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      {[104, 52, 26, 13].map((size) => (
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

/** Every state side by side: shut, open, and disabled. */
export const States: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16 }}>
      <Disclosure open={false} onToggle={() => {}} label="Shut" />
      <Disclosure open onToggle={() => {}} label="Open" />
      <Disclosure open={false} onToggle={() => {}} label="Disabled" disabled />
    </div>
  ),
};
