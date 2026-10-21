import type { Meta, StoryObj } from '@weasel-js/forge';
import { MIXED } from '@weasel-js/core';
import { CharacterOptions } from '@weasel-js/ui/components/CharacterOptions';

const meta: Meta = { title: 'ui/CharacterOptions' };
export default meta;
type Story = StoryObj;

export const Editing: Story = {
  render: () => (
    <div style={{ width: 1180 }}>
      <CharacterOptions
        style={{ bold: true, fontWeight: 700, underline: true, fontFamily: 'Inter', fontSize: 24, fill: { paint: { color: '#1e293b' } } }}
        onPatch={() => {}}
      />
    </div>
  ),
};

// No edit in progress: the row keeps its height and shows nothing.
export const Idle: Story = {
  render: () => <CharacterOptions onPatch={() => {}} />,
};

export const MixedRange: Story = {
  render: () => (
    <div style={{ width: 1180 }}>
      <CharacterOptions
        style={{ bold: MIXED, fontWeight: MIXED, fontSize: MIXED, script: MIXED, fill: MIXED, fontFamily: 'Inter' }}
        onPatch={() => {}}
      />
    </div>
  ),
};
