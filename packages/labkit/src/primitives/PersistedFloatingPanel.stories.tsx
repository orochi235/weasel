import type { Meta, StoryObj } from '@weasel-js/forge';
import { PersistedFloatingPanel } from '@weasel-js/labkit/primitives';
import { Persistence } from '@weasel-js/labkit/state';
import { localStorageAdapter } from '@weasel-js/storage';

// The panel positions against its offset parent, so a story needs a sized,
// positioned host or there is nothing for it to float in.
const meta: Meta<typeof PersistedFloatingPanel> = {
  title: 'labkit/Primitives/PersistedFloatingPanel',
  component: PersistedFloatingPanel,
  decorators: [
    (Story) => (
      <Persistence storageKey="labkit-story" storage={localStorageAdapter}>
        <div className="lk-floating-panel-story-host">
          <Story />
        </div>
      </Persistence>
    ),
  ],
  args: { children: 'drag me, then reload', persist: 'story-panel' },
};
export default meta;

type Story = StoryObj<typeof PersistedFloatingPanel>;

/** Remembered under a provider; this one keeps it across story reloads. */
export const Remembered: Story = {};
