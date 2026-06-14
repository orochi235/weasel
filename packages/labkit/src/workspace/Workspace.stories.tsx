import type { Meta, StoryObj } from '@storybook/react';
import type { Instrument } from '../instrument/types';
import { LabContext, type LabContextValue } from '../lab/LabContext';
import { noneAdapter } from '../state/adapters';
import { LabStoreContext } from '../state/context';
import { createLabStore } from '../state/store';
import type { WorkspaceRecord } from '../state/types';
import { WorkspaceChrome } from './WorkspaceChrome';

const noop = () => {};

const stub: Instrument = {
  name: 'Stub',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <div className="lk-stub-display">stub experiment area</div>,
};

const record: WorkspaceRecord = {
  id: 'ws-demo',
  instrumentName: 'Stub',
  config: {},
  state: {},
  view: { zoom: 1, pan: { x: 0, y: 0 } },
  undoStack: { past: [], future: [] },
};

function Harness() {
  const store = createLabStore({ storageKey: 'sb', storage: noneAdapter });
  const lab: LabContextValue = {
    instruments: [stub],
    workspaces: [record],
    addWorkspace: noop,
    cloneWorkspace: noop,
    closeWorkspace: noop,
    resetWorkspace: noop,
    savedSnapshots: [],
    saveSnapshot: noop,
    loadSnapshot: noop,
    deleteSnapshot: noop,
    theme: 'auto',
    setTheme: noop,
  };
  return (
    <LabStoreContext.Provider value={{ store }}>
      <LabContext.Provider value={lab}>
        <div style={{ height: '500px' }}>
          <WorkspaceChrome
            workspaceId="ws-demo"
            record={record}
            instrument={stub}
            isLastWorkspace={true}
          >
            {stub.render({
              state: {},
              config: {},
              setState: () => {},
              setConfig: () => {},
              workspace: { id: 'ws-demo', zoom: 1, setZoom: () => {} },
              emit: () => {},
            })}
          </WorkspaceChrome>
        </div>
      </LabContext.Provider>
    </LabStoreContext.Provider>
  );
}

const meta: Meta<typeof Harness> = {
  title: 'Workspace/Workspace',
  component: Harness,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof Harness>;

export const Default: Story = {};
