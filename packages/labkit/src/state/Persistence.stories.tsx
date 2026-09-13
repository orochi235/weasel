import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { createIndexedDbAdapter } from './adapters';
import { Persistence } from './Persistence';
import { usePersistedState } from './usePersistedState';

// jsdom only has fake-indexeddb, an imitation. This round-trips a value through
// the browser's own IndexedDB: write it, unmount the provider so it closes,
// mount a fresh one, and read it back.

function Tab() {
  const [tab, setTab] = usePersistedState('tab', 'shape');
  return (
    <p>
      <output aria-label="tab">{tab}</output>
      <button type="button" onClick={() => setTab('color')}>
        choose color
      </button>
    </p>
  );
}

function Remountable({ database }: { database: string }) {
  const [generation, setGeneration] = useState(0);
  const [shown, setShown] = useState(true);
  const storage = useState(() => createIndexedDbAdapter({ database }))[0];
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setShown(false);
          // Past the provider's deferred close, which sends the queued write.
          setTimeout(() => {
            setGeneration((g) => g + 1);
            setShown(true);
          }, 100);
        }}
      >
        remount
      </button>
      {shown ? (
        <Persistence
          key={generation}
          storageKey="story"
          storage={storage}
          fallback={<p>loading</p>}
        >
          <Tab />
        </Persistence>
      ) : null}
    </div>
  );
}

const meta: Meta<typeof Remountable> = {
  title: 'labkit/State/Persistence',
  component: Remountable,
};
export default meta;

export const SurvivesARemountInIndexedDb: StoryObj<typeof Remountable> = {
  args: { database: `labkit-story-${Date.now()}` },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByLabelText('tab')).toHaveTextContent('shape'));
    await userEvent.click(canvas.getByText('choose color'));
    await userEvent.click(canvas.getByText('remount'));
    await waitFor(() => expect(canvas.queryByLabelText('tab')).toBeNull());
    await waitFor(() => expect(canvas.getByLabelText('tab')).toHaveTextContent('color'), {
      timeout: 3000,
    });
  },
};
