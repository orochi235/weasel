// A look at the character bar the text tool declares, without a running
// document behind it. Delete if it stops earning its place.
import type { Meta, StoryObj } from '@weasel-js/forge';
import { MIXED } from '@weasel-js/core';
import { CharacterOptions } from './CharacterOptions';
import '../../app.css';

const meta: Meta = { title: 'draw/CharacterOptions' };
export default meta;
type Story = StoryObj;

export const Editing: Story = {
  render: () => (
    <div style={{ width: 1180 }}>
      <CharacterOptions
        style={{ bold: true, underline: true, fontFamily: 'Inter', fontSize: 24, fill: { color: '#1e293b' } }}
        onPatch={() => {}}
      />
    </div>
  ),
};

export const MixedRange: Story = {
  render: () => (
    <div style={{ width: 1180 }}>
      <CharacterOptions
        style={{ bold: MIXED, fontSize: MIXED, script: MIXED, fill: MIXED, fontFamily: 'Inter' }}
        onPatch={() => {}}
      />
    </div>
  ),
};
