import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { AssetEditor } from './AssetEditor';
import { DEMO_WORKSPACE } from './AssetEditor.demo';
import { workspaceCodec } from './workspaceCodec';
import s from './AssetEditor.stories.module.css';

const meta: Meta<typeof AssetEditor> = {
  title: 'Primitives/AssetEditor',
  component: AssetEditor,
};
export default meta;

type Story = StoryObj<typeof AssetEditor>;

/**
 * A dialog and the panels that point into it, picked from the list at the far edge. Re-key or remove a setting in
 * `Settings` and the pointers in `Canvas` and `Export` follow in the same step; `Export` takes no edit of its own.
 */
export const Default: Story = {
  render: function DefaultStory() {
    const [workspace, setWorkspace] = useState(DEMO_WORKSPACE);
    const codec = useMemo(() => workspaceCodec([]), []);
    return (
      <div className={s.frame}>
        <AssetEditor list workspace={workspace} codec={codec} onChange={setWorkspace} onSubmit={() => {}} />
      </div>
    );
  },
};
