import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { AssetEditor } from '@weasel-js/prefs-editor';
import { assetSetCodec } from '@weasel-js/prefs/edit';
import { DEMO_ACTIONS, DEMO_ASSET_SET } from './AssetEditor.demo';
import s from './AssetEditor.stories.module.css';

const meta: Meta<typeof AssetEditor> = {
  title: 'prefs-editor/PrefSchemaEditor/AssetEditor',
  parameters: { layout: 'fullscreen' },
  component: AssetEditor,
};
export default meta;

type Story = StoryObj<typeof AssetEditor>;

/**
 * A dialog and the panels that point into it, picked from the list at the far edge. Re-key or remove a setting in
 * `Settings` and the pointers in `Canvas` and `Export` follow in the same step; `Export` takes no edit of its own.
 * The asset set holds a catalog of actions too: drag a row of the Actions list to sort it, and pick one for its attributes.
 */
export const Default: Story = {
  render: function DefaultStory(args) {
    const [assetSet, setAssetSet] = useState(DEMO_ASSET_SET);
    const codec = useMemo(() => assetSetCodec([]), []);
    return (
      <div className={s.frame}>
        <AssetEditor {...args} list assetSet={assetSet} codec={codec} actions={DEMO_ACTIONS} onChange={setAssetSet} onSubmit={() => {}} />
      </div>
    );
  },
};
