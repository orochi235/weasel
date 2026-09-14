import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ComboBox, ComboBoxItem } from './ComboBox';
import { useAsyncOptions } from '../../useAsyncOptions';

const meta: Meta<typeof ComboBox> = {
  title: 'Primitives/ComboBox',
  component: ComboBox,
};
export default meta;

type Story = StoryObj<typeof ComboBox>;

const COLORS = [
  { value: 'r', label: 'Red' },
  { value: 'g', label: 'Green' },
  { value: 'b', label: 'Blue' },
  { value: 'k', label: 'Black' },
  { value: 'w', label: 'White' },
];

export const OptionsArray: Story = {
  render: () => <ComboBox label="Color" options={COLORS} placeholder="Type to filter…" />,
};

export const ExplicitChildren: Story = {
  render: () => (
    <ComboBox label="Color" defaultSelectedKey="g">
      <ComboBoxItem id="r">Red</ComboBoxItem>
      <ComboBoxItem id="g">Green</ComboBoxItem>
      <ComboBoxItem id="b" isDisabled>Blue (unavailable)</ComboBoxItem>
    </ComboBox>
  ),
};

export const Controlled: Story = {
  render: () => {
    function Wrap() {
      const [v, setV] = useState<string | null>('r');
      return (
        <ComboBox<string>
          label={`Color (= ${v ?? '∅'})`}
          options={COLORS}
          selectedKey={v}
          onSelectionChange={setV}
        />
      );
    }
    return <Wrap />;
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
        <ComboBox
          aria-label="Fits its options"
          width="fit"
          placeholder="Filter…"
          options={[...COLORS, { value: 'v', label: 'Vermilion' }]}
        />
        <span>tail</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button">Add trial</button>
        <ComboBox
          aria-label="Fills the row"
          placeholder="Filter…"
          options={[...COLORS, { value: 'v', label: 'Vermilion' }]}
        />
        <span>tail</span>
      </div>
    </div>
  ),
};

/** A ranked corpus behind a slow link: stale rows stay, marked pending. */
const PARTS = [
  { value: '3001', label: '3001 — Brick 2 x 4' },
  { value: '3002', label: '3002 — Brick 2 x 3' },
  { value: '3003', label: '3003 — Brick 2 x 2' },
  { value: '3004', label: '3004 — Brick 1 x 2' },
  { value: '3005', label: '3005 — Brick 1 x 1' },
];

export const AsyncOptions: Story = {
  render: () => {
    const [committed, setCommitted] = useState<string>('—');
    const async = useAsyncOptions<string>({
      debounceMs: 150,
      load: (query) =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve(PARTS.filter((p) => query === '' || p.value.startsWith(query))),
            600,
          ),
        ),
    });
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <ComboBox
          label="Part"
          placeholder="Type a part number…"
          allowsCustomValue
          filter="none"
          options={async.options}
          isLoading={async.isLoading}
          loadError={async.loadError}
          inputValue={async.inputValue}
          onInputChange={async.onInputChange}
          onCommit={(c) => setCommitted(c.source === 'option' ? c.key : c.text)}
          emptyLabel="No parts"
          errorLabel="Couldn't load parts"
        />
        <span>Committed: {committed}</span>
      </div>
    );
  },
};

export const LoadFailed: Story = {
  render: () => {
    const async = useAsyncOptions<string>({
      debounceMs: 0,
      load: () => Promise.reject(new Error('offline')),
    });
    return (
      <ComboBox
        label="Part"
        placeholder="Type anything…"
        filter="none"
        options={async.options}
        isLoading={async.isLoading}
        loadError={async.loadError}
        inputValue={async.inputValue}
        onInputChange={async.onInputChange}
        errorLabel="Couldn't load parts"
      />
    );
  },
};
