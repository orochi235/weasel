import type { Meta, StoryObj } from '@weasel-js/forge';
import { expect } from '@weasel-js/forge/play';
import { useState } from 'react';
import { Select, SelectItem, SelectSection } from './Select';

const meta: Meta<typeof Select> = {
  title: 'Primitives/Select',
  component: Select,
};
export default meta;

type Story = StoryObj<typeof Select>;

const COLORS = [
  { value: 'r', label: 'Red' },
  { value: 'g', label: 'Green' },
  { value: 'b', label: 'Blue' },
];

export const OptionsArray: Story = {
  render: () => <Select label="Color" options={COLORS} placeholder="Pick one" />,
};

export const ExplicitChildren: Story = {
  render: () => (
    <Select label="Color" defaultSelectedKey="g">
      <SelectItem id="r">Red</SelectItem>
      <SelectItem id="g">Green</SelectItem>
      <SelectItem id="b" isDisabled>Blue (unavailable)</SelectItem>
    </Select>
  ),
  // The trigger needs `overflow: hidden` for its ellipsis, which turns the line
  // box into a clip: a line-height under the font's own leading cuts the
  // ascenders and descenders off "Green". jsdom resolves neither of them, so
  // this has to run in a browser.
  play: async ({ canvasElement }) => {
    const value = canvasElement.querySelector('button > span');
    if (!value) throw new Error('no trigger value');
    expect(value.scrollHeight).toBe(value.clientHeight);
  },
};

/** The two rows differ only in `width`. `fit` takes what its widest option —
 *  "Vermilion" — needs and leaves the rest of the row to its neighbors; the
 *  default `fill` swallows the slack and squeezes them to min-content. */
export const FitWidth: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button">Add trial</button>
        <Select
          aria-label="Fits its options"
          width="fit"
          placeholder="Pick one"
          options={[...COLORS, { value: 'v', label: 'Vermilion' }]}
        />
        <span>tail</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button">Add trial</button>
        <Select
          aria-label="Fills the row"
          placeholder="Pick one"
          options={[...COLORS, { value: 'v', label: 'Vermilion' }]}
        />
        <span>tail</span>
      </div>
    </div>
  ),
};

/**
 * `orientation='row'` sets the label beside the trigger. Filling, the trigger
 * takes the rest of the row; fitted, the pair sits at its own width. A
 * description drops to a line of its own.
 */
export const LabelBeside: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 320 }}>
      <Select label="Bundle" orientation="row" defaultSelectedKey="g" options={COLORS} />
      <Select label="Bundle" orientation="row" width="fit" defaultSelectedKey="g" options={COLORS} />
      <Select
        label="Bundle"
        orientation="row"
        description="Filters the tree to one bundle's members."
        defaultSelectedKey="g"
        options={COLORS}
      />
    </div>
  ),
};

/** Titled sections, from `options` entries with their own `title` and
 *  `options`, or from `<SelectSection>` in the children form. */
export const Sections: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 240 }}>
      <Select
        label="Font"
        defaultSelectedKey="inter"
        options={[
          { value: 'system', label: 'System' },
          { title: 'Sans', options: [{ value: 'inter', label: 'Inter' }, { value: 'helvetica', label: 'Helvetica' }] },
          { title: 'Serif', options: [{ value: 'garamond', label: 'Garamond' }, { value: 'charter', label: 'Charter' }] },
        ]}
      />
      <Select label="Blend" defaultSelectedKey="multiply">
        <SelectSection title="Darken">
          <SelectItem id="darken">Darken</SelectItem>
          <SelectItem id="multiply">Multiply</SelectItem>
        </SelectSection>
        <SelectSection title="Lighten">
          <SelectItem id="lighten">Lighten</SelectItem>
          <SelectItem id="screen">Screen</SelectItem>
        </SelectSection>
      </Select>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => <Select label="Color" options={COLORS} defaultSelectedKey="r" isDisabled />,
};

export const Controlled: Story = {
  render: () => {
    function Wrap() {
      const [v, setV] = useState<string>('r');
      return (
        <Select<string>
          label={`Color (= ${v})`}
          options={COLORS}
          selectedKey={v}
          onSelectionChange={setV}
        />
      );
    }
    return <Wrap />;
  },
};

/**
 * A select set in a row of other chrome. `variant='bare'` drops the box and,
 * with it, the caret: 10px of caret is a tenth of a value this narrow, and the
 * value carries the affordance itself — dotted at rest, solid under the
 * pointer. The second row right-aligns its value, which the list follows.
 */
export const InARow: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 260 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>Wave</span>
        <Select aria-label="Wave" variant="bare" defaultSelectedKey="g" options={COLORS} />
      </div>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, ['--wzl-select-align' as string]: 'right' }}
      >
        <span>Wave</span>
        <Select aria-label="Wave, right-aligned" variant="bare" defaultSelectedKey="g" options={COLORS} />
      </div>
    </div>
  ),
};

/**
 * Where the list lands. `over` (the default) puts the selected row on the
 * trigger, so choosing what is already chosen moves nothing; `below` hangs the
 * list under the trigger and takes its width.
 */
export const PopupPlacement: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 24 }}>
      <Select label="Over (default)" options={COLORS} defaultSelectedKey="g" />
      <Select label="Below" popup="below" options={COLORS} defaultSelectedKey="g" />
    </div>
  ),
};

/** `shortcut` hovers as `Name (⌘K)`; `tooltip` replaces that text with a
 *  longer hint for a trigger whose value alone doesn't say what it sets. */
export const Tooltips: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 24 }}>
      <Select aria-label="Color" shortcut="⌘K" width="fit" options={COLORS} defaultSelectedKey="g" />
      <Select
        aria-label="Color"
        tooltip="Channel the curve edits"
        width="fit"
        options={COLORS}
        defaultSelectedKey="b"
      />
    </div>
  ),
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m) => ({
  value: m,
  label: m,
}));

/** A select in a toolbar along the window's top edge, set to a late option.
 *  Laying that row over the trigger would push the rows above it past the
 *  edge, so the list stops at the edge instead. */
export const AtTheTopEdge: Story = {
  render: () => (
    <div style={{ position: 'fixed', top: 4, left: 4 }}>
      <Select aria-label="Month" width="fit" options={MONTHS} defaultSelectedKey="Nov" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('button');
    if (!trigger) throw new Error('no trigger');
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    let popover: Element | null = null;
    for (let i = 0; i < 40 && !popover?.querySelector('[data-selected]'); i++) {
      await new Promise((r) => requestAnimationFrame(r));
      popover = trigger.ownerDocument.querySelector('[data-weasel-overlay][role="dialog"], [data-weasel-overlay]');
    }
    if (!popover) throw new Error('list never opened');
    for (let i = 0; i < 5; i++) await new Promise((r) => requestAnimationFrame(r));
    expect(popover.getBoundingClientRect().top).toBeGreaterThanOrEqual(12);
  },
};
